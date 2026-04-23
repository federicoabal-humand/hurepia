/**
 * POST /api/classify
 * Full pipeline:
 *   1. Resolve community internally (Notion fuzzy match — INVISIBLE to frontend)
 *   2. Enrich with module docs (Notion)
 *   3. Call Gemini for classification
 *   4. If action=classify + bug_confirmed:
 *      a. Check for duplicates (Jira search + Notion CLIENTS_INPUTS)
 *      b. If no duplicate → create Jira ticket
 *   5. Return enriched response to the frontend (never raw HUREP-XX)
 *
 * Body: {
 *   language, module, platforms, communityNameRaw,
 *   whatHappened, whatExpected, isBlocking, usersAffected,
 *   history, askCount
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { classifyReport } from "@/lib/llm";
import { getModuleDocs, searchClientsInputs, resolveCommunityInternal } from "@/lib/notion";
import { searchIssuesForCommunity, createJiraIssue } from "@/lib/jira";
import { signIssueRef } from "@/lib/token";
import { MODULE_NOTION_MAP } from "@/lib/module-registry";
import type { ClassifyResult } from "@/lib/llm";

// ─── Duplicate detection helpers ──────────────────────────────────────────────

/**
 * Tokenize a string for duplicate comparison.
 * - lowercase
 * - replace _ - . with spaces (so "error_500" → "error 500")
 * - strip remaining punctuation
 * - split on whitespace
 * - filter min 3 chars
 */
function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[_\-.]/g, " ")
    .replace(/[^\w\sáéíóúñüàèìòùâêîôûäëïöü]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

function dupScore(titleTokens: Set<string>, keywords: string[]): number {
  const kwTokens = keywords.flatMap(normalizeTokens);
  return kwTokens.filter((k) => titleTokens.has(k)).length;
}

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
      communityNameRaw = "",
      whatHappened = "",
      whatExpected = "",
      isBlocking = false,
      usersAffected = "1",
      history = [],
      askCount = 0,
    } = body;

    // ── 1. Resolve community internally (100% invisible to frontend) ──────────
    const resolved = await resolveCommunityInternal(communityNameRaw).catch(() => ({
      matched: false as const,
    }));

    // The name used for Jira: canonical if matched, raw otherwise
    const communityName = resolved.matched
      ? (resolved.canonicalName ?? communityNameRaw)
      : communityNameRaw;

    // CX owner from internal resolution (may be enriched later via next_action)
    let cxOwnerName: string | null = resolved.matched ? (resolved.cxOwnerName ?? null) : null;

    // ── 2. Fetch module docs ──────────────────────────────────────────────────
    const moduleEntry = MODULE_NOTION_MAP[moduleSlug];
    const moduleDisplayName = moduleEntry?.displayName ?? moduleSlug;

    const moduleDocs = await getModuleDocs(moduleSlug).catch(() => ({ found: false as const }));

    // ── 3. Call Gemini ────────────────────────────────────────────────────────
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

    // ── 4. If AI wants to ask a follow-up → return immediately ───────────────
    if (aiResult.action === "ask") {
      return NextResponse.json(aiResult);
    }

    // ── 5. Classification decided ─────────────────────────────────────────────
    const classification = aiResult.classification;

    // Non-bug → return immediately (cxOwnerName already resolved above)
    if (classification !== "bug_confirmed") {
      return NextResponse.json({ ...aiResult, cxOwnerName });
    }

    // ── 6. Bug confirmed: duplicate check ─────────────────────────────────────
    const keywords: string[] = aiResult.keywords?.length
      ? aiResult.keywords
      : whatHappened.toLowerCase().split(/\W+/).filter((w: string) => w.length >= 4).slice(0, 5);

    const [jiraIssues, notionInputs] = await Promise.all([
      searchIssuesForCommunity(communityName).catch(() => []),
      searchClientsInputs(keywords).catch(() => []),
    ]);

    // ── Jira duplicate check ─────────────────────────────────────────────────
    const openJiraIssues = jiraIssues.filter((i) => i.status !== "resolved");

    const jiraDup = openJiraIssues.find((issue) => {
      const titleTokens = new Set(normalizeTokens(issue.summary));
      return dupScore(titleTokens, keywords) >= 2;
    });

    if (jiraDup) {
      const keyParts = jiraDup.key.split("-");
      const dupTicketNumber = keyParts.length === 2 ? parseInt(keyParts[1], 10) : undefined;

      return NextResponse.json({
        ...aiResult,
        cxOwnerName,
        isDuplicate: true,
        duplicateType: "jira" as const,
        duplicateTitle: jiraDup.summary,
        duplicateCommentRef: signIssueRef(jiraDup.key),
        duplicateTicketNumber: dupTicketNumber,
      });
    }

    // ── Notion duplicate check ────────────────────────────────────────────────
    const notionDup = notionInputs.find((item) => {
      const titleTokens = new Set(normalizeTokens(item.title));
      return dupScore(titleTokens, keywords) >= 2;
    });

    if (notionDup) {
      return NextResponse.json({
        ...aiResult,
        cxOwnerName,
        isDuplicate: true,
        duplicateType: "notion" as const,
        duplicateTitle: notionDup.title,
      });
    }

    // ── 7. No duplicate → create Jira ticket ─────────────────────────────────
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
