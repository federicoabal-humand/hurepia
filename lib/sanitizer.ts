/**
 * lib/sanitizer.ts
 * Strips internal/sensitive fields from API responses before sending to frontend.
 *
 * Fields that must NEVER reach the browser:
 * - Raw Jira keys (HUREP-XXX)     → use ticketNumber instead
 * - Notion page / block IDs
 * - Internal scoring values
 * - Account IDs
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
