/**
 * GET /api/reports?communityName=Banco+Galicia
 * Returns recent HUREP issues for a community.
 * Falls back to mock data if Jira is unavailable.
 * ticketNumber is the sequential display number (1, 2, 3…).
 * commentRef is a signed token — NEVER returns the raw HUREP-XX key.
 */
import { NextRequest, NextResponse } from "next/server";
import { searchIssuesForCommunity } from "@/lib/jira";
import { signIssueRef } from "@/lib/token";
import { MOCK_TICKETS } from "@/lib/mock-data";

export async function GET(req: NextRequest) {
  const communityName = req.nextUrl.searchParams.get("communityName") ?? "";

  try {
    const issues = await searchIssuesForCommunity(communityName);

    if (issues.length > 0) {
      const tickets = issues.map((issue, idx) => ({
        id: issue.key, // internal id for React key (never shown)
        ticketNumber: idx + 1,
        summary: issue.summary,
        module: issue.module,
        status: issue.status,
        date: issue.createdAt.slice(0, 10),
        commentRef: signIssueRef(issue.key),
        // Satisfy full shape expected by component
        description: issue.summary,
        classification: "bug_confirmed" as const,
        platforms: [] as string[],
        isBlocking: false,
        usersAffected: "1" as const,
        evidenceUrls: [] as string[],
      }));

      return NextResponse.json(tickets);
    }
  } catch (err) {
    console.warn("[reports] Jira search failed, using mock:", err);
  }

  // Fallback: mock tickets with signed refs
  const communityId = req.nextUrl.searchParams.get("communityId") ?? "";
  const mock = MOCK_TICKETS
    .filter((t) => !communityId || t.communityId === communityId)
    .map(({ jiraKey, ...rest }) => ({
      ...rest,
      commentRef: signIssueRef(jiraKey),
    }));

  return NextResponse.json(mock);
}
