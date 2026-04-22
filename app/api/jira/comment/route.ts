// TODO: Real implementation
// 1. Resolve ticketNumber → jiraKey (lookup in DB / Notion)
// 2. POST to https://{JIRA_BASE_URL}/rest/api/3/issue/{jiraKey}/comment
//    Body in Atlassian Document Format
//
// Body: { ticketNumber: number, comment: string }
// Response: { ok: true }

import { NextRequest, NextResponse } from "next/server";

export async function POST(_req: NextRequest) {
  await new Promise((r) => setTimeout(r, 300));
  return NextResponse.json({ ok: true });
}
