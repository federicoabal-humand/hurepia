/**
 * lib/jira.ts
 * Jira Cloud REST API v3 helpers for HuReport AI.
 *
 * Env: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN
 */
import { JIRA, MODULE_TO_JIRA_ID, mapJiraStatusToFriendly } from "./mappings";
import type { FriendlyStatus } from "./mappings";

/**
 * Reverse mapping: Jira option ID → internal module slug.
 * Used to convert the MINI_APP field value back to our module key.
 * e.g. "10115" → "users", "10122" → "time_off"
 */
const JIRA_OPTION_TO_MODULE: Record<string, string> = Object.fromEntries(
  Object.entries(MODULE_TO_JIRA_ID).map(([key, id]) => [id, key])
);

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function headers() {
  const base64 = Buffer.from(
    `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`
  ).toString("base64");
  return {
    Authorization: `Basic ${base64}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function base() {
  return process.env.JIRA_BASE_URL ?? "https://humand.atlassian.net";
}

/** Atlassian Document Format — minimal paragraph */
function adf(text: string) {
  return {
    type: "doc",
    version: 1,
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  };
}

/**
 * Sanitize a community name for the Jira "labels" field.
 * Labels do NOT support spaces — replace with underscores and strip
 * any characters that Jira rejects.
 */
export function sanitizeLabelValue(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_\-áéíóúÁÉÍÓÚñÑüÜ]/g, "")
    .slice(0, 100);
}

// ─── In-memory cache for recent module tickets ─────────────────────────────────
const recentTicketsCache = new Map<string, { data: RecentModuleTicket[]; ts: number }>();
const RECENT_CACHE_TTL = 5 * 60 * 1000; // 5 min

export interface RecentModuleTicket {
  summary: string;
  friendlyStatus: string;
  createdAt: string;
}

/**
 * Fetches the last N tickets for a given module from HUREP project.
 * Used to give Gemini context about known/resolved issues in the module.
 * Results are cached in-memory for 5 minutes per moduleSlug.
 */
export async function getRecentTicketsForModule(
  moduleSlug: string,
  limit = 20
): Promise<RecentModuleTicket[]> {
  const cached = recentTicketsCache.get(moduleSlug);
  if (cached && Date.now() - cached.ts < RECENT_CACHE_TTL) {
    return cached.data;
  }

  // Try to filter by Mini App option ID if we know it
  const moduleOptionId = MODULE_TO_JIRA_ID[moduleSlug];

  const jqlParts = [`project = ${JIRA.PROJECT_KEY}`, `issuetype = Bug`];
  if (moduleOptionId && moduleSlug !== "general") {
    jqlParts.push(`"Mini App" = "${moduleOptionId}"`);
  }
  const jql = jqlParts.join(" AND ") + " ORDER BY updated DESC";

  const fields = ["summary", "status", "created"].join(",");
  const url = `${base()}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${limit}&fields=${fields}`;

  try {
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) {
      // Fallback: no module filter
      const fallbackJql = `project = ${JIRA.PROJECT_KEY} AND issuetype = Bug ORDER BY updated DESC`;
      const fallbackUrl = `${base()}/rest/api/3/search/jql?jql=${encodeURIComponent(fallbackJql)}&maxResults=${limit}&fields=${fields}`;
      const fallbackRes = await fetch(fallbackUrl, { headers: headers() });
      if (!fallbackRes.ok) return [];
      const fallbackData = await fallbackRes.json();
      return mapTickets(fallbackData.issues ?? []);
    }
    const data = await res.json();
    const tickets = mapTickets(data.issues ?? []);
    recentTicketsCache.set(moduleSlug, { data: tickets, ts: Date.now() });
    return tickets;
  } catch {
    return [];
  }
}

function mapTickets(issues: Array<{
  fields: {
    summary: string;
    status: { name: string; statusCategory?: { key?: string } };
    created: string;
  };
}>): RecentModuleTicket[] {
  return issues.map((issue) => {
    const statusName = issue.fields.status.name;
    const categoryKey = issue.fields.status.statusCategory?.key;
    return {
      summary: issue.fields.summary,
      friendlyStatus: mapJiraStatusToFriendly(statusName, categoryKey),
      createdAt: issue.fields.created,
    };
  });
}

// ─── Create issue ─────────────────────────────────────────────────────────────

// ─── Jira summary formatter ──────────────────────────────────────────────────

const JIRA_SUMMARY_MODULE_MAP: Record<string, string> = {
  users: "Users",
  time_off: "Time Off",
  chats: "Chats",
  news: "News",
  attendance: "Attendance",
  onboarding: "Onboarding",
  learning: "Learning",
  events: "Events",
  knowledge: "Knowledge",
  acknowledgements: "Acknowledgements",
  workflows: "Workflows",
  groups: "Groups",
  personal_documents: "Personal Documents",
  org_chart: "Org Chart",
  work_schedules: "Work Schedules",
};

export function formatJiraSummary(params: {
  platforms: string[];
  moduleSlug: string;
  whatHappened: string;
}): string {
  // 1. Platform — Admin > Web > Mobile
  const lower = params.platforms.map((p) => p.toLowerCase());
  const hasAdmin = lower.some((p) => p.includes("admin"));
  const hasWeb = lower.some((p) => p === "web");
  const hasMobile = lower.some((p) => p.includes("mobile") || p.includes("app móvil") || p.includes("app movil"));
  const platform = hasAdmin ? "Admin" : hasWeb ? "Web" : hasMobile ? "Mobile" : "Web";

  // 2. Module name
  const moduleName =
    JIRA_SUMMARY_MODULE_MAP[params.moduleSlug] ??
    (params.moduleSlug.charAt(0).toUpperCase() + params.moduleSlug.slice(1).replace(/_/g, " "));

  // 3. Description: first sentence, max 80 chars
  let desc = (params.whatHappened ?? "").trim();
  const firstSentence = desc.match(/^[^.!?\n]+/);
  if (firstSentence) desc = firstSentence[0].trim();
  if (desc.length > 80) {
    desc = desc.slice(0, 77).replace(/[\s.,;:]+$/, "") + "...";
  }

  // 4. Assemble and cap at 120 chars total
  const prefix = `[${platform}] ${moduleName} | `;
  let summary = prefix + desc;
  if (summary.length > 120) {
    const maxDesc = 120 - prefix.length - 3;
    desc = params.whatHappened.slice(0, maxDesc).replace(/[\s.,;:]+$/, "") + "...";
    summary = prefix + desc;
  }
  return summary;
}

export interface CreateIssueInput {
  summary: string;
  description: string;
  module: string;
  affectedUsersCount: "1" | "many";
  isBlocking: boolean;
  communityName: string;
  /** Optional: stored as label "instanceId_XXXX" for future filtering */
  instanceId?: number;
  /** When provided, overrides summary with standardized [Platform] Module | Desc format */
  platforms?: string[];
  whatHappened?: string;
}

export interface CreatedIssue {
  id: string;
  key: string; // e.g. "HUREP-42"
}

export async function createJiraIssue(
  input: CreateIssueInput
): Promise<CreatedIssue> {
  // Use standardized format when caller provides platforms + whatHappened
  const resolvedSummary =
    input.platforms?.length && input.whatHappened
      ? formatJiraSummary({
          platforms: input.platforms,
          moduleSlug: input.module,
          whatHappened: input.whatHappened,
        })
      : input.summary;

  const miniAppId = MODULE_TO_JIRA_ID[input.module];
  const communityLabel = input.communityName.trim()
    ? sanitizeLabelValue(input.communityName)
    : null;

  // Build labels array: community name + optional instanceId tag
  const labels: string[] = [];
  if (communityLabel) labels.push(communityLabel);
  if (input.instanceId) labels.push(`instanceId_${input.instanceId}`);

  const fullPayload = {
    fields: {
      project:   { key: JIRA.PROJECT_KEY },
      issuetype: { id: JIRA.ISSUE_TYPE_BUG_ID },
      summary:   resolvedSummary.slice(0, 254),
      description: adf(input.description),
      [JIRA.FIELDS.BUG_DESCRIPTION]: adf(input.description.slice(0, 32000)),
      ...(miniAppId ? { [JIRA.FIELDS.MINI_APP]: [{ id: miniAppId }] } : {}),
      ...(labels.length ? { [JIRA.FIELDS.AFFECTED_CLIENTS]: labels } : {}),
      [JIRA.FIELDS.BUG_BLOCKING]: {
        id: input.isBlocking ? JIRA.BLOCKING_YES : JIRA.BLOCKING_NO,
      },
      [JIRA.FIELDS.AFFECTED_USERS_COUNT]: {
        id: input.affectedUsersCount === "many" ? JIRA.USERS_MANY : JIRA.USERS_ONE,
      },
      [JIRA.FIELDS.BUG_TYPE]: [{ id: JIRA.BUG_TYPE_FUNCTIONAL }],
      [JIRA.FIELDS.BUG_REPRODUCED]: { id: JIRA.REPRODUCED_NO },
    },
  };

  let res = await fetch(`${base()}/rest/api/3/issue`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(fullPayload),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.warn("[jira] createJiraIssue full payload failed:", errText);

    const fallbackDescription =
      `${input.description}\n\n---\n` +
      `Community: ${input.communityName || "—"}\n` +
      `Module: ${input.module}\n` +
      `Blocking: ${input.isBlocking ? "Yes" : "No"}\n` +
      `Users affected: ${input.affectedUsersCount === "many" ? ">1" : "1"}`;

    res = await fetch(`${base()}/rest/api/3/issue`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        fields: {
          project:   { key: JIRA.PROJECT_KEY },
          issuetype: { id: JIRA.ISSUE_TYPE_BUG_ID },
          summary:   resolvedSummary.slice(0, 254),
          description: adf(fallbackDescription),
          [JIRA.FIELDS.BUG_DESCRIPTION]: adf(fallbackDescription.slice(0, 32000)),
          ...(labels.length ? { [JIRA.FIELDS.AFFECTED_CLIENTS]: labels } : {}),
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Jira create failed: ${await res.text()}`);
    }
  }

  const json = await res.json();
  return { id: json.id, key: json.key };
}

