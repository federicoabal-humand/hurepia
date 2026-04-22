// TODO: Real implementation
// 1. Read ANTHROPIC_API_KEY from env
// 2. Build a prompt using the body fields (module, platform, description, etc.)
// 3. Call Anthropic SDK: `import Anthropic from "@anthropic-ai/sdk"`
// 4. Map model output to Classification type from lib/mappings.ts
// 5. If classification === "bug_confirmed" → call /api/jira/create internally
//    using JIRA constants from lib/mappings.ts (PROJECT_KEY, ISSUE_TYPE_BUG_ID, custom field IDs)
// 6. Apply rate limiting via lib/rate-limit.ts: rateLimit(ip, 10, 60_000)
//
// Body: { community, module, platforms, whatHappened, whatExpected, isBlocking, usersAffected, url, email }
// Response: { classification, explanation, ticketNumber? }

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { MOCK_AI_RESULTS } from "@/lib/mock-data";
import type { Classification } from "@/lib/mappings";

// Cycle through classifications for demo purposes
const DEMO_CYCLE: Classification[] = [
  "bug_confirmed",
  "configuration_error",
  "cache_browser",
  "expected_behavior",
  "needs_more_info",
];
let demoIndex = 0;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed } = rateLimit(`classify:${ip}`, 20, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Simulate AI latency
  await new Promise((r) => setTimeout(r, 1500));

  const classification = DEMO_CYCLE[demoIndex % DEMO_CYCLE.length];
  demoIndex++;

  const result = MOCK_AI_RESULTS[classification];
  return NextResponse.json(result);
}
