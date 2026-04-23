/**
 * lib/llm.ts
 * Gemini-powered classification for HuReport AI.
 *
 * Model: gemini-2.5-flash
 * Env: GEMINI_API_KEY
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Classification } from "./mappings";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ClassifyInput {
  language: "es" | "en";
  module: string;
  moduleDisplayName: string;
  moduleDocs?: string;
  moduleNotionUrl?: string;
  platforms: string[];
  communityName: string;
  whatHappened: string;
  whatExpected: string;
  isBlocking: boolean;
  usersAffected: "1" | "many";
  history: ChatTurn[];
  /** How many clarifying questions Gemini has already asked. Max allowed: 1. */
  askCount: number;
  /**
   * Last N tickets from this module, used to detect known/already-resolved bugs.
   * Passed to Gemini as context — never returned to the frontend.
   */
  recentModuleTickets?: Array<{
    summary: string;
    friendlyStatus: string; // "reported" | "under_review" | "developing_fix" | "resolved"
    createdAt: string;
  }>;
}

export interface ClassifyResult {
  /** "ask" → one follow-up question before classification (max once per session) */
  action: "ask" | "classify";
  /** Only when action === "ask" */
  question?: string;
  /** Only when action === "classify" */
  classification?: Classification;
  /** 1-sentence summary suitable for a Jira ticket title */
  summary?: string;
  /** 2–4 sentences explanation for the admin */
  explanation?: string;
  /** Notion / help-center URL when relevant */
  help_center_link?: string;
  /** Routing hint for the frontend */
  next_action?: "contact_cx_manager" | "retry_after_fix" | "resolve" | null;
  /** 3–5 technical keywords from the issue (for duplicate detection) */
  keywords?: string[];
  /**
   * Severity of the confirmed issue.
   * "alta" = blocks critical workflow for multiple users.
   * "media" = workaround exists or single user.
   * "baja" = cosmetic / non-blocking.
   * Only meaningful when classification === "bug_confirmed".
   */
  severidad?: "alta" | "media" | "baja";
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(input: ClassifyInput): string {
  const lang = input.language === "es" ? "Spanish" : "English";
  const hasHistory = !!input.history?.length;
  const forceClassify = input.askCount >= 1 || hasHistory;

  const historyBlock = hasHistory
    ? `\nConversation so far:\n${input.history
        .map((h) => `${h.role === "user" ? "Admin" : "AI"}: ${h.content}`)
        .join("\n")}\n`
    : "";

  const docsBlock = input.moduleDocs
    ? `\n=== MODULE DOCUMENTATION (source of truth) ===\n${input.moduleDocs}\n\nDoc URL: ${input.moduleNotionUrl ?? "N/A"}\n`
    : "\n(No specific documentation available for this module.)\n";

  const recentTicketsBlock = input.recentModuleTickets?.length
    ? `\n=== RECENT TICKETS FOR MODULE "${input.moduleDisplayName}" (last ${input.recentModuleTickets.length}, internal — do NOT share with admin) ===\n` +
      input.recentModuleTickets
        .map(
          (t, i) =>
            `${i + 1}. [${t.friendlyStatus.toUpperCase()}] ${t.summary} (${t.createdAt.slice(0, 10)})`
        )
        .join("\n") +
      "\n"
    : "";

  const instructions = forceClassify
    ? `You have already asked ${input.askCount} clarifying question(s). You MUST now respond with action="classify". DO NOT ask another question.`
    : `If you need ONE specific piece of technical information that would change your classification, respond with action="ask" and a single brief question.
Otherwise (or if you have enough context), respond with action="classify".
NEVER ask about: community, module, platform, users affected, or blocking status — those are already provided above.`;

  return `You are the bug triage assistant for Humand — an HR SaaS platform used across Latin America.
Analyze the following report from an admin and respond in ${lang}.

=== REPORT (ALREADY PROVIDED — DO NOT RE-ASK ANY OF THIS) ===
Community/client: ${input.communityName || "not specified"}
Module: ${input.moduleDisplayName} (${input.module})
Platform(s): ${input.platforms.join(", ") || "not specified"}
What happened: ${input.whatHappened}
Expected behavior: ${input.whatExpected || "not specified"}
Blocks critical action: ${input.isBlocking ? "YES" : "no"}
Users affected: ${input.usersAffected === "many" ? "multiple users" : "single user"}
${historyBlock}${docsBlock}${recentTicketsBlock}
=== INSTRUCTIONS ===
${instructions}

Classifications (for action="classify"):
- bug_confirmed: Confirmed software defect in the Humand platform. The behavior contradicts the docs or is clearly broken.
- configuration_error: The docs explain how to configure it and the admin clearly hasn't done so. Return specific steps from the docs.
- cache_browser: Typical session/browser issue (logout, incognito, clear cache, switch browser).
- expected_behavior: The platform works as designed. The docs confirm this behavior. Include help_center_link.
- needs_more_info: Only if a specific technical detail is missing that changes the classification.
- feature_request: Admin is requesting a new feature or enhancement, not reporting a defect.
- bug_known: ONLY use if the admin's report matches an OPEN ticket in the recent tickets list above (status != resolved). Explain we are working on it. Do NOT create a duplicate ticket.
- bug_already_resolved: ONLY use if the admin's report matches a RESOLVED ticket from the last 30 days. Tell admin to refresh/update. Do NOT create a new ticket.

Rules:
- Respond ONLY in ${lang}.
- Tone: professional, direct, friendly. Use "vos" (not "tú") when in Spanish. No patronizing tone. Short sentences.
- explanation: maximum 4 sentences. If including steps, use numbered list "1) ... 2) ...".
- next_action rules:
  * "retry_after_fix" → for configuration_error or cache_browser with clear fix steps.
  * "contact_cx_manager" → for complex config, client-specific questions, billing, or if no docs exist and the case is ambiguous.
  * "resolve" → for expected_behavior.
  * null → for bug_confirmed.
- keywords: extract 3–5 specific technical keywords from the problem (not generic words like "error" or "bug"). Example: ["vacaciones", "mobile", "congelar", "registrar", "error_500"].
- summary: 1 sentence suitable as a Jira ticket title, max 120 chars.
- severidad (only when classification="bug_confirmed"):
  * "alta" — blocks a critical workflow for multiple users, no workaround
  * "media" — impacts some users but a workaround exists, or affects only 1 user
  * "baja" — cosmetic, non-blocking, or edge case

Respond with ONLY valid JSON matching this schema:
{
  "action": "ask" | "classify",
  "question": "<string, only if action=ask>",
  "classification": "<one of 8 values, only if action=classify>",
  "summary": "<1-sentence ticket title, only if action=classify>",
  "explanation": "<string, only if action=classify>",
  "help_center_link": "<URL string or omit>",
  "next_action": "contact_cx_manager" | "retry_after_fix" | "resolve" | null,
  "keywords": ["<keyword>", ...],
  "severidad": "alta" | "media" | "baja"
}`;
}

// ─── JSON parse helper ────────────────────────────────────────────────────────

function parseGeminiJson(text: string): ClassifyResult {
  try {
    return JSON.parse(text) as ClassifyResult;
  } catch {
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch?.[1]) {
      try {
        return JSON.parse(fenceMatch[1].trim()) as ClassifyResult;
      } catch { /* fall through */ }
    }
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch?.[0]) {
      return JSON.parse(braceMatch[0]) as ClassifyResult;
    }
    throw new Error(`Gemini returned unparseable JSON: ${text.slice(0, 200)}`);
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function classifyReport(input: ClassifyInput): Promise<ClassifyResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const prompt = buildPrompt(input);

  // 20-second hard timeout — prevents hanging deploys
  const TIMEOUT_MS = 20_000;
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Gemini timeout after 20s")), TIMEOUT_MS)
  );

  const response = await Promise.race([
    model.generateContent(prompt),
    timeoutPromise,
  ]);
  const text = response.response.text();

  // Retry JSON parse once on failure (Gemini occasionally wraps in markdown)
  try {
    return parseGeminiJson(text);
  } catch {
    // Second attempt: strip leading/trailing noise
    const cleaned = text.replace(/^[^{[]*/, "").replace(/[^}\]]*$/, "");
    return parseGeminiJson(cleaned);
  }
}
