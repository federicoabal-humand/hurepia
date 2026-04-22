/**
 * POST /api/duplicates
 * Checks for existing Jira issues or Notion feature requests matching the report.
 * Runs Jira + Notion searches in parallel, matches by keywords.
 *
 * Body: { keywords: string[], communityName?: string }
 * Response: { matches: { type, title, commentRef? }[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { searchIssuesForCommunity } from "@/lib/jira";
import { searchClientsInputs } from "@/lib/notion";
import { signIssueRef } from "@/lib/token";

interface DuplicateMatch {
  type: "jira" | "notion";
  title: string;
  commentRef?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { keywords = [], communityName = "" } = await req.json();

    const terms: string[] = keywords
      .map((k: string) => k.toLowerCase().trim())
      .filter((k: string) => k.length >= 3);

    if (terms.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    // Run Jira + Notion searches in parallel
    const [jiraIssues, notionInputs] = await Promise.allSettled([
      searchIssuesForCommunity(communityName),
      searchClientsInputs(terms),
    ]);

    const matches: DuplicateMatch[] = [];

    // Match Jira issues
    if (jiraIssues.status === "fulfilled") {
      for (const issue of jiraIssues.value) {
        const title = issue.summary.toLowerCase();
        if (terms.some((k) => title.includes(k))) {
          matches.push({
            type: "jira",
            title: issue.summary,
            commentRef: signIssueRef(issue.key),
          });
          if (matches.length >= 3) break;
        }
      }
    }

    // Match Notion inputs (only if Jira didn't already saturate the 3-result limit)
    if (notionInputs.status === "fulfilled" && matches.length < 3) {
      for (const item of notionInputs.value) {
        const title = item.title.toLowerCase();
        if (terms.some((k) => title.includes(k))) {
          matches.push({ type: "notion", title: item.title });
          if (matches.length >= 3) break;
        }
      }
    }

    return NextResponse.json({ matches });
  } catch (err) {
    console.error("[duplicates] error:", err);
    return NextResponse.json({ matches: [] });
  }
}
