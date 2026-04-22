// TODO: Real implementation
// 1. Read NOTION_TOKEN from env
// 2. Query NOTION_DB.CLIENTS_INPUTS from lib/mappings.ts filtered by communityId
// 3. Map Notion page properties to MockTicket shape
// 4. Call mapJiraStatusToFriendly() for each ticket status
//
// Query params: ?communityId=X
// Response: MockTicket[]

import { NextRequest, NextResponse } from "next/server";
import { MOCK_TICKETS } from "@/lib/mock-data";

export async function GET(req: NextRequest) {
  const communityId = req.nextUrl.searchParams.get("communityId");
  const tickets = communityId
    ? MOCK_TICKETS.filter((t) => t.communityId === communityId)
    : MOCK_TICKETS;
  return NextResponse.json(tickets);
}
