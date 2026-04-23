/**
 * lib/sanitizer.ts
 * Strips internal/sensitive fields from API responses before sending to frontend.
 *
 * Fields that must NEVER reach the browser:
 * - Raw Jira keys (HUREP-XXX)     → use ticketNumber instead
 * - Notion page / block IDs
 * - Internal scoring values
 * - Account IDs
 *
 * Text sanitization:
 * - Internal URLs (notion.so, notion.site, etc.) → stripped
 * - References to "Notion", "Confluence", "documentación interna" → stripped
 * - Only help.humand.co / humand.co / app.humand.co links are allowed
 */

const BLOCKED_FIELDS = new Set([
  "key",
  "jiraKey",
  "jira_key",
  "ciJiraKey",
  "pageId",
  "page_id",
  "notionId",
  "notion_id",
  "blockId",
  "accountId",
  "account_id",
  "_score",
  "internalScore",
  "rawStatus",
]);

// ─── Link whitelist ───────────────────────────────────────────────────────────

const ALLOWED_LINK_DOMAINS = ["help.humand.co", "humand.co", "app.humand.co"];

/**
 * Returns true only if the URL hostname is on the admin-visible whitelist.
 */
export function isAllowedLink(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_LINK_DOMAINS.some(
      (d) => hostname === d || hostname.endsWith("." + d)
    );
  } catch {
    return false;
  }
}

/**
 * Sanitizes a help_center_link/URL field:
 * - If the URL is on the whitelist → keep it
 * - Anything else (Notion, internal tools, etc.) → return undefined
 */
export function sanitizeHelpCenterLink(
  url: string | undefined | null
): string | undefined {
  if (!url) return undefined;
  return isAllowedLink(url) ? url : undefined;
}

/**
 * Strips all internal references and non-whitelisted URLs from a text string.
 * Apply to EVERY text field sent to the admin (explanation, message, summary, question).
 *
 * Removes:
 * - notion.so / notion.site URLs (bare or in markdown links)
 * - Any other bare non-whitelisted URL
 * - Markdown links whose href is non-whitelisted (keeps anchor text)
 * - The words "Notion", "Confluence", "documentación interna"
 * - Phrases like "no está documentado/a" that expose internal reasoning
 */
export function stripInternalLinks(str: string): string {
  if (!str) return str;
  let clean = str;

  // Markdown links: keep text if URL is non-whitelisted, keep full link if whitelisted
  clean = clean.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi,
    (_, text, url) => (isAllowedLink(url) ? `[${text}](${url})` : text)
  );

  // Bare notion URLs → remove entirely
  clean = clean.replace(/https?:\/\/(www\.)?notion\.(so|site)\/\S*/gi, "");
  clean = clean.replace(/https?:\/\/\S*\.notion\.(so|site)\S*/gi, "");

  // Any other bare URL: keep only if whitelisted
  clean = clean.replace(/https?:\/\/[^\s)>,"]+/gi, (url) => {
    const trimmed = url.replace(/[.,;:!?)"]+$/, "");
    return isAllowedLink(trimmed) ? url : "";
  });

  // Internal tool references
  clean = clean.replace(/\bnotion\b/gi, "");
  clean = clean.replace(/\bconfluence\b/gi, "");

  // Phrases that expose internal reasoning / doc structure
  clean = clean.replace(/documentaci[oó]n interna/gi, "");
  clean = clean.replace(/internal documentation/gi, "");
  clean = clean.replace(/documentation interne/gi, "");
  // "no está documentada/o" / "not documented" / "no está documentado" → remove
  clean = clean.replace(/no (est[aá]|is) documentad[ao]s?/gi, "");
  clean = clean.replace(/not documented/gi, "");
  // "según la documentación" / "según nuestros docs" patterns
  clean = clean.replace(/seg[uú]n (la |nuestra )?documentaci[oó]n/gi, "");
  clean = clean.replace(/according to (the |our )?documentation/gi, "");

  // Collapse multiple spaces/newlines left by removals
  return clean.replace(/[ \t]{2,}/g, " ").trim();
}

/**
 * Applies stripInternalLinks to every admin-visible text field of an AI result object.
 * Returns a new object — does not mutate.
 */
export function sanitizeAiTextFields<
  T extends {
    explanation?: string;
    message?: string;
    summary?: string;
    question?: string;
    help_center_link?: string;
  }
>(result: T): T {
  return {
    ...result,
    explanation: result.explanation
      ? stripInternalLinks(result.explanation)
      : result.explanation,
    message: result.message ? stripInternalLinks(result.message) : result.message,
    summary: result.summary ? stripInternalLinks(result.summary) : result.summary,
    question: result.question ? stripInternalLinks(result.question) : result.question,
    help_center_link: sanitizeHelpCenterLink(result.help_center_link),
  };
}

// ─── Field-level sanitizers ───────────────────────────────────────────────────

/**
 * Returns a shallow-clean copy of `obj` with all blocked fields removed.
 * Does NOT recurse into nested objects — call explicitly on each level.
 */
export function sanitizeForFrontend<T extends Record<string, unknown>>(
  obj: T
): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (BLOCKED_FIELDS.has(k)) continue;
    out[k as keyof T] = v as T[keyof T];
  }
  return out;
}

/**
 * Ensures a string doesn't contain raw HUREP-XXX patterns.
 * Replaces them with the ticket number only.
 */
export function redactJiraKeys(text: string): string {
  return text.replace(/\bHUREP-(\d+)\b/gi, "Reporte-$1");
}
