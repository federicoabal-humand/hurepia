/**
 * POST /api/classify
 * Full pipeline:
 *   1. Resolve community internally (Notion fuzzy match — INVISIBLE to frontend)
 *   2. Detect language + extract/translate keywords
 *   3. Enrich with module docs + recent module tickets (parallel)
 *   4. Call Gemini for classification
 *   5. Handle guardrail rejections
 *   6. Route based on classification:
 *      - bug_already_resolved → find resolved ticket, return isResolved
 *      - bug_known → find open ticket, add comment, cross-community link, return isDuplicate
 *      - feature_request → CI-Mock duplicate check or create
 *      - configuration_error / etc. → return immediately
 *      - bug_confirmed → duplicate check → create Jira ticket
 *   7. Jira ticket includes: severity, friction score, cluster_id
 *   8. Return enriched response (never raw HUREP-XX, never custom fields)
 */
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { classifyReport, detectLanguage, extractAndTranslateKeywords } from "@/lib/llm";
import { getModuleDocs, searchClientsInputs, resolveCommunityInternal } from "@/lib/notion";
import {
  searchIssuesForCommunity,
  searchIssuesByModule,
  createJiraIssue,
  addJiraComment,
  getRecentTicketsForModule,
  addCommunityToAffectedClients,
} from "@/lib/jira";
import {
  createClientInputMock,
  searchSimilarClientInputsMock,
  addCommunityAsAffectedClientMock,
  generateInputTitle,
} from "@/lib/notion-inputs";
import { signIssueRef } from "@/lib/token";
import { MODULE_NOTION_MAP } from "@/lib/module-registry";
import { sanitizeForFrontend, sanitizeAiTextFields } from "@/lib/sanitizer";
import type { ClassifyResult } from "@/lib/llm";
import type { JiraIssueSummary } from "@/lib/jira";

// ─── Duplicate detection helpers ──────────────────────────────────────────────

const GENERIC_TOKENS = new Set([
  "error", "falla", "problema", "inconveniente", "issue",
  "mobile", "web", "app", "usuario", "admin", "administrador",
  "no", "si", "que", "con", "para", "por", "del", "una", "uno",
  "los", "las", "the", "and", "not", "can", "hay", "fue",
  "500", "404", "http", "fail", "failed", "null", "undefined",
]);

const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[_\-.]/g, " ")
    .replace(/[^\w\sáéíóúñüàèìòùâêîôûäëïöü]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !GENERIC_TOKENS.has(w));
}

function shareLongWord(a: string, b: string, minLen = 15): boolean {
  const wordsA = a.toLowerCase().split(/\s+/).filter((w) => w.length >= minLen);
  const setB = new Set(b.toLowerCase().split(/\s+/));
  return wordsA.some((w) => setB.has(w));
}

function scoreDuplicate(
  keywords: string[],
  ticketSummary: string
): { score: number; confidence: "high" | "low" } {
  const newTokens = new Set(keywords.flatMap(normalizeTokens));
  const ticketTokens = new Set(normalizeTokens(ticketSummary));

  let score = 0;
  for (const token of newTokens) {
    if (ticketTokens.has(token)) score += 1;
  }
  const fullNew = keywords.join(" ");
  if (shareLongWord(fullNew, ticketSummary, 15)) score += 2;

  return { score, confidence: score >= 5 ? "high" : "low" };
}

/** Find the best scoring match from a list of issues. Returns null if none score ≥ 3. */
function findBestMatch(
  keywords: string[],
  issues: JiraIssueSummary[]
): { issue: JiraIssueSummary; score: number; confidence: "high" | "low" } | null {
  let best: { issue: JiraIssueSummary; score: number; confidence: "high" | "low" } | null = null;
  for (const issue of issues) {
    const { score, confidence } = scoreDuplicate(keywords, issue.summary);
    if (score >= 3 && (!best || score > best.score)) {
      best = { issue, score, confidence };
    }
  }
  return best;
}

