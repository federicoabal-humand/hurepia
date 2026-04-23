"use client";

import { useState, useRef } from "react";
import { Upload, X, Loader2, Send, AlertTriangle, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODULES, PLATFORMS } from "@/lib/mappings";
import { t, type Lang } from "@/lib/i18n";
import type { ChatTurn } from "@/lib/llm";
import { AiResultCard } from "./ai-result-card";

interface ReportTabProps {
  lang: Lang;
  communityNameRaw: string;
}

interface FormState {
  module: string;
  platforms: string[];
  whatHappened: string;
  whatExpected: string;
  isBlocking: boolean;
  usersAffected: "1" | "many";
  files: File[];
  url: string;
  email: string;
}

const INITIAL_FORM: FormState = {
  module: "",
  platforms: [],
  whatHappened: "",
  whatExpected: "",
  isBlocking: false,
  usersAffected: "1",
  files: [],
  url: "",
  email: "",
};

// Shape of the full API response from /api/classify
export interface ClassifyApiResponse {
  action: "ask" | "classify";
  question?: string;
  classification?: string;
  summary?: string;
  explanation?: string;
  help_center_link?: string;
  next_action?: "contact_cx_manager" | "retry_after_fix" | "resolve" | null;
  keywords?: string[];
  // New ticket
  ticketNumber?: number;
  commentRef?: string;
  // Duplicate (safe fields only — no internal Jira data)
  isDuplicate?: boolean;
  duplicateConfidence?: "high" | "low";
  duplicateTicketNumber?: number;
  duplicateFriendlyStatus?: string;
  duplicateCreatedAt?: string;
  duplicateCommentRef?: string;
  cxOwnerName?: string | null;
}

// What we pass to AiResultCard
export interface ResolvedResult {
  classification: string;
  explanation: string;
  summary?: string;
  ticketNumber?: number;
  commentRef?: string;
  isDuplicate?: boolean;
  duplicateConfidence?: "high" | "low";
  duplicateTicketNumber?: number;
  duplicateFriendlyStatus?: string;
  duplicateCreatedAt?: string;
  duplicateCommentRef?: string;
  helpCenterLink?: string;
  nextAction?: "contact_cx_manager" | "retry_after_fix" | "resolve" | null;
  cxOwnerName?: string | null;
}

type Step = "form" | "loading" | "asking" | "result";

