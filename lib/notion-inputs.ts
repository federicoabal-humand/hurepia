// ⚠️ DRY-RUN MODE — ACTIVE UNTIL POST-HACKATHON APPROVAL
//
// This lib contains functions that in production would write to the Clients Inputs DB in Notion.
// During the hackathon, ALL write functions are redirected to create "CI-Mock" tickets in Jira HUREP
// so as not to contaminate productive data.
//
// When the project is approved:
// 1. Set ALLOW_NOTION_WRITES = true
// 2. Activate the *_NOTION_REAL functions (commented at the bottom)
// 3. CI-Mock Jira tickets stop being created

const ALLOW_NOTION_WRITES = false;

function assertNotionWritesAllowed() {
  if (!ALLOW_NOTION_WRITES) {
    throw new Error(
      "Notion writes disabled in dry-run mode. " +
        "Set ALLOW_NOTION_WRITES=true only after project approval."
    );
  }
}

// Suppress "never used" warning for the guard we keep for future use
void assertNotionWritesAllowed;

import { addCommunityToAffectedClients, sanitizeLabelValue } from "./jira";
import { JIRA } from "./mappings";

const JIRA_TASK_TYPE_ID = "10003"; // Standard Jira Task; fallback to Bug with CI-Mock label

const MODULE_ABBREV: Record<string, string> = {
  time_off: "TO",
  users: "US",
  onboarding: "ON",
  learning: "LR",
  news: "NW",
  chats: "CH",
  events: "EV",
  work_schedules: "WS",
  attendance: "AT",
  people_experience: "PE",
  personal_documents: "PD",
  knowledge: "KN",
  acknowledgements: "AK",
  org_chart: "OC",
  groups: "GR",
  marketplace: "MK",
  service_management: "SM",
  workflows: "WF",
  general: "GN",
};

export function generateInputTitle(moduleSlug: string, whatExpected: string): string {
  const prefix = MODULE_ABBREV[moduleSlug] ?? moduleSlug.slice(0, 2).toUpperCase();
  return `${prefix} | ${whatExpected.trim().slice(0, 150)}`;
}

function adf(text: string) {
  return {
    type: "doc",
    version: 1,
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

function base() {
  return process.env.JIRA_BASE_URL ?? "https://humand.atlassian.net";
}

function headers() {
  const b64 = Buffer.from(
    `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`
  ).toString("base64");
  return {
    Authorization: `Basic ${b64}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function createClientInputMock(data: {
  input: string;
  description: string;
  communityNameRaw: string;
  moduleSlug: string;
  detectedLanguage?: string;
}): Promise<{ jiraKey: string; ticketNumber: number } | null> {
  try {
    const summary = ("[CI MOCK] " + data.input).slice(0, 240);
    const communityLabel = sanitizeLabelValue(data.communityNameRaw);
    const fullDesc = `⚠️ MOCK CLIENT INPUT — In production this record would go to the Clients Inputs DB in Notion (ID: 400416b1-ae3b-421f-9444-093dd40c7373). Created here in Jira HUREP for demo/hackathon without contaminating productive data.\n\n---\n\nClient: ${data.communityNameRaw}\nModule: ${data.moduleSlug}\nLanguage: ${data.detectedLanguage ?? "es"}\n\nDescription:\n${data.description}`;

    const labels = ["HuReport-AI", "CI-Mock", "feature_request", `module-${data.moduleSlug}`];
    if (communityLabel) labels.push(communityLabel);

    // Try Task first, fallback to Bug
    const tryCreate = async (issueTypeId: string) => {
      const body = {
        fields: {
          project: { key: JIRA.PROJECT_KEY },
          issuetype: { id: issueTypeId },
          summary,
          description: adf(fullDesc),
          [JIRA.FIELDS.AFFECTED_CLIENTS]: labels,
        },
      };
      const res = await fetch(`${base()}/rest/api/3/issue`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      return res.json();
    };

    let json = await tryCreate(JIRA_TASK_TYPE_ID);
    if (!json) json = await tryCreate(JIRA.ISSUE_TYPE_BUG_ID);
    if (!json) return null;

    const keyParts = (json.key as string).split("-");
    const ticketNumber = keyParts.length === 2 ? parseInt(keyParts[1], 10) : 0;
    return { jiraKey: json.key as string, ticketNumber };
  } catch (err) {
    console.error("[notion-inputs] createClientInputMock failed:", err);
    return null;
  }
}

export async function searchSimilarClientInputsMock(
  moduleSlug: string,
  keywordsOriginal: string[],
  keywordsEs: string[],
  keywordsEn: string[]
): Promise<
  Array<{ jiraKey: string; summary: string; currentCommunities: string[]; score: number }>
> {
  try {
    // customfield_10046 is a labels field — use cf[10046] = for exact value match
    const jql = `project = ${JIRA.PROJECT_KEY} AND cf[10046] = "CI-Mock" AND cf[10046] = "module-${moduleSlug}" AND statusCategory != Done AND created >= -90d ORDER BY created DESC`;
    const url = `${base()}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=20&fields=summary,${JIRA.FIELDS.AFFECTED_CLIENTS}`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) return [];
    const data = await res.json();

    function naiveTokens(text: string): string[] {
      return text
        .toLowerCase()
        .replace(/[^a-z0-9áéíóúñüàèìòùâêîôûäëïöü\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3);
    }
    function matchScore(keywords: string[], summary: string): number {
      const tokens = new Set(naiveTokens(summary));
      return keywords.filter((k) => tokens.has(k.toLowerCase())).length;
    }

    const results: Array<{
      jiraKey: string;
      summary: string;
      currentCommunities: string[];
      score: number;
    }> = [];
    for (const issue of data.issues ?? []) {
      const summary = issue.fields.summary as string;
      const raw = issue.fields[JIRA.FIELDS.AFFECTED_CLIENTS];
      const currentCommunities: string[] = Array.isArray(raw)
        ? raw.map((x: unknown) => (typeof x === "string" ? x : ""))
        : [];
      const s1 = matchScore(keywordsOriginal, summary);
      const s2 = matchScore(keywordsEs, summary);
      const s3 = matchScore(keywordsEn, summary);
      const score = Math.max(s1, s2, s3);
      if (score >= 3) results.push({ jiraKey: issue.key as string, summary, currentCommunities, score });
    }
    return results.sort((a, b) => b.score - a.score).slice(0, 3);
  } catch (err) {
    console.error("[notion-inputs] searchSimilarClientInputsMock failed:", err);
    return [];
  }
}

export async function addCommunityAsAffectedClientMock(
  jiraKey: string,
  communityToAdd: string
): Promise<boolean> {
  return addCommunityToAffectedClients(jiraKey, communityToAdd);
}
