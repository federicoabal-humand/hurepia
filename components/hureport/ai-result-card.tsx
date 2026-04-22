"use client";

import { Bug, Settings, RefreshCw, CheckCircle, HelpCircle, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MockAiResult } from "@/lib/mock-data";
import type { Classification } from "@/lib/mappings";
import type { Lang } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { useState } from "react";

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

interface Props {
  result: MockAiResult;
  lang: Lang;
  onReportAnother: () => void;
}

export function AiResultCard({ result, lang, onReportAnother }: Props) {
  const [additionalText, setAdditionalText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const config = BADGE_CONFIG[result.classification];
  const Icon = config.icon;

  async function submitAdditional() {
    if (!additionalText.trim()) return;
    setIsSubmitting(true);
    try {
      await fetch("/api/jira/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketNumber: result.ticketNumber,
          comment: additionalText,
        }),
      });
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={cn("rounded-lg border p-4 space-y-3", config.bg, config.border)}>
      {/* Classification badge */}
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", config.text)} />
        <span className={cn("text-sm font-semibold", config.text)}>
          {t(`badge.${result.classification}` as Parameters<typeof t>[0], lang)}
        </span>
      </div>

      {/* Ticket number for confirmed bugs */}
      {result.classification === "bug_confirmed" && result.ticketNumber && (
        <div className="flex items-center gap-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-1.5">
          <Ticket className="h-3.5 w-3.5" />
          <span>
            {t("result.ticketCreated", lang)}{" "}
            <strong>
              {t("result.ticketNumber", lang)}-{result.ticketNumber}
            </strong>
          </span>
        </div>
      )}

      {/* AI explanation */}
      <p className="text-sm text-gray-700">{result.explanation}</p>

      {/* Fix steps (config / cache) */}
      {result.fixSteps && (
        <ol className="space-y-1 pl-4 text-sm text-gray-700 list-decimal">
          {result.fixSteps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      )}

      {/* Documentation link (expected_behavior) */}
      {result.docUrl && (
        <a
          href={result.docUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm font-medium text-teal-600 underline hover:text-teal-800"
        >
          {t("result.viewDocs", lang)}
        </a>
      )}

      {/* Follow-up questions (needs_more_info) */}
      {result.questions && !submitted && (
        <div className="space-y-2">
          <ul className="space-y-1 pl-4 text-sm text-gray-700 list-disc">
            {result.questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
          <textarea
            value={additionalText}
            onChange={(e) => setAdditionalText(e.target.value)}
            placeholder={t("result.additionalPlaceholder", lang)}
            className="w-full rounded-md border border-orange-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 h-20 resize-none"
          />
          <button
            onClick={submitAdditional}
            disabled={isSubmitting || !additionalText.trim()}
            className="w-full rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "…" : t("result.submitAdditional", lang)}
          </button>
        </div>
      )}

      {submitted && (
        <p className="text-sm font-medium text-green-700">
          {t("reports.addInfo.sent", lang)}
        </p>
      )}

      {/* Report another */}
      <button
        onClick={onReportAnother}
        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        {t("result.reportAnother", lang)}
      </button>
    </div>
  );
}
