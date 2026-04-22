// TODO: Real implementation
// 1. Read JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN from env
// 2. GET https://{JIRA_BASE_URL}/rest/api/3/issue/{jiraKey}
//    Map response.fields.status.name via mapJiraStatusToFriendly() from lib/mappings.ts
//
// Query params: ?ticketNumber=N
// Response: { status: FriendlyStatus }

import { NextRequest, NextResponse } from "next/server";
import { MOCK_TICKETS } from "@/lib/mock-data";
import type { FriendlyStatus } from "@/lib/mappings";

export async function GET(req: NextRequest) {
  const ticketNumber = Number(req.nextUrl.searchParams.get("ticketNumber"));
  const ticket = MOCK_TICKETS.find((t) => t.ticketNumber === ticketNumber);
  const status: FriendlyStatus = ticket?.status ?? "reported";
  return NextResponse.json({ status });
}
