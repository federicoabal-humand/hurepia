"use client";

import { useState } from "react";
import {
  AlertCircle,
  Settings,
  RefreshCw,
  CheckCircle,
  HelpCircle,
  ExternalLink,
  RotateCcw,
  Send,
  Ticket,
  AlertTriangle,
  Phone,
  Lightbulb,
  Flame,
  Wrench,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Classification } from "@/lib/mappings";
import type { ResolvedResult } from "./report-tab";
import { t, type Lang } from "@/lib/i18n";

// Extend ResolvedResult with extra fields
type ResultWithResolved = ResolvedResult & {
  isResolved?: boolean;
  rejected?: boolean;
  message?: string;
  rejectionReason?: string;
  isDuplicateCI?: boolean;
};

interface Props {
  result: ResultWithResolved;
  lang: Lang;
  onReportAnother: () => void;
}

const BADGE_CONFIG: Record<
  Classification,
  { icon: React.ElementType; bg: string; text: string; border: string }
> = {
  bug_confirmed: {
    icon: AlertCircle,
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
  },
  configuration_error: {
    icon: Settings,
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  cache_browser: {
    icon: RefreshCw,
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
  },
  expected_behavior: {
    icon: CheckCircle,
    bg: "bg-gray-50",
    text: "text-gray-700",
    border: "border-gray-200",
  },
  needs_more_info: {
    icon: HelpCircle,
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
  },
  feature_request: {
    icon: Lightbulb,
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
  },
  bug_known: {
    icon: AlertTriangle,
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  bug_already_resolved: {
    icon: CheckCircle,
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
  },
};

/** Returns a relative time string: "hace 2h" / "2h ago" */
function relativeTime(isoDate: string, lang: Lang): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (lang === "es") {
    if (diffMins < 60) return `hace ${diffMins}m`;
    if (diffHours < 24) return `hace ${diffHours}h`;
    return `hace ${diffDays}d`;
  } else {
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }
}

export function AiResultCard({ result, lang, onReportAnother }: Props) {
  // All hooks MUST be declared before any conditional returns
  const [feedbackSent, setFeedbackSent] = useState<boolean | null>(null);
  const [additionalText, setAdditionalText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dupDismissed, setDupDismissed] = useState(false);

  // ── Guardrail rejection ──────────────────────────────────────────────────────
  if (result.rejected) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <Info className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-700">
            {result.message ??
              (lang === "es"
                ? "Solo puedo ayudarte con reportes de inconvenientes sobre el módulo."
                : "I can only help with module issue reports.")}
          </p>
        </div>
        <button
          onClick={onReportAnother}
          className="flex items-center gap-2 w-full justify-center px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          {t("result.reportAnother", lang)}
        </button>
      </div>
    );
  }

  // ── bug_already_resolved ─────────────────────────────────────────────────────
  if (result.isResolved || result.classification === "bug_already_resolved") {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-green-800">
              {t("result.resolved.title", lang)}
            </p>
            <p className="text-xs text-green-700">{t("result.resolved.hint", lang)}</p>
            {result.explanation && (
              <p className="text-sm text-gray-700 mt-2 leading-relaxed">{result.explanation}</p>
            )}
          </div>
        </div>
        <button
          onClick={onReportAnother}
          className="flex items-center gap-2 w-full justify-center px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          {t("result.reportAnother", lang)}
        </button>
      </div>
    );
  }

  // ── bug_known without isDuplicate (direct classification from AI) ────────────
  if (result.classification === "bug_known" && !result.isDuplicate) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <Wrench className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-800">
              {t("result.known.title", lang)}
            </p>
            <p className="text-xs text-amber-700">{t("result.known.hint", lang)}</p>
            {result.explanation && (
              <p className="text-sm text-gray-700 mt-2 leading-relaxed">{result.explanation}</p>
            )}
          </div>
        </div>
        <button
          onClick={onReportAnother}
          className="flex items-center gap-2 w-full justify-center px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          {t("result.reportAnother", lang)}
        </button>
      </div>
    );
  }

  // ── feature_request ──────────────────────────────────────────────────────────
  if (result.classification === "feature_request") {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <h3 className="font-semibold text-sm text-gray-900">
                {result.isDuplicateCI
                  ? lang === "es"
                    ? "Sugerencia ya registrada"
                    : lang === "pt"
                    ? "Sugestão já registrada"
                    : lang === "fr"
                    ? "Suggestion déjà enregistrée"
                    : "Suggestion already registered"
                  : lang === "es"
                  ? "Sugerencia registrada"
                  : lang === "pt"
                  ? "Sugestão registrada"
                  : lang === "fr"
                  ? "Suggestion enregistrée"
                  : "Suggestion registered"}
              </h3>
              {result.message && <p className="text-sm text-gray-700">{result.message}</p>}
              {result.explanation && (
                <p className="text-sm text-gray-600">{result.explanation}</p>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onReportAnother}
          className="flex items-center gap-2 w-full justify-center px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          {t("result.reportAnother", lang)}
        </button>
      </div>
    );
  }

  const cls = result.classification as Classification;
  const config = BADGE_CONFIG[cls] ?? BADGE_CONFIG["needs_more_info"];
  const Icon = config.icon;

  async function submitAdditional() {
    if (!additionalText.trim() || !result.commentRef) return;
    setIsSubmitting(true);
    try {
      await fetch("/api/jira/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentRef: result.commentRef, text: additionalText }),
      });
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Duplicate banner ─────────────────────────────────────────────── */}
      {result.isDuplicate && !dupDismissed && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-800">
                {t("result.duplicate.title", lang)}
              </p>
              <p className="text-xs text-amber-700">
                {t("result.duplicate.report", lang)}
                {result.duplicateTicketNumber ? ` #${result.duplicateTicketNumber}` : ""}
                {result.duplicateFriendlyStatus
                  ? ` · ${t(`status.${result.duplicateFriendlyStatus}` as Parameters<typeof t>[0], lang)}`
                  : ""}
                {result.duplicateCreatedAt
                  ? ` · ${t("result.duplicate.reportedAgo", lang)} ${relativeTime(result.duplicateCreatedAt, lang)}`
                  : ""}
              </p>
            </div>
          </div>
          {/* Confidence actions */}
          <div className="flex gap-2 ml-8">
            {result.duplicateConfidence === "high" ? (
              <button
                type="button"
                onClick={() => setDupDismissed(true)}
                className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors"
              >
                {t("result.duplicate.sameIssue", lang)}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setDupDismissed(true)}
                  className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors"
                >
                  {t("result.duplicate.sameIssue", lang)}
                </button>
                <button
                  type="button"
                  onClick={() => setDupDismissed(false)}
                  className="px-3 py-1.5 border border-amber-300 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors"
                >
                  {t("result.duplicate.differentIssue", lang)}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Classification badge ─────────────────────────────────────────── */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-3 rounded-xl border",
          config.bg,
          config.border
        )}
      >
        <Icon className={cn("w-5 h-5 flex-shrink-0", config.text)} />
        <span className={cn("font-semibold text-sm", config.text)}>
          {t(`badge.${cls}` as Parameters<typeof t>[0], lang)}
        </span>
        {/* Severity pill — only shown for confirmed bugs with high impact */}
        {cls === "bug_confirmed" && result.severidad === "alta" && (
          <span className="ml-auto flex items-center gap-1 px-2 py-0.5 bg-red-600 text-white rounded-full text-xs font-semibold">
            <Flame className="w-3 h-3" />
            {lang === "es" ? "Impacto alto" : "High impact"}
          </span>
        )}
      </div>

      {/* ── AI Explanation ───────────────────────────────────────────────── */}
      {result.explanation && (
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
          {result.explanation}
        </p>
      )}

      {/* ── Ticket created ───────────────────────────────────────────────── */}
      {cls === "bug_confirmed" && !result.isDuplicate && result.ticketNumber && (
        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
          <Ticket className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-800">
            <p>{t("result.ticketCreated", lang)}</p>
            <p className="mt-1 font-semibold">
              {t("result.ticketNumber", lang)}-{result.ticketNumber}
            </p>
          </div>
        </div>
      )}

      {/* ── Help Center link (public only — whitelist enforced client-side too) ── */}
      {result.helpCenterLink &&
        /^https?:\/\/([\w-]+\.)*help\.humand\.co(\/|$)/i.test(result.helpCenterLink) && (
          <a
            href={result.helpCenterLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary-hover font-medium transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            {t("result.viewHelpCenter", lang)}
          </a>
        )}

      {/* ── CX Manager routing ───────────────────────────────────────────── */}
      {result.nextAction === "contact_cx_manager" && (
        <div className="flex gap-3 p-4 bg-primary-light border border-primary/20 rounded-xl">
          <Phone className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-primary">
              {result.cxOwnerName
                ? `${t("result.contactCxName", lang)} ${result.cxOwnerName}`
                : t("result.contactCx", lang)}
            </p>
            {!result.cxOwnerName && (
              <p className="text-xs text-gray-600">{t("result.contactCxFallback", lang)}</p>
            )}
          </div>
        </div>
      )}

      {/* ── expected_behavior feedback prompt ───────────────────────────── */}
      {cls === "expected_behavior" && feedbackSent === null && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-gray-500" />
            <p className="text-sm text-gray-700">{t("result.submitFeedback", lang)}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFeedbackSent(true)}
              className="flex-1 px-3 py-2 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary-hover transition-colors"
            >
              {t("result.yes", lang)}
            </button>
            <button
              onClick={() => setFeedbackSent(false)}
              className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-300 transition-colors"
            >
              {t("result.no", lang)}
            </button>
          </div>
        </div>
      )}
      {feedbackSent === true && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {t("result.ticketCreated", lang)}
        </div>
      )}

      {/* ── Needs more info ──────────────────────────────────────────────── */}
      {cls === "needs_more_info" && result.commentRef && !submitted && (
        <div className="space-y-2">
          <textarea
            value={additionalText}
            onChange={(e) => setAdditionalText(e.target.value)}
            placeholder={t("result.additionalPlaceholder", lang)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <button
            onClick={submitAdditional}
            disabled={!additionalText.trim() || isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {t("result.submitAdditional", lang)}
          </button>
        </div>
      )}

      {submitted && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {t("reports.addInfo.sent", lang)}
        </div>
      )}

      {/* ── Report another ───────────────────────────────────────────────── */}
      <button
        onClick={onReportAnother}
        className="flex items-center gap-2 w-full justify-center px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
      >
        <RotateCcw className="w-4 h-4" />
        {t("result.reportAnother", lang)}
      </button>
    </div>
  );
}
