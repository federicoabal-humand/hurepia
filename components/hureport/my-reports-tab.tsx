"use client";

import { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Send,
  CheckCircle,
  Bug,
  Settings,
  RefreshCw,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t, type Lang } from "@/lib/i18n";
import type { FriendlyStatus, Classification } from "@/lib/mappings";

// Ticket shape returned by /api/reports — no jiraKey, has commentRef
interface TicketResponse {
  id: string;
  ticketNumber: number;
  summary: string;
  module: string;
  status: FriendlyStatus;
  date: string;
  commentRef: string;
  description?: string;
  classification?: Classification;
  platforms?: string[];
  isBlocking?: boolean;
  usersAffected?: "1" | "many";
  evidenceUrls?: string[];
  url?: string;
  affectedUserEmail?: string;
}

interface MyReportsTabProps {
  lang: Lang;
  communityId?: string;
}

const STATUS_STYLES: Record<FriendlyStatus, string> = {
  reported: "bg-gray-100 text-gray-600",
  under_review: "bg-blue-100 text-blue-700",
  developing_fix: "bg-amber-100 text-amber-700",
  resolved: "bg-green-100 text-green-700",
};

const CLASSIFICATION_ICON: Record<Classification, React.ElementType> = {
  bug_confirmed: Bug,
  configuration_error: Settings,
  cache_browser: RefreshCw,
  expected_behavior: CheckCircle,
  needs_more_info: HelpCircle,
};

export function MyReportsTab({ lang, communityId }: MyReportsTabProps) {
  const [tickets, setTickets] = useState<TicketResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addInfoId, setAddInfoId] = useState<string | null>(null);
  const [infoText, setInfoText] = useState("");
  const [sending, setSending] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchTickets = async () => {
      setLoading(true);
      try {
        const params = communityId ? `?communityName=${encodeURIComponent(communityId)}` : "";
        const res = await fetch(`/api/reports${params}`);
        const data = await res.json();
        setTickets(data);
      } finally {
        setLoading(false);
      }
    };
    fetchTickets();
  }, [communityId]);

  const handleAddInfo = async (ticketId: string, commentRef: string) => {
    if (!infoText.trim()) return;
    setSending(true);
    try {
      await fetch("/api/jira/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentRef, text: infoText }),
      });
      setSentIds((prev) => new Set([...prev, ticketId]));
      setAddInfoId(null);
      setInfoText("");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 text-center px-4">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
          <CheckCircle className="w-6 h-6 text-gray-400" />
        </div>
        <p className="text-sm text-gray-500">{t("reports.empty", lang)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tickets.map((ticket) => {
        const isExpanded = expandedId === ticket.id;
        const isAddingInfo = addInfoId === ticket.id;
        const wasSent = sentIds.has(ticket.id);
        const cls = ticket.classification ?? "bug_confirmed";
        const ClassIcon = CLASSIFICATION_ICON[cls as Classification] ?? Bug;

        return (
          <div
            key={ticket.id}
            className="border border-gray-200 rounded-xl overflow-hidden"
          >
            {/* Row */}
            <button
              type="button"
              onClick={() =>
                setExpandedId(isExpanded ? null : ticket.id)
              }
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              {/* Ticket number */}
              <span className="text-xs font-semibold text-teal-600 whitespace-nowrap">
                {t("reports.ticket", lang)}-{ticket.ticketNumber}
              </span>

              {/* Summary */}
              <span className="flex-1 text-sm text-gray-800 truncate">
                {ticket.summary}
              </span>

              {/* Status badge */}
              <span
                className={cn(
                  "flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium",
                  STATUS_STYLES[ticket.status]
                )}
              >
                {t(`status.${ticket.status}` as Parameters<typeof t>[0], lang)}
              </span>

              {/* Chevron */}
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-4">
                {/* Meta row */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span>
                    <span className="font-medium">{t("reports.date", lang)}:</span>{" "}
                    {ticket.date}
                  </span>
                  <span>
                    <span className="font-medium">{t("reports.module", lang)}:</span>{" "}
                    {t(`module.${ticket.module}` as Parameters<typeof t>[0], lang)}
                  </span>
                  <span className="flex items-center gap-1">
                    <ClassIcon className="w-3 h-3" />
                    {t(`badge.${cls}` as Parameters<typeof t>[0], lang)}
                  </span>
                </div>

                {/* Platforms */}
                <div className="flex flex-wrap gap-1">
                  {(ticket.platforms ?? []).map((p) => (
                    <span
                      key={p}
                      className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs"
                    >
                      {t(`platform.${p}` as Parameters<typeof t>[0], lang)}
                    </span>
                  ))}
                </div>

                {/* Description */}
                <p className="text-sm text-gray-700 leading-relaxed">
                  {ticket.description}
                </p>

                {/* Evidence thumbnails */}
                {(ticket.evidenceUrls ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {(ticket.evidenceUrls ?? []).map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={url}
                        alt={`Evidence ${i + 1}`}
                        className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                      />
                    ))}
                  </div>
                )}

                {/* URL */}
                {ticket.url && (
                  <a
                    href={ticket.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-teal-600 underline break-all"
                  >
                    {ticket.url}
                  </a>
                )}

                {/* Add more info */}
                {wasSent ? (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    {t("reports.addInfo.sent", lang)}
                  </div>
                ) : isAddingInfo ? (
                  <div className="space-y-2">
                    <textarea
                      value={infoText}
                      onChange={(e) => setInfoText(e.target.value)}
                      placeholder={t("reports.addInfo.placeholder", lang)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddInfo(ticket.id, ticket.commentRef)}
                        disabled={!infoText.trim() || sending}
                        className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
                      >
                        {sending ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Send className="w-3 h-3" />
                        )}
                        {t("reports.addInfo.submit", lang)}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddInfoId(null);
                          setInfoText("");
                        }}
                        className="px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                      >
                        {t("reports.addInfo.cancel", lang)}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddInfoId(ticket.id)}
                    className="flex items-center gap-1.5 px-3 py-2 border border-primary/30 text-primary rounded-lg text-xs font-medium hover:bg-primary-light transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t("reports.addInfo", lang)}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
