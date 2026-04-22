// TODO: Real implementation
// 1. Compute embeddings for { title, description } via Anthropic or OpenAI
// 2. Compare cosine similarity against stored ticket embeddings in Notion CLIENTS_INPUTS
// 3. Return tickets with similarity > 0.85 as potential duplicates
//
// Body: { title: string, description: string }
// Response: { duplicates: MockTicket[] }

import { NextRequest, NextResponse } from "next/server";

export async function POST(_req: NextRequest) {
  return NextResponse.json({ duplicates: [] });
}
