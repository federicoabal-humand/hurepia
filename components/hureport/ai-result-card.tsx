"use client";

import { useState } from "react";
import {
  Bug,
  Settings,
  RefreshCw,
  CheckCircle,
  HelpCircle,
  ExternalLink,
  RotateCcw,
  Send,
  Ticket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Classification } from "@/lib/mappings";
import type { ResolvedResult } from "./report-tab";
import { t, type Lang } from "@/lib/i18n";

interface Props {
  result: ResolvedResult;
  lang: Lang;
  onReportAnother: () => void;
}

const BADGE_CONFIG: Record<
  Classification,
  { icon: React.ElementType; bg: string; text: string; border: string }
> = {
  bug_confirmed: {
    icon: Bug,
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
};

export function AiResultCard({ result, lang, onReportAnother }: Props) {
  const [feedbackSent, setFeedbackSent] = useState<boolean | null>(null);
  const [additionalText, setAdditionalText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const config = BADGE_CONFIG[result.classification as Classification];
  const Icon = config?.icon ?? Bug;

  async function submitAdditional() {
    if (!additionalText.trim() || !result.commentRef) return;
    setIsSubmitting(true);
    try {
      await fetch("/api/jira/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentRef: result.commentRef,
          text: additionalText,
        }),
      });
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Classification badge */}
      {config && (
        <div
          className={cn(
            "flex items-center gap-2 px-4 py-3 rounded-xl border",
            config.bg,
            config.border
          )}
        >
          <Icon className={cn("w-5 h-5 flex-shrink-0", config.text)} />
          <span className={cn("font-semibold text-sm", config.text)}>
            {t(`badge.${result.classification}` as Parameters<typeof t>[0], lang)}
          </span>
        </div>
      )}

      {/* AI Explanation */}
      {result.explanation && (
        <p className="text-sm text-gray-700 leading-relaxed">{result.explanation}</p>
      )}

      {/* Bug confirmed — ticket created */}
      {result.classification === "bug_confirmed" && result.ticketNumber && (
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

      {/* Fix steps (configuration_error / cache_browser) */}
      {result.fixSteps && result.fixSteps.length > 0 && (
        <ol className="space-y-2">
          {result.fixSteps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-700">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-light text-primary font-semibold text-xs flex items-center justify-center">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      )}

      {/* Expected behavior — doc link + feedback prompt */}
      {result.classification === "expected_behavior" && (
        <div className="space-y-3">
          {result.docUrl && (
            <a
              href={result.docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary-hover font-medium transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              {t("result.viewDocs", lang)}
            </a>
          )}
          {feedbackSent === null && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <p className="text-sm text-gray-700 mb-3">
                {t("result.submitFeedback", lang)}
              </p>
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
        </div>
      )}

      {/* Needs more info — submit additional via Jira comment */}
      {result.classification === "needs_more_info" && !submitted && (
        <div className="space-y-2">
          <textarea
            value={additionalText}
            onChange={(e) => setAdditionalText(e.target.value)}
            placeholder={t("result.additionalPlaceholder", lang)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <button
            onClick={submitAdditional}
            disabled={!additionalText.trim() || isSubmitting || !result.commentRef}
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

      {/* Report another */}
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
