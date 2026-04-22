/**
 * lib/jira.ts
 * Jira Cloud REST API v3 helpers for HuReport AI.
 *
 * Env: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN
 */
import { JIRA, mapJiraStatusToFriendly } from "./mappings";
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
  const fullPayload = {
    fields: {
      project: { key: JIRA.PROJECT_KEY },
      issuetype: { id: JIRA.ISSUE_TYPE_BUG_ID },
      summary: input.summary.slice(0, 254),
      description: adf(input.description),
      // Custom fields — best-effort; Jira returns 400 if a field rejects the value
      [JIRA.FIELDS.BUG_DESCRIPTION]: input.description.slice(0, 32000),
      [JIRA.FIELDS.MINI_APP]: input.module,
      [JIRA.FIELDS.AFFECTED_CLIENTS]: input.communityName,
    },
  };

  let res = await fetch(`${base()}/rest/api/3/issue`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(fullPayload),
  });

  // If custom fields caused a 400, retry with only mandatory fields
  if (!res.ok) {
    const errText = await res.text();
    console.warn("[jira] createJiraIssue full payload failed:", errText);

    res = await fetch(`${base()}/rest/api/3/issue`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        fields: {
          project: { key: JIRA.PROJECT_KEY },
          issuetype: { id: JIRA.ISSUE_TYPE_BUG_ID },
          summary: input.summary.slice(0, 254),
          description: adf(
            `${input.description}\n\nCommunity: ${input.communityName}\nModule: ${input.module}\nBlocking: ${input.isBlocking}\nUsers: ${input.affectedUsersCount}`
          ),
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
  // communityName is used for display; JQL fetches all recent HUREP issues
  // TODO: once AFFECTED_CLIENTS custom field is indexed, add:
  //   AND "${JIRA.FIELDS.AFFECTED_CLIENTS}" ~ "${communityName}"
  _communityName: string
): Promise<JiraIssueSummary[]> {
  const jql = `project = ${JIRA.PROJECT_KEY} ORDER BY created DESC`;
  const fields = [
    "summary",
    "status",
    "created",
    JIRA.FIELDS.MINI_APP,
  ].join(",");

  const url = `${base()}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=20&fields=${fields}`;

  try {
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) {
      console.warn("[jira] searchIssues failed:", await res.text());
      return [];
    }
    const data = await res.json();
    const issues: JiraIssueSummary[] = (data.issues ?? []).map(
      (issue: {
        key: string;
        fields: {
          summary: string;
          status: { name: string };
          created: string;
          [key: string]: unknown;
        };
      }) => ({
        key: issue.key,
        summary: issue.fields.summary,
        module: (issue.fields[JIRA.FIELDS.MINI_APP] as string) ?? "general",
        status: mapJiraStatusToFriendly(issue.fields.status.name),
        createdAt: issue.fields.created,
      })
    );
    return issues;
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
