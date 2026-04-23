/**
 * GET /api/reports?communityName=Naranja+X
 * Returns HUREP issues for a community.
 * - Resolves the nameRaw against Notion internally (invisible to frontend).
 * - If matched: queries Jira by canonical name (sanitized label).
 * - If not matched: queries Jira by the raw name as typed.
 * - ticketNumber is the sequential display number (1, 2, 3…).
 * - commentRef is a signed token — NEVER returns the raw HUREP-XX key.
 */
import { NextRequest, NextResponse } from "next/server";
import { searchIssuesForCommunity } from "@/lib/jira";
import { signIssueRef } from "@/lib/token";
import { resolveCommunityInternal } from "@/lib/notion";

export async function GET(req: NextRequest) {
  const communityNameRaw = req.nextUrl.searchParams.get("communityName") ?? "";

  if (!communityNameRaw.trim()) {
    return NextResponse.json(
      { error: "communityName is required" },
      { status: 400 }
    );
  }

  // ── Resolve community internally ────────────────────────────────────────────
  // If name matches Notion → use canonical name for JQL (better accuracy).
  // If no match → use raw name as typed (ticket still visible to this user).
  // Match result is NEVER sent to the frontend.
  let communityName = communityNameRaw;
  try {
    const resolved = await resolveCommunityInternal(communityNameRaw);
    if (resolved.matched && resolved.canonicalName) {
      communityName = resolved.canonicalName;
    }
  } catch {
    // Notion unavailable — use raw name (fail open)
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
