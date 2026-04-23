/**
 * lib/jira.ts
 * Jira Cloud REST API v3 helpers for HuReport AI.
 *
 * Env: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN
 */
import { JIRA, MODULE_TO_JIRA_ID, mapJiraStatusToFriendly } from "./mappings";
import type { FriendlyStatus } from "./mappings";

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

export interface CreateIssueInput {
  summary: string;
  description: string;
  module: string;
  affectedUsersCount: "1" | "many";
  isBlocking: boolean;
  communityName: string;
  /** Optional: stored as label "instanceId_XXXX" for future filtering */
  instanceId?: number;
}

export interface CreatedIssue {
  id: string;
  key: string; // e.g. "HUREP-42"
}

export async function createJiraIssue(
  input: CreateIssueInput
): Promise<CreatedIssue> {
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
      summary:   input.summary.slice(0, 254),
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
          summary:   input.summary.slice(0, 254),
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
    jqlParts.push(`labels = "instanceId_${p.instanceId}"`);
  } else if (p.adminEmail) {
    const safeEmail = p.adminEmail.replace(/"/g, '\\"');
    jqlParts.push(`reporter = "${safeEmail}"`);
  } else if (p.communityName?.trim()) {
    const safe = sanitizeLabelValue(p.communityName).replace(/"/g, '\\"');
    jqlParts.push(`"Affected Clients" = "${safe}"`);
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
        const moduleSlug =
          Array.isArray(miniAppRaw) && miniAppRaw[0]?.value
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
