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
import { searchAllIssuesForCommunity } from "@/lib/jira";
import { signIssueRef, verifyIssueRef } from "@/lib/token";
import { resolveCommunityInternal } from "@/lib/notion";
import { mapJiraStatusToFriendly } from "@/lib/mappings";

/** Direct Jira REST call — bypasses JQL indexing delay for freshly created tickets */
async function fetchIssueByKey(jiraKey: string) {
  const base = process.env.JIRA_BASE_URL ?? "https://humand.atlassian.net";
  const b64 = Buffer.from(
    `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`
  ).toString("base64");
  const headers = {
    Authorization: `Basic ${b64}`,
    Accept: "application/json",
  };
  try {
    const res = await fetch(
      `${base}/rest/api/3/issue/${jiraKey}?fields=summary,status,created,customfield_10059`,
      { headers }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const statusName: string = data.fields?.status?.name ?? "";
    const categoryKey: string = data.fields?.status?.statusCategory?.key ?? "";
    return {
      key: jiraKey,
      summary: data.fields?.summary ?? "",
      module: "general" as string,
      status: mapJiraStatusToFriendly(statusName, categoryKey),
      createdAt: data.fields?.created ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const instanceIdStr = sp.get("instanceId") ?? "";
  const adminEmail = sp.get("adminEmail") ?? "";
  const communityNameRaw = sp.get("communityName") ?? "";
  const freshRef = sp.get("freshRef") ?? "";

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
    const issues = await searchAllIssuesForCommunity({
      instanceId,
      adminEmail: adminEmail || undefined,
      communityName: !instanceId && !adminEmail ? resolvedCommunityName : undefined,
    });

    // If a freshRef was passed, resolve the key and inject the issue if JQL hasn't indexed it yet
    let freshKey: string | null = null;
    if (freshRef) {
      freshKey = verifyIssueRef(freshRef);
      if (freshKey && !issues.some((i) => i.key === freshKey)) {
        const fresh = await fetchIssueByKey(freshKey);
        if (fresh) issues.unshift(fresh);
      }
    }

    const tickets = issues.map((issue, idx) => {
      const commentRef = signIssueRef(issue.key);
      return {
        // id = opaque signed token — NEVER the raw HUREP-XX key
        id: commentRef,
        ticketNumber: idx + 1,
        summary: issue.summary,
        module: issue.module,
        status: issue.status,
        date: issue.createdAt.slice(0, 10),
        commentRef,
        description: issue.summary,
        classification: "bug_confirmed" as const,
        platforms: [] as string[],
        isBlocking: false,
        usersAffected: "1" as const,
        evidenceUrls: [] as string[],
      };
    });

    return NextResponse.json(tickets);
  } catch (err) {
    console.error("[reports] Jira search failed:", err);
    return NextResponse.json([]);
  }
}
