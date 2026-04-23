/**
 * POST /api/classify
 * Full pipeline:
 *   1. Resolve community internally (Notion fuzzy match — INVISIBLE to frontend)
 *   2. Enrich with module docs + recent module tickets (parallel)
 *   3. Call Gemini for classification
 *   4. Route based on classification:
 *      - bug_already_resolved → find resolved ticket, return isResolved
 *      - bug_known → find open ticket, add comment, return isDuplicate
 *      - feature_request / configuration_error / etc. → return immediately
 *      - bug_confirmed → duplicate check → create Jira ticket
 *   5. Jira ticket includes: severity, friction score, cluster_id
 *   6. Return enriched response (never raw HUREP-XX, never custom fields)
 */
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { classifyReport } from "@/lib/llm";
import { getModuleDocs, searchClientsInputs, resolveCommunityInternal } from "@/lib/notion";
import {
  searchIssuesForCommunity,
  createJiraIssue,
  addJiraComment,
  getRecentTicketsForModule,
} from "@/lib/jira";
import { signIssueRef } from "@/lib/token";
import { MODULE_NOTION_MAP } from "@/lib/module-registry";
import type { ClassifyResult } from "@/lib/llm";
import type { JiraIssueSummary } from "@/lib/jira";

// ─── Duplicate detection helpers ──────────────────────────────────────────────

const GENERIC_TOKENS = new Set([
  "error", "falla", "problema", "inconveniente", "issue",
  "mobile", "web", "app", "usuario", "admin", "administrador",
  "no", "si", "que", "con", "para", "por", "del", "una", "uno",
  "los", "las", "the", "and", "not", "can", "hay", "fue",
  "500", "404", "http", "fail", "failed", "null", "undefined",
]);

const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[_\-.]/g, " ")
    .replace(/[^\w\sáéíóúñüàèìòùâêîôûäëïöü]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !GENERIC_TOKENS.has(w));
}

function shareLongWord(a: string, b: string, minLen = 15): boolean {
  const wordsA = a.toLowerCase().split(/\s+/).filter((w) => w.length >= minLen);
  const setB = new Set(b.toLowerCase().split(/\s+/));
  return wordsA.some((w) => setB.has(w));
}

function scoreDuplicate(
  keywords: string[],
  ticketSummary: string
): { score: number; confidence: "high" | "low" } {
  const newTokens = new Set(keywords.flatMap(normalizeTokens));
  const ticketTokens = new Set(normalizeTokens(ticketSummary));

  let score = 0;
  for (const token of newTokens) {
    if (ticketTokens.has(token)) score += 1;
  }
  const fullNew = keywords.join(" ");
  if (shareLongWord(fullNew, ticketSummary, 15)) score += 2;

  return { score, confidence: score >= 5 ? "high" : "low" };
}

/** Find the best scoring match from a list of issues. Returns null if none score ≥ 3. */
function findBestMatch(
  keywords: string[],
  issues: JiraIssueSummary[]
): { issue: JiraIssueSummary; score: number; confidence: "high" | "low" } | null {
  let best: { issue: JiraIssueSummary; score: number; confidence: "high" | "low" } | null = null;
  for (const issue of issues) {
    const { score, confidence } = scoreDuplicate(keywords, issue.summary);
    if (score >= 3 && (!best || score > best.score)) {
      best = { issue, score, confidence };
    }
  }
  return best;
}

function issueTicketNumber(key: string): number | undefined {
  const parts = key.split("-");
  return parts.length === 2 ? parseInt(parts[1], 10) : undefined;
}

