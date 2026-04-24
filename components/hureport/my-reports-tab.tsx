"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Send,
  CheckCircle,
  AlertCircle,
  Settings,
  RefreshCw,
  HelpCircle,
  RefreshCcw,
  Lightbulb,
  Wrench,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t, type Lang } from "@/lib/i18n";
import type { FriendlyStatus, Classification } from "@/lib/mappings";

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
  communityName: string;
  isWidgetOpen: boolean;
  /** If present, fetches tickets by instanceId label (most precise) */
  instanceId?: number;
  /** If present and no instanceId, fetches tickets by reporter email */
  adminEmail?: string;
  /** commentRef of a just-created ticket; passed to /api/reports for immediate lookup */
  freshRef?: string;
}

const STATUS_STYLES: Record<FriendlyStatus, string> = {
  reported: "bg-gray-100 text-gray-600",
  under_review: "bg-blue-100 text-blue-700",
  developing_fix: "bg-amber-100 text-amber-700",
  resolved: "bg-green-100 text-green-700",
};

const CLASSIFICATION_ICON: Record<Classification, React.ElementType> = {
  bug_confirmed: AlertCircle,
  configuration_error: Settings,
  cache_browser: RefreshCw,
  expected_behavior: CheckCircle,
  needs_more_info: HelpCircle,
  feature_request: Lightbulb,
  bug_known: Wrench,
  bug_already_resolved: CheckCircle,
};

const POLL_INTERVAL_MS = 30_000;

// ─── localStorage hide helpers ────────────────────────────────────────────────
// "Delete from history" is purely visual: the ticket is hidden locally for this
// admin, but the Jira ticket and its cf[10046] are NEVER touched.

const HIDDEN_KEY_PREFIX = "hureport:hidden:";

function getHiddenTickets(identifier: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HIDDEN_KEY_PREFIX + identifier);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function addHiddenTicket(identifier: string, ticketId: string): void {
  const current = getHiddenTickets(identifier);
  if (!current.includes(ticketId)) {
    current.push(ticketId);
    localStorage.setItem(HIDDEN_KEY_PREFIX + identifier, JSON.stringify(current));
  }
}

/**
 * Strips the "[Platform] Module | " prefix from new-format Jira summaries so
 * community / platform details never leak into the admin-facing card UI.
 *
 * "[Admin] Users | No puedo eliminar usuarios"  →  "No puedo eliminar usuarios"
 * "Old format without pipe"                      →  "Old format without pipe" (unchanged)
 */
function cleanSummaryForDisplay(text: string | undefined): string {
  if (!text) return "";
  // New format starts with "[X] ... | description"
  const pipeIdx = text.indexOf(" | ");
  if (pipeIdx !== -1 && text.startsWith("[")) {
    return text.slice(pipeIdx + 3).trim();
  }
  return text;
}

