/**
 * POST /api/classify
 * Full pipeline:
 *   1. Enrich with module docs (Notion)
 *   2. Call Gemini for classification
 *   3. If action=classify + bug_confirmed:
 *      a. Check for duplicates (Jira search + Notion CLIENTS_INPUTS)
 *      b. If no duplicate → create Jira ticket
 *   4. If next_action=contact_cx_manager → resolve CX owner name
 *   5. Return enriched response to the frontend (never raw HUREP-XX)
 *
 * Body: {
 *   language, module, platforms, communityName, communityPageId,
 *   whatHappened, whatExpected, isBlocking, usersAffected,
 *   history, askCount
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { classifyReport } from "@/lib/llm";
import { getModuleDocs, getCxOwnerForCommunity, searchClientsInputs } from "@/lib/notion";
import { searchIssuesForCommunity, createJiraIssue } from "@/lib/jira";
import { signIssueRef } from "@/lib/token";
import { MODULE_NOTION_MAP } from "@/lib/module-registry";
import type { ClassifyResult } from "@/lib/llm";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed } = rateLimit(`classify:${ip}`, 20, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const {
      language = "es",
      module: moduleSlug = "general",
      platforms = [],
      communityName = "",
      communityPageId = "",
      whatHappened = "",
      whatExpected = "",
      isBlocking = false,
      usersAffected = "1",
      history = [],
      askCount = 0,
    } = body;

    // ── 1. Fetch module docs in parallel with nothing else (fast) ────────────
    const moduleEntry = MODULE_NOTION_MAP[moduleSlug];
    const moduleDisplayName = moduleEntry?.displayName ?? moduleSlug;

    const moduleDocs = await getModuleDocs(moduleSlug).catch(() => ({ found: false as const }));

    // ── 2. Call Gemini ────────────────────────────────────────────────────────
    const aiResult: ClassifyResult = await classifyReport({
      language,
      module: moduleSlug,
      moduleDisplayName,
      moduleDocs: moduleDocs.found ? moduleDocs.content : undefined,
      moduleNotionUrl: moduleDocs.found ? moduleDocs.notionUrl : undefined,
      platforms,
      communityName,
      whatHappened,
      whatExpected,
      isBlocking,
      usersAffected,
      history,
      askCount,
    });

    // ── 3. If AI wants to ask a follow-up → return immediately ───────────────
    if (aiResult.action === "ask") {
      return NextResponse.json(aiResult);
    }

    // ── 4. Classification decided ─────────────────────────────────────────────
    const classification = aiResult.classification;

    // For non-bug cases, optionally resolve CX owner if needed
    let cxOwnerName: string | null = null;
    if (aiResult.next_action === "contact_cx_manager" && communityPageId) {
      const cx = await getCxOwnerForCommunity(communityPageId).catch(() => ({ found: false as const }));
      if (cx.found && cx.cxOwnerName) {
        cxOwnerName = cx.cxOwnerName;
      }
    }

    // Non-bug → return AI result + optional CX owner
    if (classification !== "bug_confirmed") {
      return NextResponse.json({ ...aiResult, cxOwnerName });
    }

    // ── 5. Bug confirmed: duplicate check ─────────────────────────────────────
    const keywords = aiResult.keywords?.length
      ? aiResult.keywords
      : whatHappened.toLowerCase().split(/\W+/).filter((w: string) => w.length >= 4).slice(0, 5);

    // Run Jira search + Notion search in parallel
    const [jiraIssues, notionInputs] = await Promise.all([
      searchIssuesForCommunity(communityName).catch(() => []),
      searchClientsInputs(keywords).catch(() => []),
    ]);

    // Check for keyword overlap with existing Jira tickets
    const kwSet = new Set(keywords.map((k: string) => k.toLowerCase()));
    const jiraDup = jiraIssues.find((issue) => {
      const titleWords = issue.summary.toLowerCase().split(/\W+/);
      const overlap = titleWords.filter((w) => kwSet.has(w));
      return overlap.length >= 2; // At least 2 keyword matches = likely duplicate
    });

    if (jiraDup) {
      return NextResponse.json({
        ...aiResult,
        cxOwnerName,
        isDuplicate: true,
        duplicateType: "jira",
        duplicateTitle: jiraDup.summary,
        duplicateCommentRef: signIssueRef(jiraDup.key),
      });
    }

    const notionDup = notionInputs.find((item) => {
      const titleWords = item.title.toLowerCase().split(/\W+/);
      const overlap = titleWords.filter((w) => kwSet.has(w));
      return overlap.length >= 2;
    });

    if (notionDup) {
      return NextResponse.json({
        ...aiResult,
        cxOwnerName,
        isDuplicate: true,
        duplicateType: "notion",
        duplicateTitle: notionDup.title,
      });
    }

    // ── 6. No duplicate → create Jira ticket ─────────────────────────────────
    const summary = (aiResult.summary ?? whatHappened).slice(0, 120);
    const description = [
      `Module: ${moduleDisplayName}`,
      `Platform: ${platforms.join(", ")}`,
      `Community: ${communityName}`,
      `What happened: ${whatHappened}`,
      whatExpected ? `Expected: ${whatExpected}` : "",
      `Blocking: ${isBlocking ? "Yes" : "No"}`,
      `Users affected: ${usersAffected}`,
    ]
      .filter(Boolean)
      .join("\n");

    const issue = await createJiraIssue({
      summary,
      description,
      module: moduleSlug,
      affectedUsersCount: usersAffected === "many" ? "many" : "1",
      isBlocking: !!isBlocking,
      communityName,
    });

    const keyParts = issue.key.split("-");
    const ticketNumber = keyParts.length === 2 ? parseInt(keyParts[1], 10) : 1;
    const commentRef = signIssueRef(issue.key);

    return NextResponse.json({
      ...aiResult,
      cxOwnerName,
      ticketNumber,
      commentRef,
      isDuplicate: false,
    });
  } catch (err) {
    console.error("[classify] error:", err);
    return NextResponse.json({ error: "Classification failed" }, { status: 500 });
  }
}
