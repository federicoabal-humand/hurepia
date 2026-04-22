"use client";

import { useState, useRef } from "react";
import { Upload, X, Loader2, Send, AlertTriangle, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODULES, PLATFORMS } from "@/lib/mappings";
import { t, type Lang } from "@/lib/i18n";
import type { ClassifyResult, ChatTurn } from "@/lib/llm";
import { CommunitySearch, type Community } from "./community-search";
import { AiResultCard } from "./ai-result-card";

interface ReportTabProps {
  lang: Lang;
}

interface FormState {
  community: Community | null;
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
  community: null,
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

// What we show in the result card (after full resolution)
export interface ResolvedResult {
  classification: ClassifyResult["classification"] & string;
  explanation: string;
  ticketNumber?: number;
  commentRef?: string;
  fixSteps?: string[];
  docUrl?: string;
  // duplicate info
  duplicateType?: "jira" | "notion";
  duplicateTitle?: string;
}

type Step =
  | "form"
  | "loading"
  | "asking" // Gemini wants a follow-up question
  | "creating" // checking duplicates + creating Jira
  | "result"
  | "duplicate";

export function ReportTab({ lang }: ReportTabProps) {
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI state
  const [classifyResult, setClassifyResult] = useState<ClassifyResult | null>(null);
  const [history, setHistory] = useState<ChatTurn[]>([]);
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
    await runClassify([]);
  }

