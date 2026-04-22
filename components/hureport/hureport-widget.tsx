"use client";

import { useState, useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import { t, type Lang } from "@/lib/i18n";
import { ReportTab } from "./report-tab";
import { MyReportsTab } from "./my-reports-tab";

export function HuReportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [lang, setLang] = useState<Lang>("es");
  const [activeTab, setActiveTab] = useState("report");
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => setMounted(true), []);

  const toggleLang = () => setLang((l) => (l === "es" ? "en" : "es"));

  if (!mounted) return null;

  return (
    <>
      {/* ─── Trigger button ──────────────────────────────────────────────── */}
      <div className="fixed top-6 right-6 z-50">
        <button
          onClick={() => setIsOpen((v) => !v)}
          aria-label={t("trigger.label", lang)}
          className={cn(
            "relative flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg transition-all duration-200",
            "bg-primary hover:bg-primary-hover text-white font-semibold text-sm",
            isOpen && "bg-primary-hover"
          )}
        >
          {/* Pulse ring */}
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
          "bg-white shadow-2xl flex flex-col",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-gray-900">
              {t("header.title", lang)}
            </h2>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Tabs */}
        <Tabs.Root
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-col flex-1 min-h-0"
        >
          {/* Tab list */}
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
                {tab === "report"
                  ? t("tab.report", lang)
                  : t("tab.myReports", lang)}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          {/* Tab panels */}
          <Tabs.Content
            value="report"
            className="flex-1 overflow-y-auto px-5 py-5 focus:outline-none"
          >
            <ReportTab lang={lang} />
          </Tabs.Content>

          <Tabs.Content
            value="myReports"
            className="flex-1 overflow-y-auto px-5 py-5 focus:outline-none"
          >
            <MyReportsTab lang={lang} />
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </>
  );
}