export function MyReportsTab({
  lang,
  communityName,
  instanceId,
  adminEmail,
  isWidgetOpen,
  freshRef,
}: MyReportsTabProps) {
  const [tickets, setTickets] = useState<TicketResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addInfoId, setAddInfoId] = useState<string | null>(null);
  const [infoText, setInfoText] = useState("");
  const [sending, setSending] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  // State for remove-from-history — local-only, no Jira side effects
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);

  // Stable key for localStorage: prefer adminEmail, fall back to communityName
  const storageKey = adminEmail || communityName || "default";

  // Set of ticket IDs hidden by this admin (persisted in localStorage)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  // Hydrate from localStorage after mount (avoids SSR/hydration mismatch)
  useEffect(() => {
    setHiddenIds(new Set(getHiddenTickets(storageKey)));
    // storageKey is stable per session — intentionally run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchTickets = useCallback(
    async (isBackground = false, retryFreshRef?: string) => {
      if (!mountedRef.current) return;
      if (isBackground) setRefreshing(true);
      else setLoading(true);
      try {
        // Build query params in priority order: instanceId > adminEmail > communityName
        const sp = new URLSearchParams();
        if (instanceId) {
          sp.set("instanceId", String(instanceId));
        } else if (adminEmail) {
          sp.set("adminEmail", adminEmail);
        } else if (communityName) {
          sp.set("communityName", communityName);
        }
        // Pass freshRef so the server can fetch the new ticket directly by key,
        // bypassing Jira JQL indexing delay for recently created tickets
        const ref = retryFreshRef ?? freshRef;
        if (ref) sp.set("freshRef", ref);

        const res = await fetch(`/api/reports?${sp.toString()}`);
        const data: TicketResponse[] = await res.json();
        if (mountedRef.current) setTickets(data);
      } catch {
        // keep current tickets on error
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [communityName, instanceId, adminEmail, freshRef]
  );

  // When a fresh ticket ref arrives, trigger an immediate refresh
  useEffect(() => {
    if (freshRef) fetchTickets(true, freshRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshRef]);

  // Start/stop polling based on widget open state and page visibility
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchTickets(true);
      }
    }, POLL_INTERVAL_MS);
  }, [fetchTickets]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Initial fetch + setup polling lifecycle
  useEffect(() => {
    mountedRef.current = true;
    fetchTickets(false);
    startPolling();

    // Re-fetch immediately when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") fetchTickets(true);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchTickets, startPolling, stopPolling]);

  // Pause polling when widget is closed; resume when reopened
  useEffect(() => {
    if (isWidgetOpen) {
      fetchTickets(true);
      startPolling();
    } else {
      stopPolling();
    }
  }, [isWidgetOpen, fetchTickets, startPolling, stopPolling]);

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

  // Local-only hide: writes to localStorage, re-renders immediately, never touches Jira.
  const handleRemoveFromHistory = (ticket: TicketResponse) => {
    addHiddenTicket(storageKey, ticket.id);
    setHiddenIds((prev) => new Set([...prev, ticket.id]));
    setRemoveConfirmId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
        <p className="text-xs text-gray-400 max-w-xs">
          {lang === "es"
            ? "Los tickets históricos anteriores a HuReport AI no aparecen en esta vista."
            : "Tickets created before HuReport AI are not shown in this view."}
        </p>
      </div>
    );
  }

  // Apply local hide filter before rendering
  const visibleTickets = tickets.filter((t) => !hiddenIds.has(t.id));

  if (!loading && visibleTickets.length === 0 && tickets.length > 0) {
    // All tickets hidden locally — show same empty state
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
      {/* Refresh indicator */}
      {refreshing && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400 pb-1">
          <RefreshCcw className="w-3 h-3 animate-spin" />
          <span>{lang === "es" ? "Actualizando..." : "Refreshing..."}</span>
        </div>
      )}

      {visibleTickets.map((ticket) => {
        const isExpanded = expandedId === ticket.id;
        const isAddingInfo = addInfoId === ticket.id;
        const wasSent = sentIds.has(ticket.id);
        const cls = ticket.classification ?? "bug_confirmed";
        const ClassIcon = CLASSIFICATION_ICON[cls as Classification] ?? AlertCircle;

        return (
          <div key={ticket.id} className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Row */}
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="text-xs font-semibold text-primary whitespace-nowrap">
                {t("reports.ticket", lang)}-{ticket.ticketNumber}
              </span>
              <span className="flex-1 text-sm text-gray-800 truncate">{cleanSummaryForDisplay(ticket.summary)}</span>
              <span
                className={cn(
                  "flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium",
                  STATUS_STYLES[ticket.status]
                )}
              >
                {t(`status.${ticket.status}` as Parameters<typeof t>[0], lang)}
              </span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-4">
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

                <p className="text-sm text-gray-700 leading-relaxed">{cleanSummaryForDisplay(ticket.description)}</p>

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

                {ticket.url && (
                  <a
                    href={ticket.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline break-all"
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
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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

                {/* Remove from history (only for resolved tickets) */}
                {ticket.status === "resolved" &&
                  (removeConfirmId === ticket.id ? (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                      <p className="text-xs text-gray-700">
                        {lang === "es"
                          ? "Este ticket ya está resuelto. ¿Querés quitarlo de tu historial? El ticket sigue vivo para otras comunidades."
                          : lang === "pt"
                          ? "Este ticket foi resolvido. Se removê-lo, deixa de aparecer no seu histórico."
                          : lang === "fr"
                          ? "Ce ticket est résolu. Si vous le retirez, il n'apparaîtra plus dans votre historique."
                          : "This ticket is resolved. Remove it from your history? It stays active for other communities."}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleRemoveFromHistory(ticket)}
                          className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors"
                        >
                          {lang === "es"
                            ? "Sí, quitar"
                            : lang === "pt"
                            ? "Sim, remover"
                            : lang === "fr"
                            ? "Oui, retirer"
                            : "Yes, remove"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoveConfirmId(null)}
                          className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50 transition-colors"
                        >
                          {lang === "es" ? "Cancelar" : "Cancel"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRemoveConfirmId(ticket.id)}
                      className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {lang === "es"
                        ? "Quitar de mi historial"
                        : lang === "pt"
                        ? "Remover do meu histórico"
                        : lang === "fr"
                        ? "Retirer de mon historique"
                        : "Remove from my history"}
                    </button>
                  ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