export function ReportTab({ lang, communityNameRaw }: ReportTabProps) {
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI state
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [askCount, setAskCount] = useState(0);
  const [followUpAnswer, setFollowUpAnswer] = useState("");
  const [resolved, setResolved] = useState<ResolvedResult | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const togglePlatform = (p: string) =>
    set(
      "platforms",
      form.platforms.includes(p)
        ? form.platforms.filter((x) => x !== p)
        : [...form.platforms, p]
    );

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    set("files", [...form.files, ...Array.from(incoming)]);
  };

  const removeFile = (i: number) =>
    set("files", form.files.filter((_, idx) => idx !== i));

  // ─── Main submit ──────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await runClassify([], 0);
  }

  async function runClassify(currentHistory: ChatTurn[], currentAskCount: number) {
    setStep("loading");
    try {
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: lang,
          module: form.module,
          platforms: form.platforms,
          communityNameRaw,
          whatHappened: form.whatHappened,
          whatExpected: form.whatExpected,
          isBlocking: form.isBlocking,
          usersAffected: form.usersAffected,
          history: currentHistory,
          askCount: currentAskCount,
        }),
      });

      const data: ClassifyApiResponse = await res.json();

      if (data.action === "ask" && data.question) {
        setPendingQuestion(data.question);
        setHistory(currentHistory);
        setAskCount(currentAskCount + 1);
        setStep("asking");
        return;
      }

      // action === "classify" — API handled everything
      setResolved({
        classification: data.classification ?? "needs_more_info",
        explanation: data.explanation ?? "",
        summary: data.summary,
        ticketNumber: data.ticketNumber,
        commentRef: data.commentRef,
        isDuplicate: data.isDuplicate,
        duplicateConfidence: data.duplicateConfidence,
        duplicateTicketNumber: data.duplicateTicketNumber,
        duplicateFriendlyStatus: data.duplicateFriendlyStatus,
        duplicateCreatedAt: data.duplicateCreatedAt,
        duplicateCommentRef: data.duplicateCommentRef,
        helpCenterLink: data.help_center_link,
        nextAction: data.next_action,
        cxOwnerName: data.cxOwnerName,
      });
      setStep("result");
    } catch {
      setStep("form");
    }
  }

  // ─── Follow-up answer ─────────────────────────────────────────────────────

  async function handleFollowUp() {
    if (!followUpAnswer.trim() || !pendingQuestion) return;
    const newHistory: ChatTurn[] = [
      ...history,
      { role: "assistant", content: pendingQuestion },
      { role: "user", content: followUpAnswer.trim() },
    ];
    setHistory(newHistory);
    setFollowUpAnswer("");
    setPendingQuestion(null);
    await runClassify(newHistory, askCount);
  }

  // ─── Reset ────────────────────────────────────────────────────────────────

  function reset() {
    setForm(INITIAL_FORM);
    setPendingQuestion(null);
    setHistory([]);
    setAskCount(0);
    setFollowUpAnswer("");
    setResolved(null);
    setStep("form");
  }

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (step === "loading") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-gray-500">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm font-medium">{t("form.submit.loading", lang)}</p>
      </div>
    );
  }

  // ─── Follow-up question ───────────────────────────────────────────────────

  if (step === "asking" && pendingQuestion) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3 p-4 bg-primary-light border border-primary/20 rounded-xl">
          <MessageCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-800 leading-relaxed">{pendingQuestion}</p>
        </div>
        <textarea
          value={followUpAnswer}
          onChange={(e) => setFollowUpAnswer(e.target.value)}
          placeholder={lang === "es" ? "Tu respuesta..." : "Your answer..."}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleFollowUp();
          }}
        />
        <button
          onClick={handleFollowUp}
          disabled={!followUpAnswer.trim()}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          <Send className="w-4 h-4" />
          {lang === "es" ? "Responder" : "Submit answer"}
        </button>
      </div>
    );
  }

  // ─── AI Result ────────────────────────────────────────────────────────────

  if (step === "result" && resolved) {
    return <AiResultCard result={resolved} lang={lang} onReportAnother={reset} />;
  }

  // ─── Form ─────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Community read-only indicator */}
      <p className="text-sm text-gray-600">
        <span className="font-medium">{t("gate.reportingFor", lang)}</span>{" "}
        <span className="text-primary font-semibold">{communityNameRaw}</span>
      </p>

      {/* Issue details */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          {t("form.section.issue", lang)}
        </p>
        <div className="space-y-4">
          {/* Module */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              {t("form.module.label", lang)}
            </label>
            <select
              value={form.module}
              onChange={(e) => set("module", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            >
              <option value="">{t("form.module.placeholder", lang)}</option>
              {MODULES.map((m) => (
                <option key={m} value={m}>
                  {t(`module.${m}` as Parameters<typeof t>[0], lang)}
                </option>
              ))}
            </select>
          </div>

          {/* Platforms */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              {t("form.platform.label", lang)}
            </label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                    form.platforms.includes(p)
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-gray-600 border-gray-200 hover:border-primary/40"
                  )}
                >
                  {t(`platform.${p}` as Parameters<typeof t>[0], lang)}
                </button>
              ))}
            </div>
          </div>

          {/* What happened */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              {t("form.whatHappened.label", lang)}
            </label>
            <textarea
              value={form.whatHappened}
              onChange={(e) => set("whatHappened", e.target.value)}
              placeholder={t("form.whatHappened.placeholder", lang)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          {/* What expected */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              {t("form.whatExpected.label", lang)}
            </label>
            <textarea
              value={form.whatExpected}
              onChange={(e) => set("whatExpected", e.target.value)}
              placeholder={t("form.whatExpected.placeholder", lang)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none h-16 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          {/* Blocking */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              {t("form.blocking.label", lang)}
            </label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
              <button
                type="button"
                onClick={() => set("isBlocking", true)}
                className={cn(
                  "px-4 py-1.5 transition-colors",
                  form.isBlocking ? "bg-red-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                )}
              >
                {t("form.blocking.yes", lang)}
              </button>
              <button
                type="button"
                onClick={() => set("isBlocking", false)}
                className={cn(
                  "px-4 py-1.5 border-l border-gray-200 transition-colors",
                  !form.isBlocking ? "bg-primary text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                )}
              >
                {t("form.blocking.no", lang)}
              </button>
            </div>
          </div>

          {/* Users affected */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              {t("form.usersAffected.label", lang)}
            </label>
            <div className="flex gap-4">
              {(["1", "many"] as const).map((val) => (
                <label key={val} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="usersAffected"
                    value={val}
                    checked={form.usersAffected === val}
                    onChange={() => set("usersAffected", val)}
                    className="accent-primary"
                  />
                  <span className="text-sm text-gray-700">
                    {t(val === "1" ? "form.usersAffected.one" : "form.usersAffected.many", lang)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Evidence */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          {t("form.section.evidence", lang)}
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              {t("form.evidence.label", lang)}
            </label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all",
                dragOver ? "border-primary bg-primary-light" : "border-gray-200 hover:border-primary/40 hover:bg-gray-50"
              )}
            >
              <Upload className="w-5 h-5 text-gray-400" />
              <p className="text-xs text-gray-500">{t("form.evidence.hint", lang)}</p>
              <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => addFiles(e.target.files)} />
            </div>

            {form.files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.files.map((file, i) => (
                  <div key={i} className="relative group">
                    {file.type.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={URL.createObjectURL(file)} alt={file.name} className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                    ) : (
                      <div className="w-16 h-16 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center p-1">
                        <span className="text-xs text-gray-500 text-center truncate w-full">{file.name}</span>
                      </div>
                    )}
                    <button type="button" onClick={() => removeFile(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">{t("form.url.label", lang)}</label>
            <input type="url" value={form.url} onChange={(e) => set("url", e.target.value)} placeholder={t("form.url.placeholder", lang)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">{t("form.email.label", lang)}</label>
            <input type="text" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder={t("form.email.placeholder", lang)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>
        </div>
      </section>

      <button type="submit" className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-semibold transition-colors shadow-sm">
        {t("form.submit", lang)}
      </button>
    </form>
  );
}