/** Cross-language duplicate matching using all 3 keyword sets. */
function findBestMatchMultiLang(
  keywordsOriginal: string[],
  keywordsEs: string[],
  keywordsEn: string[],
  issues: JiraIssueSummary[]
): { issue: JiraIssueSummary; score: number; confidence: "high" | "low" } | null {
  let best: { issue: JiraIssueSummary; score: number; confidence: "high" | "low" } | null = null;
  for (const issue of issues) {
    const s1 = keywordsOriginal.length ? scoreDuplicate(keywordsOriginal, issue.summary).score : 0;
    const s2 = keywordsEs.length ? scoreDuplicate(keywordsEs, issue.summary).score : 0;
    const s3 = keywordsEn.length ? scoreDuplicate(keywordsEn, issue.summary).score : 0;
    const score = Math.max(s1, s2, s3);
    const confidence: "high" | "low" = score >= 5 ? "high" : "low";
    if (score >= 3 && (!best || score > best.score)) {
      best = { issue, score, confidence };
    }
  }
  return best;
}

function issueTicketNumber(key: string): number | undefined {
  const parts = key.split("-");
  return parts.length === 2 ? parseInt(parts[1], 10) : undefined;
}

function buildDuplicateComment(params: {
  communityNameRaw: string;
  whatHappened: string;
  whatExpected: string;
  detectedLanguage: string;
}): string {
  const { communityNameRaw, whatHappened, whatExpected, detectedLanguage } = params;
  if (detectedLanguage === "en") {
    return `[HuReport AI] New report of the same issue received.\n\nCommunity: ${communityNameRaw}\nReport language: ${detectedLanguage}\n\nAdmin description:\n${whatHappened.slice(0, 500)}\n\nExpected: ${whatExpected.slice(0, 200)}`;
  } else if (detectedLanguage === "pt") {
    return `[HuReport AI] Novo relato do mesmo problema recebido.\n\nComunidade: ${communityNameRaw}\nIdioma do relato: ${detectedLanguage}\n\nDescrição do admin:\n${whatHappened.slice(0, 500)}\n\nEsperado: ${whatExpected.slice(0, 200)}`;
  } else if (detectedLanguage === "fr") {
    return `[HuReport AI] Nouveau signalement du même problème reçu.\n\nCommunauté: ${communityNameRaw}\nLangue du signalement: ${detectedLanguage}\n\nDescription de l'admin:\n${whatHappened.slice(0, 500)}\n\nAttendu: ${whatExpected.slice(0, 200)}`;
  }
  return `[HuReport AI] Nuevo reporte del mismo inconveniente recibido.\n\nComunidad: ${communityNameRaw}\nIdioma del reporte: ${detectedLanguage}\n\nDescripción del admin:\n${whatHappened.slice(0, 500)}\n\nQué esperaba: ${whatExpected.slice(0, 200)}`;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed } = rateLimit(`classify:${ip}`, 20, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const {
      language = "es",
      module: moduleSlug = "general",
      platforms = [],
      communityNameRaw = "",
      whatHappened = "",
      whatExpected = "",
      isBlocking = false,
      usersAffected = "1",
      history = [],
      askCount = 0,
      instanceId: rawInstanceId,
    } = body;

    // Coerce to number: frontend may send as string or number
    const instanceId: number | undefined =
      rawInstanceId != null
        ? typeof rawInstanceId === "number"
          ? rawInstanceId
          : parseInt(String(rawInstanceId), 10) || undefined
        : undefined;

    // ── 1. Detect language + extract keywords ─────────────────────────────────
    const detectedLanguage = await detectLanguage(
      whatHappened + " " + whatExpected
    ).catch(() => language as string);

    const { keywordsOriginal, keywordsEs, keywordsEn } =
      await extractAndTranslateKeywords(
        whatHappened,
        whatExpected,
        detectedLanguage
      ).catch(() => ({ keywordsOriginal: [] as string[], keywordsEs: [] as string[], keywordsEn: [] as string[] }));

    // ── 2. Resolve community internally ───────────────────────────────────────
    const resolved = await resolveCommunityInternal(communityNameRaw).catch(() => ({
      matched: false as const,
    }));

    const communityName = resolved.matched
      ? (resolved.canonicalName ?? communityNameRaw)
      : communityNameRaw;

    const cxOwnerName: string | null = resolved.matched ? (resolved.cxOwnerName ?? null) : null;

    // ── 3. Module metadata ────────────────────────────────────────────────────
    const moduleEntry = MODULE_NOTION_MAP[moduleSlug];
    const moduleDisplayName = moduleEntry?.displayName ?? moduleSlug;

    // Fetch docs + recent tickets in parallel (both fail-safe)
    const [moduleDocs, recentModuleTickets] = await Promise.all([
      getModuleDocs(moduleSlug).catch(() => ({ found: false as const })),
      getRecentTicketsForModule(moduleSlug, 20).catch(() => []),
    ]);

    // ── 4. Call Gemini ────────────────────────────────────────────────────────
    const aiResult: ClassifyResult = await classifyReport({
      language,
      detectedLanguage,
      module: moduleSlug,
      moduleDisplayName,
      moduleDocs: moduleDocs.found ? moduleDocs.content : undefined,
      moduleNotionUrl: moduleDocs.found ? moduleDocs.notionUrl : undefined,
      platforms,
      communityName,
      whatHappened,
      whatExpected,
      isBlocking,
      usersAffected,
      history,
      askCount,
      recentModuleTickets: recentModuleTickets.length > 0 ? recentModuleTickets : undefined,
      keywordsOriginal,
      keywordsEs,
      keywordsEn,
    });

    // ── 5. Strip all internal links/references from every text field ──────────
    // This runs unconditionally on every Gemini response before anything reaches
    // the frontend — notion.so URLs, "documentación interna", etc. are removed.
    const aiResultClean = sanitizeAiTextFields(aiResult);
    // Re-assign so all downstream code uses the sanitized version
    Object.assign(aiResult, aiResultClean);

    // ── 6. Handle guardrail rejection ─────────────────────────────────────────
    if (aiResult.action === "reject") {
      console.warn(
        JSON.stringify({
          event: "ai_rejection",
          reason: aiResult.rejectionReason,
          communityNameRaw,
          moduleSlug,
          language: detectedLanguage,
          ts: new Date().toISOString(),
        })
      );
      return NextResponse.json(
        sanitizeForFrontend({
          rejected: true,
          rejectionReason: aiResult.rejectionReason,
          message: aiResult.message,
        } as Record<string, unknown>)
      );
    }

    // Also handle if rejected flag is set
    if ("rejected" in aiResult && aiResult.rejected) {
      const r = aiResult as unknown as Record<string, unknown>;
      console.warn(
        JSON.stringify({
          event: "ai_rejection",
          reason: r.rejectionReason,
          communityNameRaw,
          moduleSlug,
          language: detectedLanguage,
          ts: new Date().toISOString(),
        })
      );
      return NextResponse.json(
        sanitizeForFrontend({
          rejected: true,
          rejectionReason: r.rejectionReason,
          message: r.message,
        } as Record<string, unknown>)
      );
    }

    // ── 6. Replace {{CX_MANAGER_NAME}} placeholder ───────────────────────────
    const cxFallback =
      detectedLanguage === "en"
        ? "your Account Manager"
        : detectedLanguage === "pt"
        ? "seu Account Manager"
        : detectedLanguage === "fr"
        ? "votre Account Manager"
        : "tu Account Manager";
    const cxName = cxOwnerName ?? cxFallback;
    if (aiResult.explanation) {
      aiResult.explanation = aiResult.explanation.replace(/\{\{CX_MANAGER_NAME\}\}/g, cxName);
    }

    // ── 7. Follow-up question → return immediately ─────────────────────────
    if (aiResult.action === "ask") {
      return NextResponse.json(aiResult);
    }

    const classification = aiResult.classification;

    // ── 8. Extract keywords early (shared across all bug branches) ─────────
    const keywords: string[] = aiResult.keywords?.length
      ? aiResult.keywords
      : keywordsOriginal.length
      ? keywordsOriginal
      : whatHappened.toLowerCase().split(/\W+/).filter((w: string) => w.length >= 4).slice(0, 5);

    // Use multi-lang keywords for all duplicate detection
    const allKeywordsForMatch =
      keywordsOriginal.length || keywordsEs.length || keywordsEn.length
        ? { keywordsOriginal, keywordsEs, keywordsEn }
        : { keywordsOriginal: keywords, keywordsEs: [], keywordsEn: [] };

    // ── 9. Fetch community issues (used for known/resolved/confirmed bugs) ──
    const isBugRelated =
      classification === "bug_confirmed" ||
      classification === "bug_known" ||
      classification === "bug_already_resolved";

    const jiraIssues = isBugRelated
      ? await searchIssuesForCommunity(communityName).catch(() => [])
      : [];

    // ── 10. bug_already_resolved ────────────────────────────────────────────
    if (classification === "bug_already_resolved") {
      const resolvedCandidates = jiraIssues.filter((issue) => {
        if (issue.status !== "resolved") return false;
        if (
          issue.module &&
          issue.module !== "general" &&
          moduleSlug !== "general" &&
          issue.module !== moduleSlug
        )
          return false;
        const ageMs = Date.now() - new Date(issue.createdAt).getTime();
        return ageMs <= THIRTY_DAYS_MS;
      });

      const best = findBestMatchMultiLang(
        allKeywordsForMatch.keywordsOriginal,
        allKeywordsForMatch.keywordsEs,
        allKeywordsForMatch.keywordsEn,
        resolvedCandidates
      );

      return NextResponse.json({
        action: "classify" as const,
        classification,
        explanation: aiResult.explanation,
        isResolved: true,
        duplicateTicketNumber: best ? issueTicketNumber(best.issue.key) : undefined,
        duplicateFriendlyStatus: "resolved" as const,
        cxOwnerName,
      });
    }

    // ── 11. bug_known ──────────────────────────────────────────────────────
    if (classification === "bug_known") {
      const openCandidates = jiraIssues.filter((issue) => {
        if (issue.status === "resolved") return false;
        if (
          issue.module &&
          issue.module !== "general" &&
          moduleSlug !== "general" &&
          issue.module !== moduleSlug
        )
          return false;
        const ageMs = Date.now() - new Date(issue.createdAt).getTime();
        return ageMs <= SIXTY_DAYS_MS;
      });

      const best = findBestMatchMultiLang(
        allKeywordsForMatch.keywordsOriginal,
        allKeywordsForMatch.keywordsEs,
        allKeywordsForMatch.keywordsEn,
        openCandidates
      );

      // If no match in community tickets, try module-wide cross-community search
      let crossCommunityBest = best;
      if (!crossCommunityBest) {
        const moduleWideIssues = await searchIssuesByModule(moduleSlug, 30).catch(() => []);
        // Exclude tickets already labeled for this community
        const crossCandidates = moduleWideIssues.filter(
          (i) => i.status !== "resolved" && i.module === moduleSlug
        );
        crossCommunityBest = findBestMatchMultiLang(
          allKeywordsForMatch.keywordsOriginal,
          allKeywordsForMatch.keywordsEs,
          allKeywordsForMatch.keywordsEn,
          crossCandidates
        );
      }

      if (crossCommunityBest) {
        const commentRef = signIssueRef(crossCommunityBest.issue.key);
        const ticketNumber = issueTicketNumber(crossCommunityBest.issue.key);

        // Cross-community linking: add this community to the existing ticket's labels
        await addCommunityToAffectedClients(crossCommunityBest.issue.key, communityNameRaw).catch(() => {});

        // Multi-language comment
        try {
          const commentText = buildDuplicateComment({
            communityNameRaw,
            whatHappened,
            whatExpected,
            detectedLanguage,
          });
          await addJiraComment(crossCommunityBest.issue.key, commentText);
        } catch {
          // Don't fail if comment fails
        }

        return NextResponse.json({
          action: "classify" as const,
          classification,
          explanation: aiResult.explanation,
          isDuplicate: true,
          duplicateConfidence: "high" as const,
          duplicateTicketNumber: ticketNumber,
          duplicateFriendlyStatus: crossCommunityBest.issue.status,
          duplicateCreatedAt: crossCommunityBest.issue.createdAt,
          duplicateCommentRef: commentRef,
          cxOwnerName,
        });
      }

      // No match found anywhere — fallback: treat as new bug_confirmed
    }

    // ── 12. feature_request ────────────────────────────────────────────────
    if (classification === "feature_request") {
      const similar = await searchSimilarClientInputsMock(
        moduleSlug,
        allKeywordsForMatch.keywordsOriginal,
        allKeywordsForMatch.keywordsEs,
        allKeywordsForMatch.keywordsEn
      ).catch(() => []);

      if (similar.length > 0 && similar[0].score >= 3) {
        let added = false;
        if (
          !similar[0].currentCommunities.some(
            (c: string) => c.toLowerCase() === communityNameRaw.toLowerCase()
          )
        ) {
          added = await addCommunityAsAffectedClientMock(
            similar[0].jiraKey,
            communityNameRaw
          ).catch(() => false);
        }
        return NextResponse.json(
          sanitizeForFrontend({
            action: "classify" as const,
            classification: "feature_request" as const,
            isDuplicateCI: true,
            affectedClientAdded: added,
            explanation: aiResult.explanation,
            message:
              detectedLanguage === "en"
                ? "Your suggestion was already registered and we added it to your community. The Product team is tracking it."
                : detectedLanguage === "pt"
                ? "Sua sugestão já estava registrada e a adicionamos à sua comunidade. A equipe de Produto está acompanhando."
                : detectedLanguage === "fr"
                ? "Votre suggestion était déjà enregistrée et nous l'avons ajoutée à votre communauté. L'équipe Produit en assure le suivi."
                : "Tu sugerencia ya estaba registrada y la sumamos a tu comunidad. El equipo de Producto la tiene en seguimiento.",
            cxOwnerName,
          } as Record<string, unknown>)
        );
      }

      const titulo = generateInputTitle(moduleSlug, whatExpected || whatHappened);
      const description =
        detectedLanguage === "en"
          ? `Client: ${communityNameRaw}\n\nWhat's happening: ${whatHappened}\n\nExpected: ${whatExpected}`
          : detectedLanguage === "pt"
          ? `Cliente: ${communityNameRaw}\n\nO que está acontecendo: ${whatHappened}\n\nEsperado: ${whatExpected}`
          : detectedLanguage === "fr"
          ? `Client: ${communityNameRaw}\n\nCe qui se passe: ${whatHappened}\n\nAttendu: ${whatExpected}`
          : `Cliente: ${communityNameRaw}\n\nQué pasa: ${whatHappened}\n\nQué esperaba: ${whatExpected}`;

      const ci = await createClientInputMock({
        input: titulo,
        description,
        communityNameRaw,
        moduleSlug,
        detectedLanguage,
      }).catch(() => null);

      const message =
        detectedLanguage === "en"
          ? "We registered your suggestion. The Product team will evaluate it within 15 days."
          : detectedLanguage === "pt"
          ? "Registramos sua sugestão. A equipe de Produto avaliará nos próximos 15 dias."
          : detectedLanguage === "fr"
          ? "Nous avons enregistré votre suggestion. L'équipe Produit l'évaluera dans les 15 prochains jours."
          : "Registramos tu sugerencia. El equipo de Producto la evalúa en los próximos 15 días.";

      return NextResponse.json(
        sanitizeForFrontend({
          action: "classify" as const,
          classification: "feature_request" as const,
          isDuplicateCI: false,
          ciJiraKey: ci?.jiraKey, // will be stripped by sanitizer
          explanation: aiResult.explanation,
          message,
          cxOwnerName,
        } as Record<string, unknown>)
      );
    }

    // ── 13. Non-bug (config_error, cache_browser, expected_behavior, needs_more_info) ──
    if (
      classification !== "bug_confirmed" &&
      classification !== "bug_known" // bug_known fell through here → treat as bug_confirmed
    ) {
      // aiResult already sanitized above; spread it safely
      return NextResponse.json({ ...aiResult, cxOwnerName });
    }

    // ── 14. Bug confirmed (or bug_known with no match): duplicate check ────
    const now = Date.now();
    const candidateJiraIssues = jiraIssues.filter((issue) => {
      if (issue.status === "resolved") return false;
      if (
        issue.module &&
        issue.module !== "general" &&
        moduleSlug !== "general" &&
        issue.module !== moduleSlug
      )
        return false;
      const ageMs = now - new Date(issue.createdAt).getTime();
      if (ageMs > SIXTY_DAYS_MS) return false;
      return true;
    });

    const jiraDup = findBestMatchMultiLang(
      allKeywordsForMatch.keywordsOriginal,
      allKeywordsForMatch.keywordsEs,
      allKeywordsForMatch.keywordsEn,
      candidateJiraIssues
    );

    if (jiraDup) {
      const { issue, confidence } = jiraDup;
      const dupTicketNumber = issueTicketNumber(issue.key);

      // Cross-community linking
      await addCommunityToAffectedClients(issue.key, communityNameRaw).catch(() => {});
      await addJiraComment(
        issue.key,
        buildDuplicateComment({ communityNameRaw, whatHappened, whatExpected, detectedLanguage })
      ).catch(() => {});

      return NextResponse.json({
        action: "classify" as const,
        classification: aiResult.classification,
        explanation: aiResult.explanation,
        isDuplicate: true,
        duplicateConfidence: confidence,
        duplicateTicketNumber: dupTicketNumber,
        duplicateFriendlyStatus: issue.status,
        duplicateCreatedAt: issue.createdAt,
        duplicateCommentRef: signIssueRef(issue.key),
        cxOwnerName,
      });
    }

    // ── Notion duplicate check ────────────────────────────────────────────
    const notionInputs = await searchClientsInputs(keywords).catch(() => []);
    const notionDup = notionInputs.find((item) => {
      const { score } = scoreDuplicate(keywords, item.title);
      return score >= 3;
    });

    if (notionDup) {
      return NextResponse.json({
        action: "classify" as const,
        classification: aiResult.classification,
        explanation: aiResult.explanation,
        isDuplicate: true,
        duplicateConfidence: "low" as const,
        duplicateCommentRef: undefined,
        cxOwnerName,
      });
    }

    // ── Cross-community duplicate check (module-wide, no community filter) ──
    // Only if community-specific + Notion checks found nothing
    {
      const moduleWide = await searchIssuesByModule(moduleSlug, 30).catch(() => []);
      const crossDup = findBestMatchMultiLang(
        allKeywordsForMatch.keywordsOriginal,
        allKeywordsForMatch.keywordsEs,
        allKeywordsForMatch.keywordsEn,
        moduleWide.filter((i) => i.status !== "resolved")
      );
      if (crossDup) {
        const { issue, confidence } = crossDup;
        await addCommunityToAffectedClients(issue.key, communityNameRaw).catch(() => {});
        await addJiraComment(
          issue.key,
          buildDuplicateComment({ communityNameRaw, whatHappened, whatExpected, detectedLanguage })
        ).catch(() => {});
        return NextResponse.json({
          action: "classify" as const,
          classification: aiResult.classification,
          explanation: aiResult.explanation,
          isDuplicate: true,
          duplicateConfidence: confidence,
          duplicateTicketNumber: issueTicketNumber(issue.key),
          duplicateFriendlyStatus: issue.status,
          duplicateCreatedAt: issue.createdAt,
          duplicateCommentRef: signIssueRef(issue.key),
          cxOwnerName,
        });
      }
    }

    // ── 15. No duplicate → create Jira ticket ─────────────────────────────
    const summary = (aiResult.summary ?? whatHappened).slice(0, 120);

    const severidad =
      aiResult.severidad ?? (isBlocking && usersAffected === "many" ? "alta" : "media");
    const frictionScore =
      (severidad === "alta" ? 3 : severidad === "media" ? 2 : 1) +
      (isBlocking ? 2 : 0) +
      (usersAffected === "many" ? 1 : 0);

    // cluster_id groups similar issues for analytics (never shown to admin)
    const actualClassification = classification === "bug_known" ? "bug_confirmed" : classification;
    const clusterId = `${moduleSlug}_${actualClassification}`;

    const description = [
      `Module: ${moduleDisplayName}`,
      `Platform: ${platforms.join(", ")}`,
      `Community: ${communityName}`,
      `Language: ${detectedLanguage}`,
      `What happened: ${whatHappened}`,
      whatExpected ? `Expected: ${whatExpected}` : "",
      `Blocking: ${isBlocking ? "Yes" : "No"}`,
      `Users affected: ${usersAffected}`,
      `---`,
      `Severity: ${severidad}`,
      `Friction Score: ${frictionScore}/6`,
      `Cluster: ${clusterId}`,
    ]
      .filter(Boolean)
      .join("\n");

    const issue = await createJiraIssue({
      summary,
      description,
      module: moduleSlug,
      affectedUsersCount: usersAffected === "many" ? "many" : "1",
      isBlocking: !!isBlocking,
      communityName,
      instanceId: typeof instanceId === "number" ? instanceId : undefined,
    });

    const keyParts = issue.key.split("-");
    const ticketNumber = keyParts.length === 2 ? parseInt(keyParts[1], 10) : 1;
    const commentRef = signIssueRef(issue.key);

    return NextResponse.json({
      ...aiResult,
      // Always use "bug_confirmed" for the frontend even if bug_known fell through
      classification: actualClassification,
      cxOwnerName,
      ticketNumber,
      commentRef,
      isDuplicate: false,
      severidad,
      frictionScore,
    });
  } catch (err) {
    console.error("[classify] error:", err);
    return NextResponse.json({ error: "Classification failed" }, { status: 500 });
  }
}