// ─── Search issues ────────────────────────────────────────────────────────────

export interface JiraIssueSummary {
  key: string;
  summary: string;
  module: string;
  status: FriendlyStatus;
  createdAt: string;
}

export interface SearchIssuesParams {
  /** Primary: search by instanceId label (most precise) */
  instanceId?: number;
  /** Secondary: filter by reporter email */
  adminEmail?: string;
  /** Fallback: match by community name label */
  communityName?: string;
}

/**
 * Search HUREP issues. Accepts either a params object or a plain string
 * (backwards-compatible — string treated as communityName).
 */
export async function searchIssuesForCommunity(
  params: SearchIssuesParams | string
): Promise<JiraIssueSummary[]> {
  const p: SearchIssuesParams =
    typeof params === "string" ? { communityName: params } : params;

  const jqlParts = [`project = ${JIRA.PROJECT_KEY}`, `issuetype = Bug`];

  if (p.instanceId) {
    // instanceId stored as label value in customfield_10046; must use = (not ~) for labels fields
    jqlParts.push(`cf[10046] = "instanceId_${p.instanceId}"`);
  } else if (p.adminEmail) {
    const safeEmail = p.adminEmail.replace(/"/g, '\\"');
    jqlParts.push(`reporter = "${safeEmail}"`);
  } else if (p.communityName?.trim()) {
    const safe = sanitizeLabelValue(p.communityName).replace(/"/g, '\\"');
    // customfield_10046 is a labels field; = does exact-value match against any element
    jqlParts.push(`cf[10046] = "${safe}"`);
  } else {
    // No filter → return empty (never dump all tickets)
    return [];
  }

  const jql = jqlParts.join(" AND ") + " ORDER BY created DESC";
  const fields = ["summary", "status", "created", JIRA.FIELDS.MINI_APP].join(",");
  const url = `${base()}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=50&fields=${fields}`;

  try {
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) {
      console.warn("[jira] searchIssues failed:", await res.text());
      return [];
    }
    const data = await res.json();
    return (data.issues ?? []).map(
      (issue: {
        key: string;
        fields: {
          summary: string;
          status: { name: string; statusCategory?: { key?: string } };
          created: string;
          [key: string]: unknown;
        };
      }) => {
        const miniAppRaw = issue.fields[JIRA.FIELDS.MINI_APP];
        // Prefer ID-based lookup (reliable) over display-value (locale-dependent)
        const optionId =
          Array.isArray(miniAppRaw) && miniAppRaw[0]?.id
            ? String(miniAppRaw[0].id)
            : null;
        const moduleSlug =
          optionId && JIRA_OPTION_TO_MODULE[optionId]
            ? JIRA_OPTION_TO_MODULE[optionId]
            : Array.isArray(miniAppRaw) && miniAppRaw[0]?.value
              ? (miniAppRaw[0].value as string).toLowerCase().replace(/\s+/g, "_")
              : "general";

        const statusName = issue.fields.status.name;
        const categoryKey = issue.fields.status.statusCategory?.key;
        const friendlyStatus = mapJiraStatusToFriendly(statusName, categoryKey);

        console.log(`[jira] ${issue.key}: status="${statusName}" cat="${categoryKey}" → ${friendlyStatus}`);

        return {
          key:       issue.key,
          summary:   issue.fields.summary,
          module:    moduleSlug,
          status:    friendlyStatus,
          createdAt: issue.fields.created,
        };
      }
    );
  } catch (err) {
    console.error("[jira] searchIssues error:", err);
    return [];
  }
}

// ─── Search issues by module (cross-community) ───────────────────────────────

/**
 * Search open HUREP Bug issues by module only (no community filter).
 * Used for cross-community duplicate detection: when two different communities
 * report the same bug, the second one finds the first community's ticket.
 * Limited to last 60 days. Never returns resolved tickets.
 */
export async function searchIssuesByModule(
  moduleSlug: string,
  limit = 30
): Promise<JiraIssueSummary[]> {
  const moduleOptionId = MODULE_TO_JIRA_ID[moduleSlug];
  const jqlParts = [
    `project = ${JIRA.PROJECT_KEY}`,
    `issuetype = Bug`,
    `statusCategory != Done`,
    `created >= -60d`,
  ];
  if (moduleOptionId && moduleSlug !== "general") {
    jqlParts.push(`"Mini App" = "${moduleOptionId}"`);
  }
  const jql = jqlParts.join(" AND ") + " ORDER BY created DESC";
  const fields = ["summary", "status", "created", JIRA.FIELDS.MINI_APP].join(",");
  const url = `${base()}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${limit}&fields=${fields}`;

  /** Parse raw Jira issues array into JiraIssueSummary[]. */
  const parseIssues = (issues: Array<{ key: string; fields: { summary: string; status: { name: string; statusCategory?: { key?: string } }; created: string; [key: string]: unknown } }>) =>
    issues.map((issue) => {
      const miniAppRaw = issue.fields[JIRA.FIELDS.MINI_APP];
      const optionId = Array.isArray(miniAppRaw) && miniAppRaw[0]?.id ? String(miniAppRaw[0].id) : null;
      const mod = optionId && JIRA_OPTION_TO_MODULE[optionId]
        ? JIRA_OPTION_TO_MODULE[optionId]
        : Array.isArray(miniAppRaw) && miniAppRaw[0]?.value
          ? (miniAppRaw[0].value as string).toLowerCase().replace(/\s+/g, "_")
          : "general";
      const statusName = issue.fields.status.name;
      const categoryKey = issue.fields.status.statusCategory?.key;
      return {
        key: issue.key,
        summary: issue.fields.summary,
        module: mod,
        status: mapJiraStatusToFriendly(statusName, categoryKey),
        createdAt: issue.fields.created,
      };
    });

  try {
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) return [];
    const data = await res.json();
    const issues = data.issues ?? [];

    // Retry once on 0 results — handles Jira JQL indexing latency for freshly
    // created tickets (can take up to ~30s to appear in JQL search results).
    // Only applies to cross-community dedup; getRecentTicketsForModule is intentionally
    // excluded to avoid adding 2s to every normal report flow.
    if (issues.length === 0) {
      await new Promise<void>((r) => setTimeout(r, 2000));
      const res2 = await fetch(url, { headers: headers() });
      if (!res2.ok) return [];
      const data2 = await res2.json();
      return parseIssues(data2.issues ?? []);
    }

    return parseIssues(issues);
  } catch (err) {
    console.error("[jira] searchIssuesByModule error:", err);
    return [];
  }
}

