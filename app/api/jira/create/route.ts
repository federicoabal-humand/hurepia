// TODO: Real implementation
// 1. Read JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN from env
// 2. POST to https://{JIRA_BASE_URL}/rest/api/3/issue with:
//    - project: { key: JIRA.PROJECT_KEY }, issuetype: { id: JIRA.ISSUE_TYPE_BUG_ID }
//    - customfield_10108 (BUG_DESCRIPTION), customfield_10071 (MINI_APP),
//      customfield_10100 (BUG_TYPE), customfield_10112 (BUG_BLOCKING),
//      customfield_10113 (AFFECTED_USERS_COUNT) from JIRA.FIELDS in lib/mappings.ts
// 3. Return ticketNumber (sequential counter) — NEVER expose jiraKey in UI
//
// Body: { community, module, platforms, whatHappened, isBlocking, usersAffected, url, email }
// Response: { ticketNumber: number }

import { NextRequest, NextResponse } from "next/server";
import { MOCK_TICKETS } from "@/lib/mock-data";

export async function POST(_req: NextRequest) {
  await new Promise((r) => setTimeout(r, 500));
  return NextResponse.json({ ticketNumber: MOCK_TICKETS.length + 1 });
}
