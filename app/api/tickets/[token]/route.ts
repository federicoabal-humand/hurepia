import { NextRequest, NextResponse } from "next/server";
import { verifyIssueRef } from "@/lib/token";
import { removeCommunityFromAffectedClients, addJiraComment } from "@/lib/jira";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token;
  const jiraKey = verifyIssueRef(token);
  if (!jiraKey) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const adminCommunity = (body.adminCommunity ?? "").trim().slice(0, 100);
  const adminEmail = (body.adminEmail ?? "unknown").trim().slice(0, 200);
  const friendlyStatus = body.friendlyStatus ?? "";

  if (friendlyStatus !== "resolved") {
    return NextResponse.json(
      { error: "Solo podés quitar tickets resueltos de tu historial" },
      { status: 400 }
    );
  }

  if (!adminCommunity) {
    return NextResponse.json({ error: "adminCommunity is required" }, { status: 400 });
  }

  const success = await removeCommunityFromAffectedClients(jiraKey, adminCommunity);

  if (success) {
    await addJiraComment(
      jiraKey,
      `[HuReport AI] Admin (${adminEmail}) from community '${adminCommunity}' removed this ticket from their history. Ticket remains active for other affected communities.`
    ).catch(() => {});
  }

  return NextResponse.json({ success });
}