// ─── Add comment ──────────────────────────────────────────────────────────────

export async function addJiraComment(
  jiraKey: string,
  text: string
): Promise<void> {
  const res = await fetch(`${base()}/rest/api/3/issue/${jiraKey}/comment`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ body: adf(text) }),
  });
  if (!res.ok) {
    throw new Error(`Jira comment failed: ${await res.text()}`);
  }
}

// ─── parseAffectedClients helper ─────────────────────────────────────────────

export function parseAffectedClients(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return (raw as unknown[])
      .map((item) =>
        typeof item === "string"
          ? item
          : typeof item === "object" && item !== null
          ? ((item as Record<string, string>).value ||
              (item as Record<string, string>).name ||
              "")
          : ""
      )
      .filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(/[|,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

// ─── addCommunityToAffectedClients ───────────────────────────────────────────

export async function addCommunityToAffectedClients(
  jiraKey: string,
  communityToAdd: string
): Promise<boolean> {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10000);

    const res = await fetch(
      `${base()}/rest/api/3/issue/${jiraKey}?fields=${JIRA.FIELDS.AFFECTED_CLIENTS}`,
      { headers: headers(), signal: controller.signal }
    );
    if (!res.ok) return false;
    const data = await res.json();
    const currentRaw = data.fields?.[JIRA.FIELDS.AFFECTED_CLIENTS];
    const currentArr: string[] = parseAffectedClients(currentRaw);

    // Already present? (case-insensitive)
    if (currentArr.some((c) => c.toLowerCase() === communityToAdd.toLowerCase())) return true;

    const sanitized = sanitizeLabelValue(communityToAdd);
    // labels field: use update/add syntax
    const body = { update: { [JIRA.FIELDS.AFFECTED_CLIENTS]: [{ add: sanitized }] } };
    const putRes = await fetch(`${base()}/rest/api/3/issue/${jiraKey}`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(body),
    });
    return putRes.ok || putRes.status === 204;
  } catch (err) {
    console.error("[jira] addCommunityToAffectedClients failed:", err);
    return false;
  }
}

// ─── removeCommunityFromAffectedClients ──────────────────────────────────────

export async function removeCommunityFromAffectedClients(
  jiraKey: string,
  communityToRemove: string
): Promise<boolean> {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10000);

    const res = await fetch(
      `${base()}/rest/api/3/issue/${jiraKey}?fields=${JIRA.FIELDS.AFFECTED_CLIENTS}`,
      { headers: headers(), signal: controller.signal }
    );
    if (!res.ok) return false;
    const data = await res.json();
    const currentRaw = data.fields?.[JIRA.FIELDS.AFFECTED_CLIENTS];
    const currentArr: string[] = parseAffectedClients(currentRaw);

    const match = currentArr.find((c) => c.toLowerCase() === communityToRemove.toLowerCase());
    if (!match) return true; // already not there

    const body = { update: { [JIRA.FIELDS.AFFECTED_CLIENTS]: [{ remove: match }] } };
    const putRes = await fetch(`${base()}/rest/api/3/issue/${jiraKey}`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(body),
    });
    return putRes.ok || putRes.status === 204;
  } catch (err) {
    console.error("[jira] removeCommunityFromAffectedClients failed:", err);
    return false;
  }
}
