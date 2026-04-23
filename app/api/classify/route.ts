/**
 * POST /api/classify
 * Full pipeline:
 *   1. Resolve community internally (Notion fuzzy match — INVISIBLE to frontend)
 *   2. Enrich with module docs (Notion)
 *   3. Call Gemini for classification
 *   4. If action=classify + bug_confirmed:
 *      a. Check for duplicates (module-aware, 60-day window)
 *      b. If no duplicate → create Jira ticket
 *   5. Return enriched response to the frontend (never raw HUREP-XX,
 *      never internal Jira fields)
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
 * Generic tokens that carry no discriminating signal.
 * Excluded from duplicate scoring.
 */
const GENERIC_TOKENS = new Set([
  "error", "falla", "problema", "inconveniente", "issue",
  "mobile", "web", "app", "usuario", "admin", "administrador",
  "no", "si", "que", "con", "para", "por", "del", "una", "uno",
  "los", "las", "the", "and", "not", "can", "hay", "fue",
  "500", "404", "http", "fail", "failed", "null", "undefined",
]);

const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * Tokenize a string for duplicate comparison.
 * - lowercase, replace _ - . with spaces, strip punctuation, split, min 3 chars
 */
function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[_\-.]/g, " ")
    .replace(/[^\w\sáéíóúñüàèìòùâêîôûäëïöü]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !GENERIC_TOKENS.has(w));
}

/**
 * Returns true if a and b share a common substring of minLen+ chars
 * (word-level: only checks whole words ≥ minLen chars).
 */
function shareLongWord(a: string, b: string, minLen = 15): boolean {
  const wordsA = a.toLowerCase().split(/\s+/).filter((w) => w.length >= minLen);
  const setB = new Set(b.toLowerCase().split(/\s+/));
  return wordsA.some((w) => setB.has(w));
}

/**
 * Score overlap between new report keywords and a Jira ticket title.
 * Returns { score, confidence }.
 */
function scoreDuplicate(keywords: string[], ticketSummary: string): { score: number; confidence: "high" | "low" } {
  const newTokens = new Set(keywords.flatMap(normalizeTokens));
  const ticketTokens = new Set(normalizeTokens(ticketSummary));

  let score = 0;
  for (const token of newTokens) {
    if (ticketTokens.has(token)) score += 1;
  }

  // Bonus for sharing a long specific word (rare, high signal)
  const fullNew = keywords.join(" ");
  if (shareLongWord(fullNew, ticketSummary, 15)) score += 2;

  return {
    score,
    confidence: score >= 5 ? "high" : "low",
  };
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

    const communityName = resolved.matched
      ? (resolved.canonicalName ?? communityNameRaw)
      : communityNameRaw;

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

    // Non-bug → return immediately
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

    // ── Jira duplicate check (module-aware + 60-day window) ──────────────────
    const now = Date.now();
    const candidateJiraIssues = jiraIssues.filter((issue) => {
      // F1: exclude resolved
      if (issue.status === "resolved") return false;
      // F2: module filter — skip if modules differ (ignore "general" = untagged)
      if (
        issue.module &&
        issue.module !== "general" &&
        moduleSlug !== "general" &&
        issue.module !== moduleSlug
      ) return false;
      // F3: 60-day window
      const ageMs = now - new Date(issue.createdAt).getTime();
      if (ageMs > SIXTY_DAYS_MS) return false;
      return true;
    });

    const jiraDup = (() => {
      let best: { issue: typeof candidateJiraIssues[0]; score: number; confidence: "high" | "low" } | null = null;
      for (const issue of candidateJiraIssues) {
        const { score, confidence } = scoreDuplicate(keywords, issue.summary);
        if (score >= 3 && (!best || score > best.score)) {
          best = { issue, score, confidence };
        }
      }
      return best;
    })();

    if (jiraDup) {
      const { issue, confidence } = jiraDup;
      const keyParts = issue.key.split("-");
      const dupTicketNumber = keyParts.length === 2 ? parseInt(keyParts[1], 10) : undefined;

      // Return ONLY safe fields — no internal Jira data
      return NextResponse.json({
        // Minimal classification context for the frontend badge
        action: "classify" as const,
        classification: aiResult.classification,
        explanation: aiResult.explanation,
        // Duplicate block (7 safe fields only)
        isDuplicate: true,
        duplicateConfidence: confidence,
        duplicateTicketNumber: dupTicketNumber,
        duplicateFriendlyStatus: issue.status,
        duplicateCreatedAt: issue.createdAt,
        duplicateCommentRef: signIssueRef(issue.key),
        // cxOwnerName if needed
        cxOwnerName,
      });
    }

    // ── Notion duplicate check ────────────────────────────────────────────────
    const notionDup = notionInputs.find((item) => {
      const { score } = scoreDuplicate(keywords, item.title);
      return score >= 3;
    });

    if (notionDup) {
      return NextResponse.json({
        action: "classify" as const,
        classification: aiResult.classification,
        explanation: aiResult.explanation,
        isDuplicate: true,
        duplicateConfidence: "low" as const,
        duplicateCommentRef: undefined,
        cxOwnerName,
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