  async function runClassify(currentHistory: ChatTurn[]) {
    setStep("loading");
    try {
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: lang,
          module: form.module,
          platforms: form.platforms,
          communityName: form.community?.name ?? "",
          whatHappened: form.whatHappened,
          whatExpected: form.whatExpected,
          isBlocking: form.isBlocking,
          usersAffected: form.usersAffected,
          history: currentHistory,
        }),
      });

      const aiResult: ClassifyResult = await res.json();
      setClassifyResult(aiResult);

      if (aiResult.action === "ask" && aiResult.question) {
        // Gemini wants one clarifying question — show inline chat
        setHistory(currentHistory);
        setStep("asking");
        return;
      }

      // action === "classify"
      await handleClassified(aiResult);
    } catch {
      setStep("form");
    }
  }

  // ─── Follow-up answer ─────────────────────────────────────────────────────

  async function handleFollowUp() {
    if (!followUpAnswer.trim() || !classifyResult?.question) return;
    const newHistory: ChatTurn[] = [
      ...history,
      { role: "assistant", content: classifyResult.question },
      { role: "user", content: followUpAnswer.trim() },
    ];
    setHistory(newHistory);
    setFollowUpAnswer("");
    await runClassify(newHistory);
  }

  // ─── After classification is decided ─────────────────────────────────────

  async function handleClassified(aiResult: ClassifyResult) {
    const classification = aiResult.classification;

    if (classification !== "bug_confirmed") {
      // Non-bug: show result card directly, no Jira needed
      setResolved({
        classification: classification!,
        explanation: aiResult.explanation ?? "",
        fixSteps: aiResult.fixSteps,
        docUrl: aiResult.docUrl,
      });
      setStep("result");
      return;
    }

    // Bug confirmed → check duplicates + create ticket
    setStep("creating");

    // Extract keywords from description for duplicate check
    const keywords = form.whatHappened
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length >= 4)
      .slice(0, 6);

    let duplicateType: "jira" | "notion" | undefined;
    let duplicateTitle: string | undefined;
    let duplicateCommentRef: string | undefined;

    try {
      const dupRes = await fetch("/api/duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords,
          communityName: form.community?.name ?? "",
        }),
      });
      const dupData: {
        matches: { type: "jira" | "notion"; title: string; commentRef?: string }[];
      } = await dupRes.json();

      if (dupData.matches.length > 0) {
        const first = dupData.matches[0];
        duplicateType = first.type;
        duplicateTitle = first.title;
        duplicateCommentRef = first.commentRef;
      }
    } catch {
      // ignore duplicate check errors
    }

    if (duplicateType) {
      setResolved({
        classification: "bug_confirmed",
        explanation: aiResult.explanation ?? "",
        duplicateType,
        duplicateTitle,
        commentRef: duplicateCommentRef,
      });
      setStep("duplicate");
      return;
    }

    // No duplicate → create Jira ticket
    try {
      const summary = form.whatHappened.slice(0, 120);
      const description = [
        `Module: ${form.module}`,
        `Platform: ${form.platforms.join(", ")}`,
        `What happened: ${form.whatHappened}`,
        form.whatExpected ? `Expected: ${form.whatExpected}` : "",
        `Blocking: ${form.isBlocking ? "Yes" : "No"}`,
        `Users affected: ${form.usersAffected}`,
        form.url ? `URL: ${form.url}` : "",
        form.email ? `Affected user: ${form.email}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const createRes = await fetch("/api/jira/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary,
          description,
          module: form.module,
          affectedUsersCount: form.usersAffected,
          isBlocking: form.isBlocking,
          communityName: form.community?.name ?? "",
        }),
      });

      const { ticketNumber, commentRef } = await createRes.json();

      setResolved({
        classification: "bug_confirmed",
        explanation: aiResult.explanation ?? "",
        ticketNumber,
        commentRef,
      });
    } catch {
      // If Jira fails, still show the classification
      setResolved({
        classification: "bug_confirmed",
        explanation: aiResult.explanation ?? "",
      });
    }

    setStep("result");
  }

  // ─── Reset ────────────────────────────────────────────────────────────────

  function reset() {
    setForm(INITIAL_FORM);
    setClassifyResult(null);
    setHistory([]);
    setFollowUpAnswer("");
    setResolved(null);
    setStep("form");
  }

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (step === "loading" || step === "creating") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-gray-500">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm font-medium">
          {step === "creating"
            ? lang === "es"
              ? "Creando ticket..."
              : "Creating ticket..."
            : t("form.submit.loading", lang)}
        </p>
      </div>
    );
  }

  // ─── Follow-up question (inline chat) ────────────────────────────────────

  if (step === "asking" && classifyResult?.question) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3 p-4 bg-primary-light border border-primary/20 rounded-xl">
          <MessageCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-800 leading-relaxed">
            {classifyResult.question}
          </p>
        </div>
        <textarea
          value={followUpAnswer}
          onChange={(e) => setFollowUpAnswer(e.target.value)}
          placeholder={
            lang === "es" ? "Tu respuesta..." : "Your answer..."
          }
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleFollowUp();
            }
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

  // ─── Duplicate found ──────────────────────────────────────────────────────

  if (step === "duplicate" && resolved) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-800">
              {resolved.duplicateType === "jira"
                ? lang === "es"
                  ? "Ya estamos trabajando en este inconveniente"
                  : "We're already working on this issue"
                : lang === "es"
                ? "Ya hay un pedido similar registrado por Producto"
                : "A similar request is already registered by the Product team"}
            </p>
            {resolved.duplicateTitle && (
              <p className="text-xs text-amber-700 italic">
                &quot;{resolved.duplicateTitle}&quot;
              </p>
            )}
          </div>
        </div>
        <button
          onClick={reset}
          className="w-full px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          {t("result.reportAnother", lang)}
        </button>
      </div>
    );
  }

  // ─── AI Result ────────────────────────────────────────────────────────────

  if (step === "result" && resolved) {
    return (
      <AiResultCard
        result={resolved}
        lang={lang}
        onReportAnother={reset}
      />
    );
  }

  // ─── Form ─────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Client info */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          {t("form.section.client", lang)}
        </p>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">
            {t("form.community.label", lang)}
          </label>
          <CommunitySearch
            lang={lang}
            value={form.community}
            onChange={(c) => set("community", c)}
          />
        </div>
      </section>

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
                  form.isBlocking
                    ? "bg-red-500 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                )}
              >
                {t("form.blocking.yes", lang)}
              </button>
              <button
                type="button"
                onClick={() => set("isBlocking", false)}
                className={cn(
                  "px-4 py-1.5 border-l border-gray-200 transition-colors",
                  !form.isBlocking
                    ? "bg-primary text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
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
                    {t(
                      val === "1"
                        ? "form.usersAffected.one"
                        : "form.usersAffected.many",
                      lang
                    )}
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
          {/* Drop zone */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                {t("form.evidence.label", lang)}
              </label>
              <span className="text-xs text-red-500">
                {t("form.evidence.required", lang)}
              </span>
            </div>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all",
                dragOver
                  ? "border-primary bg-primary-light"
                  : "border-gray-200 hover:border-primary/40 hover:bg-gray-50"
              )}
            >
              <Upload className="w-5 h-5 text-gray-400" />
              <p className="text-xs text-gray-500">{t("form.evidence.hint", lang)}</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
            </div>

            {form.files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.files.map((file, i) => (
                  <div key={i} className="relative group">
                    {file.type.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center p-1">
                        <span className="text-xs text-gray-500 text-center truncate w-full">
                          {file.name}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* URL */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              {t("form.url.label", lang)}
            </label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder={t("form.url.placeholder", lang)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              {t("form.email.label", lang)}
            </label>
            <input
              type="text"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder={t("form.email.placeholder", lang)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>
      </section>

      {/* Submit */}
      <button
        type="submit"
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
      >
        {t("form.submit", lang)}
      </button>
    </form>
  );
}
