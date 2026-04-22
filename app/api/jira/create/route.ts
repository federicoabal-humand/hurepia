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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { summary, description, module, affectedUsersCount, isBlocking, communityName } = body;

    const issue = await createJiraIssue({
      summary:            summary ?? description?.slice(0, 100) ?? "Bug report",
      description:        description ?? summary ?? "",
      module:             module ?? "general",
      affectedUsersCount: affectedUsersCount ?? "1",
      isBlocking:         !!isBlocking,
      communityName:      communityName ?? "",
    });

    // Parse the sequential number directly from the Jira key (HUREP-7 → 7)
    const keyParts    = issue.key.split("-");
    const ticketNumber = keyParts.length === 2 ? parseInt(keyParts[1], 10) : 1;

    // Sign the jiraKey — client gets an opaque ref, never sees HUREP-XX
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
