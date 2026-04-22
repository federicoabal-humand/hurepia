/**
 * GET /api/jira/status?commentRef=<signed-ref>
 * Returns the friendly status of a Jira issue identified by a signed commentRef.
 * Response: { status: FriendlyStatus }
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyIssueRef } from "@/lib/token";
import { mapJiraStatusToFriendly } from "@/lib/mappings";

function jiraHeaders() {
  const base64 = Buffer.from(
    `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`
  ).toString("base64");
  return {
    Authorization: `Basic ${base64}`,
    Accept: "application/json",
  };
}

export async function GET(req: NextRequest) {
  const commentRef = req.nextUrl.searchParams.get("commentRef") ?? "";

  const jiraKey = verifyIssueRef(commentRef);
  if (!jiraKey) {
    return NextResponse.json({ error: "Invalid reference" }, { status: 403 });
  }

  try {
    const base = process.env.JIRA_BASE_URL ?? "https://humand.atlassian.net";
    const res = await fetch(
      `${base}/rest/api/3/issue/${jiraKey}?fields=status`,
      { headers: jiraHeaders() }
    );

    if (!res.ok) {
      return NextResponse.json({ status: "reported" });
    }

    const data = await res.json();
    const statusName: string = data.fields?.status?.name ?? "";
    return NextResponse.json({ status: mapJiraStatusToFriendly(statusName) });
  } catch {
    return NextResponse.json({ status: "reported" });
  }
}
