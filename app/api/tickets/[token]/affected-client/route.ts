import { NextRequest, NextResponse } from "next/server";
import { verifyIssueRef } from "@/lib/token";
import { addCommunityToAffectedClients, addJiraComment } from "@/lib/jira";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token;
  const jiraKey = verifyIssueRef(token);
  if (!jiraKey) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed } = rateLimit(`affected-client:${ip}`, 5, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const communityNameToAdd = (body.communityNameToAdd ?? "").trim().slice(0, 100);
  if (!communityNameToAdd) {
    return NextResponse.json({ error: "communityNameToAdd is required" }, { status: 400 });
  }
  // Basic sanitization
  if (/<|>|script|javascript/i.test(communityNameToAdd)) {
    return NextResponse.json({ error: "Invalid community name" }, { status: 400 });
  }

  const wasAdded = await addCommunityToAffectedClients(jiraKey, communityNameToAdd);

  if (wasAdded) {
    const adminEmail = (body.adminEmail ?? "unknown").slice(0, 200);
    await addJiraComment(
      jiraKey,
      `[HuReport AI] Admin (${adminEmail}) added community '${communityNameToAdd}' as affected client.`
    ).catch(() => {});
  }

  return NextResponse.json({ success: true, wasAdded });
}
