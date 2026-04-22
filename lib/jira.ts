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

// ─── Create issue ─────────────────────────────────────────────────────────────

export interface CreateIssueInput {
  summary: string;
  description: string;
  module: string;
  affectedUsersCount: "1" | "many";
  isBlocking: boolean;
  communityName: string;
}

export interface CreatedIssue {
  id: string;
  key: string; // e.g. "HUREP-42"
}

export async function createJiraIssue(
  input: CreateIssueInput
): Promise<CreatedIssue> {
  const miniAppId = MODULE_TO_JIRA_ID[input.module];

  const fullPayload = {
    fields: {
      project:   { key: JIRA.PROJECT_KEY },
      issuetype: { id: JIRA.ISSUE_TYPE_BUG_ID }, // "10060" = "Error" (Bug) in HUREP
      summary:   input.summary.slice(0, 254),
      description: adf(input.description),

      // Bug Description — textarea field accepts plain string
      [JIRA.FIELDS.BUG_DESCRIPTION]: input.description.slice(0, 32000),

      // Mini App — multicheckboxes: array of option objects with id
      ...(miniAppId
        ? { [JIRA.FIELDS.MINI_APP]: [{ id: miniAppId }] }
        : {}),

      // Affected Clients — labels field: array of strings
      ...(input.communityName.trim()
        ? { [JIRA.FIELDS.AFFECTED_CLIENTS]: [input.communityName.trim()] }
        : {}),

      // Bug Blocking — radiobutton: single option by id
      [JIRA.FIELDS.BUG_BLOCKING]: {
        id: input.isBlocking ? JIRA.BLOCKING_YES : JIRA.BLOCKING_NO,
      },

      // Affected Users Count — radiobutton: single option by id
      [JIRA.FIELDS.AFFECTED_USERS_COUNT]: {
        id: input.affectedUsersCount === "many" ? JIRA.USERS_MANY : JIRA.USERS_ONE,
      },

      // Bug Type — default to "Functional"
      [JIRA.FIELDS.BUG_TYPE]: [{ id: JIRA.BUG_TYPE_FUNCTIONAL }],

      // Bug Reproduced — default to "No" (reported by admin, not yet reproduced by eng)
      [JIRA.FIELDS.BUG_REPRODUCED]: { id: JIRA.REPRODUCED_NO },
    },
  };

  let res = await fetch(`${base()}/rest/api/3/issue`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(fullPayload),
  });

  // If any custom field caused a 400, retry with only the mandatory fields
  // so the ticket is always created even if custom fields have schema mismatches.
  if (!res.ok) {
    const errText = await res.text();
    console.warn("[jira] createJiraIssue full payload failed:", errText);

    const fallbackDescription =
      `${input.description}\n\n` +
      `---\n` +
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
          [JIRA.FIELDS.BUG_DESCRIPTION]: fallbackDescription.slice(0, 32000),
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

export async function searchIssuesForCommunity(
  _communityName: string
): Promise<JiraIssueSummary[]> {
  const jql = `project = ${JIRA.PROJECT_KEY} ORDER BY created DESC`;
  const fields = ["summary", "status", "created", JIRA.FIELDS.MINI_APP].join(",");
  const url = `${base()}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=20&fields=${fields}`;

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
          status: { name: string };
          created: string;
          [key: string]: unknown;
        };
      }) => {
        // MINI_APP is a multicheckboxes array — extract first value label
        const miniAppRaw = issue.fields[JIRA.FIELDS.MINI_APP];
        const module =
          Array.isArray(miniAppRaw) && miniAppRaw[0]?.value
            ? (miniAppRaw[0].value as string).toLowerCase().replace(/\s+/g, "_")
            : "general";

        return {
          key:       issue.key,
          summary:   issue.fields.summary,
          module,
          status:    mapJiraStatusToFriendly(issue.fields.status.name),
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
