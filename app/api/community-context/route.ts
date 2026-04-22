/**
 * GET /api/community-context?communityPageId=<pageId>
 * Returns ONLY the CX owner name for a community (nothing sensitive).
 * Response: { cxOwnerName: string | null, cxOwnerResolved: boolean }
 *
 * PRIVACY: never returns email, instanceId, country, ARR, CX Stage, etc.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCxOwnerForCommunity } from "@/lib/notion";

export async function GET(req: NextRequest) {
  const pageId = req.nextUrl.searchParams.get("communityPageId") ?? "";
  if (!pageId) {
    return NextResponse.json({ cxOwnerName: null, cxOwnerResolved: false });
  }

  try {
    const info = await getCxOwnerForCommunity(pageId);
    return NextResponse.json({
      cxOwnerName: info.found ? (info.cxOwnerName ?? null) : null,
      cxOwnerResolved: info.found,
    });
  } catch {
    return NextResponse.json({ cxOwnerName: null, cxOwnerResolved: false });
  }
}