// ─── Route ────────────────────────────────────────────────────────────────────

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

    // ── 1. Resolve community internally ───────────────────────────────────────
    const resolved = await resolveCommunityInternal(communityNameRaw).catch(() => ({
      matched: false as const,
    }));

    const communityName = resolved.matched
      ? (resolved.canonicalName ?? communityNameRaw)
      : communityNameRaw;

    const cxOwnerName: string | null = resolved.matched ? (resolved.cxOwnerName ?? null) : null;

    // ── 2. Module metadata ────────────────────────────────────────────────────
    const moduleEntry = MODULE_NOTION_MAP[moduleSlug];
    const moduleDisplayName = moduleEntry?.displayName ?? moduleSlug;

    // Fetch docs + recent tickets in parallel (both fail-safe)
    const [moduleDocs, recentModuleTickets] = await Promise.all([
      getModuleDocs(moduleSlug).catch(() => ({ found: false as const })),
      getRecentTicketsForModule(moduleSlug, 20).catch(() => []),
    ]);

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
      recentModuleTickets: recentModuleTickets.length > 0 ? recentModuleTickets : undefined,
    });

    // ── 4. Follow-up question → return immediately ─────────────────────────
    if (aiResult.action === "ask") {
      return NextResponse.json(aiResult);
    }

    const classification = aiResult.classification;

    // ── 5. Extract keywords early (shared across all bug branches) ─────────
    const keywords: string[] = aiResult.keywords?.length
      ? aiResult.keywords
      : whatHappened.toLowerCase().split(/\W+/).filter((w: string) => w.length >= 4).slice(0, 5);

    // ── 6. Fetch community issues (used for known/resolved/confirmed bugs) ──
    // Only fetch for bug-related classifications to save API calls
    const isBugRelated = classification === "bug_confirmed"
      || classification === "bug_known"
      || classification === "bug_already_resolved";

    const jiraIssues = isBugRelated
      ? await searchIssuesForCommunity(communityName).catch(() => [])
      : [];

    // ── 7. bug_already_resolved ────────────────────────────────────────────
    if (classification === "bug_already_resolved") {
      const resolvedCandidates = jiraIssues.filter((issue) => {
        if (issue.status !== "resolved") return false;
        if (
          issue.module && issue.module !== "general" &&
          moduleSlug !== "general" && issue.module !== moduleSlug
        ) return false;
        const ageMs = Date.now() - new Date(issue.createdAt).getTime();
        return ageMs <= THIRTY_DAYS_MS;
      });

      const best = findBestMatch(keywords, resolvedCandidates);

      return NextResponse.json({
        action: "classify" as const,
        classification,
        explanation: aiResult.explanation,
        isResolved: true,
        duplicateTicketNumber: best ? issueTicketNumber(best.issue.key) : undefined,
        duplicateFriendlyStatus: "resolved" as const,
        cxOwnerName,
      });
    }

    // ── 8. bug_known ──────────────────────────────────────────────────────
    if (classification === "bug_known") {
      const openCandidates = jiraIssues.filter((issue) => {
        if (issue.status === "resolved") return false;
        if (
          issue.module && issue.module !== "general" &&
          moduleSlug !== "general" && issue.module !== moduleSlug
        ) return false;
        const ageMs = Date.now() - new Date(issue.createdAt).getTime();
        return ageMs <= SIXTY_DAYS_MS;
      });

      const best = findBestMatch(keywords, openCandidates);

      if (best) {
        const commentRef = signIssueRef(best.issue.key);
        const ticketNumber = issueTicketNumber(best.issue.key);

        // Add comment to the existing ticket (fail-safe)
        try {
          const lang = language === "es" ? "es" : "en";
          const commentText = lang === "es"
            ? `[HuReport AI] Nuevo reporte similar recibido.\nComunidad: ${communityName}\nDescripción: ${whatHappened.slice(0, 500)}`
            : `[HuReport AI] Similar report received.\nCommunity: ${communityName}\nDescription: ${whatHappened.slice(0, 500)}`;
          await addJiraComment(best.issue.key, commentText);
        } catch {
          // Don't fail if comment fails
        }

        return NextResponse.json({
          action: "classify" as const,
          classification,
          explanation: aiResult.explanation,
          isDuplicate: true,
          duplicateConfidence: "high" as const,
          duplicateTicketNumber: ticketNumber,
          duplicateFriendlyStatus: best.issue.status,
          duplicateCreatedAt: best.issue.createdAt,
          duplicateCommentRef: commentRef,
          cxOwnerName,
        });
      }

      // No match found — fallback: treat as new bug_confirmed
      // (Gemini said bug_known but we can't find it → safe to create new ticket)
    }

    // ── 9. feature_request ────────────────────────────────────────────────
    if (classification === "feature_request") {
      return NextResponse.json({ ...aiResult, cxOwnerName });
    }

    // ── 10. Non-bug (config_error, cache_browser, expected_behavior, needs_more_info) ──
    if (
      classification !== "bug_confirmed" &&
      classification !== "bug_known" // bug_known fell through here → treat as bug_confirmed
    ) {
      return NextResponse.json({ ...aiResult, cxOwnerName });
    }

    // ── 11. Bug confirmed (or bug_known with no match): duplicate check ────
    const now = Date.now();
    const candidateJiraIssues = jiraIssues.filter((issue) => {
      if (issue.status === "resolved") return false;
      if (
        issue.module && issue.module !== "general" &&
        moduleSlug !== "general" && issue.module !== moduleSlug
      ) return false;
      const ageMs = now - new Date(issue.createdAt).getTime();
      if (ageMs > SIXTY_DAYS_MS) return false;
      return true;
    });

    const jiraDup = findBestMatch(keywords, candidateJiraIssues);

    if (jiraDup) {
      const { issue, confidence } = jiraDup;
      const dupTicketNumber = issueTicketNumber(issue.key);

      return NextResponse.json({
        action: "classify" as const,
        classification: aiResult.classification,
        explanation: aiResult.explanation,
        isDuplicate: true,
        duplicateConfidence: confidence,
        duplicateTicketNumber: dupTicketNumber,
        duplicateFriendlyStatus: issue.status,
        duplicateCreatedAt: issue.createdAt,
        duplicateCommentRef: signIssueRef(issue.key),
        cxOwnerName,
      });
    }

    // ── Notion duplicate check ────────────────────────────────────────────
    const notionInputs = await searchClientsInputs(keywords).catch(() => []);
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

    // ── 12. No duplicate → create Jira ticket ─────────────────────────────
    const summary = (aiResult.summary ?? whatHappened).slice(0, 120);

    const severidad = aiResult.severidad ?? (isBlocking && usersAffected === "many" ? "alta" : "media");
    const frictionScore =
      (severidad === "alta" ? 3 : severidad === "media" ? 2 : 1) +
      (isBlocking ? 2 : 0) +
      (usersAffected === "many" ? 1 : 0);

    // cluster_id groups similar issues for analytics (never shown to admin)
    const actualClassification = classification === "bug_known" ? "bug_confirmed" : classification;
    const clusterId = `${moduleSlug}_${actualClassification}`;

    const description = [
      `Module: ${moduleDisplayName}`,
      `Platform: ${platforms.join(", ")}`,
      `Community: ${communityName}`,
      `What happened: ${whatHappened}`,
      whatExpected ? `Expected: ${whatExpected}` : "",
      `Blocking: ${isBlocking ? "Yes" : "No"}`,
      `Users affected: ${usersAffected}`,
      `---`,
      `Severity: ${severidad}`,
      `Friction Score: ${frictionScore}/6`,
      `Cluster: ${clusterId}`,
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
      // Always use "bug_confirmed" for the frontend even if bug_known fell through
      classification: actualClassification,
      cxOwnerName,
      ticketNumber,
      commentRef,
      isDuplicate: false,
      severidad,
      frictionScore,
    });
  } catch (err) {
    console.error("[classify] error:", err);
    return NextResponse.json({ error: "Classification failed" }, { status: 500 });
  }
}
