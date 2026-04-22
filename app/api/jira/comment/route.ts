/**
 * POST /api/jira/comment
 * Adds a comment to a Jira issue identified by a signed commentRef.
 * Body: { commentRef, text }
 * Response: { ok: true } | 403
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyIssueRef } from "@/lib/token";
import { addJiraComment } from "@/lib/jira";

export async function POST(req: NextRequest) {
  try {
    const { commentRef, text } = await req.json();

    if (!commentRef || !text?.trim()) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const jiraKey = verifyIssueRef(commentRef);
    if (!jiraKey) {
      return NextResponse.json({ error: "Invalid reference" }, { status: 403 });
    }

    await addJiraComment(jiraKey, text.trim());
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[jira/comment] error:", err);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}
