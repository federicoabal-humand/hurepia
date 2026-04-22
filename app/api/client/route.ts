// TODO: Real implementation
// 1. Read NOTION_TOKEN from env
// 2. Query the Notion database NOTION_DB.COMUNIDADES_CLIENTES from lib/mappings.ts
//    using filter: { property: "Name", rich_text: { contains: q } }
// 3. Map Notion page properties to MockCommunity shape
// 4. Return the matching communities
//
// Query params: ?q=search+term
// Response: MockCommunity[]

import { NextRequest, NextResponse } from "next/server";
import { MOCK_COMMUNITIES } from "@/lib/mock-data";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.toLowerCase() ?? "";

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  const results = MOCK_COMMUNITIES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.instanceId.toLowerCase().includes(q)
  );

  return NextResponse.json(results);
}
