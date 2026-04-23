/**
 * GET /api/client?q=banco
 *
 * DEPRECATED: This endpoint is no longer called from the frontend.
 * Community name is now entered as free text; Notion matching happens
 * 100% internally in /api/classify and /api/reports via
 * resolveCommunityInternal(). Kept here for legacy compatibility only.
 * DO NOT call this route from any frontend component.
 */
import { NextRequest, NextResponse } from "next/server";
import { searchCommunities } from "@/lib/notion";
import { MOCK_COMMUNITIES } from "@/lib/mock-data";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.length < 2) return NextResponse.json([]);

  // Try real Notion search first
  try {
    const results = await searchCommunities(q);
    if (results.length > 0) {
      return NextResponse.json(results);
    }
  } catch (err) {
    console.warn("[client] Notion search failed, falling back to mock:", err);
  }

  // Fallback: mock communities (for local dev / demo without Notion)
  const lower = q.toLowerCase();
  const mock = MOCK_COMMUNITIES.filter(
    (c) =>
      c.name.toLowerCase().includes(lower) ||
      c.instanceId.toLowerCase().includes(lower)
  ).map((c) => ({ id: c.id, name: c.name }));

  return NextResponse.json(mock);
}
