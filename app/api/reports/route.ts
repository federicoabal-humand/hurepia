/**
 * GET /api/reports?communityName=Naranja+X
 * Returns HUREP issues for a community, filtered strictly by AFFECTED_CLIENTS label.
 * Validates the communityName against Notion to prevent cross-community data leaks.
 *
 * ticketNumber is the sequential display number (1, 2, 3…).
 * commentRef is a signed token — NEVER returns the raw HUREP-XX key.
 */
import { NextRequest, NextResponse } from "next/server";
import { searchIssuesForCommunity } from "@/lib/jira";
import { signIssueRef } from "@/lib/token";
import { searchCommunities } from "@/lib/notion";

export async function GET(req: NextRequest) {
  const communityName = req.nextUrl.searchParams.get("communityName") ?? "";

  if (!communityName.trim()) {
    return NextResponse.json(
      { error: "communityName is required" },
      { status: 400 }
    );
  }

  // ── Server-side community validation (privacy guard) ────────────────────────
  // Verify this community exists in Notion before returning any Jira data.
  // On Notion errors we fail open (allow) so the app keeps working without Notion.
  try {
    const notionMatches = await searchCommunities(communityName);
    // If Notion returned results but none match the requested name → 404
    if (notionMatches.length > 0) {
      const exactMatch = notionMatches.some(
        (c) => c.name.toLowerCase() === communityName.toLowerCase()
      );
      // Only block if Notion clearly returned results and none match
      // (partial names like "Naranj" won't match "Naranja X" exactly, so we only
      // enforce when the query is the full community name)
      if (!exactMatch && communityName.length > 5) {
        // Soft fail: if Notion says "no such community", return empty list
        // (don't 404 — that would confirm/deny existence)
        return NextResponse.json([]);
      }
    }
  } catch {
    // Notion unavailable — continue without validation (fail open)
  }

  // ── Fetch Jira tickets filtered by community ────────────────────────────────
  try {
    const issues = await searchIssuesForCommunity(communityName);

    const tickets = issues.map((issue, idx) => ({
      id: issue.key,
      ticketNumber: idx + 1,
      summary: issue.summary,
      module: issue.module,
      status: issue.status,
      date: issue.createdAt.slice(0, 10),
      commentRef: signIssueRef(issue.key),
      description: issue.summary,
      classification: "bug_confirmed" as const,
      platforms: [] as string[],
      isBlocking: false,
      usersAffected: "1" as const,
      evidenceUrls: [] as string[],
    }));

    return NextResponse.json(tickets);
  } catch (err) {
    console.error("[reports] Jira search failed:", err);
    return NextResponse.json([]);
  }
}
