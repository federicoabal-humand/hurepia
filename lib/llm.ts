/**
 * lib/llm.ts
 * Gemini-powered classification for HuReport AI.
 *
 * Model: gemini-2.0-flash-exp (fast, cheap, great for classification)
 * For complex / ambiguous reports consider "gemini-2.5-pro" as fallback.
 *
 * Env: GEMINI_API_KEY
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Classification } from "./mappings";

// ─── Public types ────────────────────────────────────────────────────────────

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ClassifyInput {
  language: "es" | "en";
  module: string;
  platforms: string[];
  communityName?: string;
  whatHappened: string;
  whatExpected?: string;
  isBlocking: boolean;
  usersAffected: "1" | "many";
  history?: ChatTurn[];
}

export interface ClassifyResult {
  /** "ask" → one follow-up question before classification (max once in a session) */
  action: "ask" | "classify";
  /** Only when action==="ask" */
  question?: string;
  /** Only when action==="classify" */
  classification?: Classification;
  explanation?: string;
  fixSteps?: string[]; // config_error / cache_browser
  questions?: string[]; // needs_more_info — list to show in result card
  docUrl?: string; // expected_behavior
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(input: ClassifyInput): string {
  const lang = input.language === "es" ? "Spanish" : "English";
  const hasHistory = !!input.history?.length;

  const historyBlock = hasHistory
    ? `\nConversation so far:\n${input.history!
        .map((h) => `${h.role === "user" ? "Admin" : "AI"}: ${h.content}`)
        .join("\n")}\n`
    : "";

  return `You are a technical support analyst for Humand — an HR SaaS platform used across Latin America.

Analyze the following bug report from an admin and respond in ${lang}.

=== REPORT ===
Module: ${input.module}
Platform(s): ${input.platforms.join(", ") || "not specified"}
Community/client: ${input.communityName || "not specified"}
What happened: ${input.whatHappened}
Expected behavior: ${input.whatExpected || "not specified"}
Blocks critical action: ${input.isBlocking ? "YES" : "no"}
Users affected: ${input.usersAffected === "many" ? "multiple users" : "single user"}
${historyBlock}
=== INSTRUCTIONS ===
${
  hasHistory
    ? "You already asked a follow-up question. You MUST now respond with action='classify'."
    : 'If you need ONE specific piece of information to classify accurately, respond with action="ask" and a brief question.\nOtherwise (or if you have enough context), respond with action="classify".'
}

Classifications (for action="classify"):
- bug_confirmed: Confirmed software defect in the Humand platform.
- configuration_error: Incorrect admin-level configuration (not a bug).
- cache_browser: Browser cache / stale data on the client side.
- expected_behavior: The platform is working as designed.
- needs_more_info: Cannot determine without more information from the admin.

Rules:
- Respond ONLY in ${lang}.
- explanation must be 2-3 friendly, non-technical sentences.
- fixSteps: only for configuration_error or cache_browser (numbered action steps).
- questions: only for needs_more_info (specific questions the admin should answer).
- docUrl: optional, only for expected_behavior.

Respond with valid JSON matching this schema exactly:
{
  "action": "ask" | "classify",
  "question": "<string, only if action=ask>",
  "classification": "<one of the 5 values, only if action=classify>",
  "explanation": "<string, only if action=classify>",
  "fixSteps": ["<step>", ...],
  "questions": ["<question>", ...],
  "docUrl": "<string>"
}`;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function classifyReport(input: ClassifyInput): Promise<ClassifyResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const genAI = new GoogleGenerativeAI(apiKey);

  // gemini-2.0-flash-exp: fast & cheap for classification tasks.
  // Upgrade to "gemini-2.5-pro" if classification accuracy needs improvement.
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2, // low temperature → consistent classifications
    },
  });

  const prompt = buildPrompt(input);
  const response = await model.generateContent(prompt);
  const text = response.response.text();

  const parsed = JSON.parse(text) as ClassifyResult;
  return parsed;
}
