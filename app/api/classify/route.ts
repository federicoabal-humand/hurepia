/**
 * POST /api/classify
 * Calls Gemini (lib/llm.ts) to classify a bug report.
 * Body: ClassifyInput
 * Response: ClassifyResult
 */
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { classifyReport } from "@/lib/llm";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed } = rateLimit(`classify:${ip}`, 20, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const result = await classifyReport(body);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[classify] error:", err);
    return NextResponse.json(
      { error: "Classification failed" },
      { status: 500 }
    );
  }
}
