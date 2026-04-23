"use client";

import { useState, useEffect, useCallback } from "react";
import { X, AlertTriangle, LogOut } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import { t, type Lang } from "@/lib/i18n";
import { ReportTab } from "./report-tab";
import { MyReportsTab } from "./my-reports-tab";
import { CommunityGate } from "./community-gate";

const STORAGE_KEY = "hureport_community";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface StoredCommunity {
  nameRaw: string;
  selectedAt: number;
}

function readCommunity(): StoredCommunity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored: StoredCommunity = JSON.parse(raw);
    if (Date.now() - stored.selectedAt > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return stored;
  } catch {
    return null;
  }
}

function clearCommunity() {
  localStorage.removeItem(STORAGE_KEY);
}

export function HuReportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [lang, setLang] = useState<Lang>("es");
  const [activeTab, setActiveTab] = useState("report");
  const [mounted, setMounted] = useState(false);
  const [community, setCommunity] = useState<StoredCommunity | null>(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setCommunity(readCommunity());
    setMounted(true);
  }, []);

  // Reload community when panel opens (in case TTL just expired)
  const handleOpen = useCallback(() => {
    setCommunity(readCommunity());
    setIsOpen(true);
  }, []);

  const toggleLang = () => setLang((l) => (l === "es" ? "en" : "es"));

  // Called by CommunityGate after it saves to localStorage
  const handleGateComplete = () => {
    setCommunity(readCommunity());
  };

  const handleChangeCommunity = () => {
    const confirmed = window.confirm(
      lang === "es"
        ? "¿Cambiar comunidad? Se borrarán tus reportes actuales de esta vista."
        : "Change community? Your current reports view will be cleared."
    );
    if (!confirmed) return;
    clearCommunity();
    setCommunity(null);
    setActiveTab("report");
  };

  if (!mounted) return null;

  return (
    <>
      {/* ─── Trigger button ──────────────────────────────────────────────── */}
      <div className="fixed top-6 right-6 z-50">
        <button
          onClick={() => (isOpen ? setIsOpen(false) : handleOpen())}
          aria-label={t("trigger.label", lang)}
          className={cn(
            "relative flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg transition-all duration-200",
            "bg-primary hover:bg-primary-hover text-white font-semibold text-sm",
            isOpen && "bg-primary-hover"
          )}
        >
          {!isOpen && (
            <span className="absolute inset-0 rounded-full bg-blue-400 opacity-40 animate-ping pointer-events-none" />
          )}
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{t("trigger.label", lang)}</span>
        </button>
      </div>

      {/* ─── Backdrop ────────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 lg:bg-transparent"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ─── Widget panel ────────────────────────────────────────────────── */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-full max-w-[480px]",
          "bg-white shadow-hu-xl flex flex-col",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-base font-semibold text-gray-900 leading-tight">
                {t("header.title", lang)}
              </h2>
              {community && (
                <p className="text-xs text-gray-400 leading-tight">{community.nameRaw}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Change community */}
            {community && (
              <button
                onClick={handleChangeCommunity}
                title={t("header.changeCommunity", lang)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
            {/* EN / ES toggle */}
            <button
              onClick={toggleLang}
              className="px-2.5 py-1 text-xs font-semibold rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {t("lang.toggle", lang)}
            </button>
            {/* Close */}
            <button
              onClick={() => setIsOpen(false)}
              aria-label={t("header.close", lang)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Gate or tabs ─────────────────────────────────────────────── */}
        {!community ? (
          <div className="flex-1 overflow-y-auto">
            <CommunityGate lang={lang} onComplete={handleGateComplete} />
          </div>
        ) : (
          <Tabs.Root
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-col flex-1 min-h-0"
          >
            <Tabs.List className="flex border-b border-gray-100 px-5 flex-shrink-0">
              {(["report", "myReports"] as const).map((tab) => (
                <Tabs.Trigger
                  key={tab}
                  value={tab}
                  className={cn(
                    "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    activeTab === tab
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  )}
                >
                  {tab === "report" ? t("tab.report", lang) : t("tab.myReports", lang)}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            <Tabs.Content
              value="report"
              className="flex-1 overflow-y-auto px-5 py-5 focus:outline-none"
            >
              <ReportTab lang={lang} communityNameRaw={community.nameRaw} />
            </Tabs.Content>

            <Tabs.Content
              value="myReports"
              className="flex-1 overflow-y-auto px-5 py-5 focus:outline-none"
            >
              <MyReportsTab
                lang={lang}
                communityName={community.nameRaw}
                isWidgetOpen={isOpen}
              />
            </Tabs.Content>
          </Tabs.Root>
        )}
      </div>
    </>
  );
}
