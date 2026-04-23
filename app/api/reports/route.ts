/**
 * GET /api/reports
 *
 * Query params (in priority order):
 *   instanceId       — most precise; filters by "instanceId_XXXX" label
 *   adminEmail       — filters by reporter email
 *   communityName    — filters by community name label (sanitized)
 *
 * Returns HUREP issues for the requesting community.
 * - commentRef is a signed token; raw HUREP-XX keys are NEVER returned.
 * - ticketNumber is a sequential display number (1, 2, 3…).
 */
import { NextRequest, NextResponse } from "next/server";
import { searchIssuesForCommunity } from "@/lib/jira";
import { signIssueRef } from "@/lib/token";
import { resolveCommunityInternal } from "@/lib/notion";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const instanceIdStr = sp.get("instanceId") ?? "";
  const adminEmail = sp.get("adminEmail") ?? "";
  const communityNameRaw = sp.get("communityName") ?? "";

  const instanceId = instanceIdStr ? parseInt(instanceIdStr, 10) : undefined;

  // Must have at least one filter
  if (!instanceId && !adminEmail.trim() && !communityNameRaw.trim()) {
    return NextResponse.json(
      { error: "communityName, instanceId, or adminEmail is required" },
      { status: 400 }
    );
  }

  // ── If using communityName: try to resolve via Notion for better accuracy ──
  let resolvedCommunityName = communityNameRaw;
  if (!instanceId && !adminEmail && communityNameRaw) {
    try {
      const notionMatch = await resolveCommunityInternal(communityNameRaw);
      if (notionMatch.matched && notionMatch.canonicalName) {
        resolvedCommunityName = notionMatch.canonicalName;
      }
    } catch {
      // Notion unavailable — use raw name (fail open)
    }
  }

  try {
    const issues = await searchIssuesForCommunity({
      instanceId,
      adminEmail: adminEmail || undefined,
      communityName: !instanceId && !adminEmail ? resolvedCommunityName : undefined,
    });

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
