/**
 * GET /api/reports
 *
 * Query params (in priority order):
 *   instanceId       — most precise; filters by "instanceId_XXXX" label
 *   adminEmail       — filters by reporter email
 *   communityName    — filters by community name label (sanitized)
 *   language         — "es" | "en" | "pt" | "fr" (default "es")
 *                      summaries in a different language are translated on-the-fly
 *
 * Returns HUREP issues for the requesting community.
 * - commentRef is a signed token; raw HUREP-XX keys are NEVER returned.
 * - ticketNumber is a sequential display number (1, 2, 3…).
 */
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { searchAllIssuesForCommunity } from "@/lib/jira";
import { signIssueRef, verifyIssueRef } from "@/lib/token";
import { resolveCommunityInternal } from "@/lib/notion";
import { mapJiraStatusToFriendly } from "@/lib/mappings";

// ─── Translation helpers ──────────────────────────────────────────────────────

/** Module-level cache: key = "${jiraKey}:${targetLang}" → translated text */
const translationCache = new Map<string, string>();

/**
 * Heuristic: does this text look like English?
 * Checks for common English stopwords. Works well enough for the
 * English vs Spanish/Portuguese/French distinction in Jira summaries.
 */
const ENGLISH_STOPWORDS = new Set([
  "the", "not", "when", "for", "after", "has", "been", "are", "with",
  "that", "this", "from", "push", "does", "have", "is", "in", "of",
  "delivered", "background", "module", "error", "users", "cannot",
  "does", "while", "does", "app", "notifications",
]);

function looksLikeEnglish(text: string): boolean {
  const words = text.toLowerCase().split(/\W+/).filter(Boolean);
  const engCount = words.filter((w) => ENGLISH_STOPWORDS.has(w)).length;
  return engCount >= 2;
}

/**
 * Translate `text` to `targetLang` using Gemini 2.5 Flash.
 * Results are cached per (jiraKey, targetLang) pair.
 * Returns the original text on any error (fail-open).
 */
async function translateText(
  text: string,
  targetLang: string,
  cacheKey: string
): Promise<string> {
  if (translationCache.has(cacheKey)) return translationCache.get(cacheKey)!;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return text;

  const langLabel =
    targetLang === "es"
      ? "Spanish (Rioplatense, use 'vos')"
      : targetLang === "pt"
      ? "Portuguese (Brazilian)"
      : targetLang === "fr"
      ? "French"
      : "English";

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { temperature: 0 },
    });
    const timeout = new Promise<never>((_, r) =>
      setTimeout(() => r(new Error("translate timeout")), 5000)
    );
    const resp = await Promise.race([
      model.generateContent(
        `Translate the following text to ${langLabel}.\n` +
          `If the text starts with a [Platform] Module | prefix, translate the prefix tokens too.\n` +
          `Respond ONLY with the translation — no comments, no explanations.\n\n` +
          `Text: ${text}`
      ),
      timeout,
    ]);
    const translated = resp.response.text().trim();
    if (translated) translationCache.set(cacheKey, translated);
    return translated || text;
  } catch {
    return text; // fail-open
  }
}

// ─── Direct Jira REST call (freshRef bypass) ──────────────────────────────────

/** Direct Jira REST call — bypasses JQL indexing delay for freshly created tickets */
async function fetchIssueByKey(jiraKey: string) {
  const base = process.env.JIRA_BASE_URL ?? "https://humand.atlassian.net";
  const b64 = Buffer.from(
    `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`
  ).toString("base64");
  const headers = {
    Authorization: `Basic ${b64}`,
    Accept: "application/json",
  };
  try {
    const res = await fetch(
      `${base}/rest/api/3/issue/${jiraKey}?fields=summary,status,created,customfield_10059`,
      { headers }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const statusName: string = data.fields?.status?.name ?? "";
    const categoryKey: string = data.fields?.status?.statusCategory?.key ?? "";
    return {
      key: jiraKey,
      summary: data.fields?.summary ?? "",
      module: "general" as string,
      status: mapJiraStatusToFriendly(statusName, categoryKey),
      createdAt: data.fields?.created ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const instanceIdStr = sp.get("instanceId") ?? "";
  const adminEmail = sp.get("adminEmail") ?? "";
  const communityNameRaw = sp.get("communityName") ?? "";
  const freshRef = sp.get("freshRef") ?? "";
  const language = sp.get("language") ?? "es";

  const instanceId = instanceIdStr ? parseInt(instanceIdStr, 10) : undefined;

  // Must have at least one filter
  if (!instanceId && !adminEmail.trim() && !communityNameRaw.trim()) {
    return NextResponse.json(
      { error: "communityName, instanceId, or adminEmail is required" },
      { status: 400 }
    );
  }

  // ── If using communityName: try to resolve via Notion for better accuracy ──
  let resolvedCommunityName = communityNameRaw;
  if (!instanceId && !adminEmail && communityNameRaw) {
    try {
      const notionMatch = await resolveCommunityInternal(communityNameRaw);
      if (notionMatch.matched && notionMatch.canonicalName) {
        resolvedCommunityName = notionMatch.canonicalName;
      }
    } catch {
      // Notion unavailable — use raw name (fail open)
    }
  }

  try {
    const issues = await searchAllIssuesForCommunity({
      instanceId,
      adminEmail: adminEmail || undefined,
      communityName: !instanceId && !adminEmail ? resolvedCommunityName : undefined,
    });

    // If a freshRef was passed, resolve the key and inject the issue if JQL hasn't indexed it yet
    let freshKey: string | null = null;
    if (freshRef) {
      freshKey = verifyIssueRef(freshRef);
      if (freshKey && !issues.some((i) => i.key === freshKey)) {
        const fresh = await fetchIssueByKey(freshKey);
        if (fresh) issues.unshift(fresh);
      }
    }

    // ── On-the-fly translation ───────────────────────────────────────────────
    // Only translate when admin requests a non-English language and the summary
    // looks like it's in English. Cap at 20 tickets to bound latency; rest are
    // served in original language (acceptable for demo).
    const TRANSLATE_LIMIT = 20;
    const needsTranslation = language !== "en";

    const translatedSummaries: string[] = await (async () => {
      if (!needsTranslation) return issues.map((i) => i.summary);

      return Promise.all(
        issues.map(async (issue, idx) => {
          if (idx >= TRANSLATE_LIMIT) return issue.summary;
          if (!looksLikeEnglish(issue.summary)) return issue.summary;
          return translateText(
            issue.summary,
            language,
            `${issue.key}:${language}`
          );
        })
      );
    })();

    const tickets = issues.map((issue, idx) => {
      const commentRef = signIssueRef(issue.key);
      const summary = translatedSummaries[idx] ?? issue.summary;
      return {
        // id = opaque signed token — NEVER the raw HUREP-XX key
        id: commentRef,
        ticketNumber: idx + 1,
        summary,
        module: issue.module,
        status: issue.status,
        date: issue.createdAt.slice(0, 10),
        commentRef,
        description: summary,
        classification: "bug_confirmed" as const,
        platforms: [] as string[],
        isBlocking: false,
        usersAffected: "1" as const,
        evidenceUrls: [] as string[],
      };
    });

    return NextResponse.json(tickets);
  } catch (err) {
    console.error("[reports] Jira search failed:", err);
    return NextResponse.json([]);
  }
}
