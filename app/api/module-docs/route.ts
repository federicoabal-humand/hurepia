/**
 * GET /api/module-docs?module=time_off
 * Returns Notion documentation for a Humand module.
 * In-memory cache with 10-minute TTL to avoid hammering Notion.
 * Response: ModuleDocsResult
 */
import { NextRequest, NextResponse } from "next/server";
import { getModuleDocs, type ModuleDocsResult } from "@/lib/notion";

interface CacheEntry {
  data: ModuleDocsResult;
  cachedAt: number;
}

// Module-level cache (persists across requests within the same serverless instance)
const cache: Record<string, CacheEntry> = {};
const TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function GET(req: NextRequest) {
  const moduleSlug = req.nextUrl.searchParams.get("module") ?? "";
  if (!moduleSlug) {
    return NextResponse.json({ found: false });
  }

  // Check cache
  const cached = cache[moduleSlug];
  if (cached && Date.now() - cached.cachedAt < TTL_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const data = await getModuleDocs(moduleSlug);
    cache[moduleSlug] = { data, cachedAt: Date.now() };
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ found: false });
  }
}
