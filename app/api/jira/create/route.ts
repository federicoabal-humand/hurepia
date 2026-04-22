/**
 * POST /api/jira/create
 * Creates a Jira issue in HUREP project and returns a signed commentRef.
 * NEVER returns the raw HUREP-XX key to the frontend.
 *
 * Body: { summary, description, module, affectedUsersCount, isBlocking, communityName }
 * Response: { ticketNumber, commentRef }
 */
import { NextRequest, NextResponse } from "next/server";
import { createJiraIssue } from "@/lib/jira";
import { signIssueRef } from "@/lib/token";
import { searchIssuesForCommunity } from "@/lib/jira";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { summary, description, module, affectedUsersCount, isBlocking, communityName } = body;

    const issue = await createJiraIssue({
      summary: summary ?? description?.slice(0, 100) ?? "Bug report",
      description: description ?? summary ?? "",
      module: module ?? "general",
      affectedUsersCount: affectedUsersCount ?? "1",
      isBlocking: !!isBlocking,
      communityName: communityName ?? "",
    });

    // Get sequential ticket number: count existing issues + 1
    let ticketNumber = 1;
    try {
      const existing = await searchIssuesForCommunity(communityName ?? "");
      // The new issue is already in Jira, so count includes it; subtract 1 for index, add 1 for display
      ticketNumber = Math.max(existing.length, 1);
    } catch {
      // best-effort
    }

    // Sign the jiraKey — client gets an opaque ref, never HUREP-XX
    const commentRef = signIssueRef(issue.key);

    return NextResponse.json({ ticketNumber, commentRef });
  } catch (err) {
    console.error("[jira/create] error:", err);
    return NextResponse.json(
      { error: "Failed to create issue" },
      { status: 500 }
    );
  }
}
