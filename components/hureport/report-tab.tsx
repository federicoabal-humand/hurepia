"use client";

import { useState, useRef } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODULES, PLATFORMS } from "@/lib/mappings";
import { t, type Lang } from "@/lib/i18n";
import type { MockCommunity } from "@/lib/mock-data";
import type { MockAiResult } from "@/lib/mock-data";
import { CommunitySearch } from "./community-search";
import { AiResultCard } from "./ai-result-card";

interface ReportTabProps {
  lang: Lang;
}

interface FormState {
  community: MockCommunity | null;
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

export function ReportTab({ lang }: ReportTabProps) {
  const [step, setStep] = useState<"form" | "loading" | "result">("form");
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [result, setResult] = useState<MockAiResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const togglePlatform = (p: string) => {
    set(
      "platforms",
      form.platforms.includes(p)
        ? form.platforms.filter((x) => x !== p)
        : [...form.platforms, p]
    );
  };

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const arr = Array.from(incoming);
    set("files", [...form.files, ...arr]);
  };

  const removeFile = (index: number) => {
    set(
      "files",
      form.files.filter((_, i) => i !== index)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep("loading");
    try {
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          community: form.community?.id,
          module: form.module,
          platforms: form.platforms,
          whatHappened: form.whatHappened,
          whatExpected: form.whatExpected,
          isBlocking: form.isBlocking,
          usersAffected: form.usersAffected,
          url: form.url,
          email: form.email,
        }),
      });
      const data: MockAiResult = await res.json();
      setResult(data);
      setStep("result");
    } catch {
      setStep("form");
    }
  };

  const reset = () => {
    setForm(INITIAL_FORM);
    setResult(null);
    setStep("form");
  };

  /* ─── Loading ─── */
  if (step === "loading") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-gray-500">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
        <p className="text-sm font-medium">{t("form.submit.loading", lang)}</p>
      </div>
    );
  }

  /* ─── Result ─── */
  if (step === "result" && result) {
    return <AiResultCard result={result} lang={lang} onReportAnother={reset} />;
  }

  /* ─── Form ─── */
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Client info */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          {t("form.section.client", lang)}
        </p>
        <CommunitySearch
          lang={lang}
          value={form.community}
          onChange={(c) => set("community", c)}
        />
      </div>

      {/* Issue details */}
      <div>
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
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-teal-400"
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
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none h-16 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          {/* Blocking toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              {t("form.blocking.label", lang)}
            </label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => set("isBlocking", true)}
                className={cn(
                  "px-4 py-1.5 text-xs font-medium transition-colors",
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
                  "px-4 py-1.5 text-xs font-medium border-l border-gray-200 transition-colors",
                  !form.isBlocking
                    ? "bg-teal-600 text-white"
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
                    className="accent-teal-600"
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
      </div>

      {/* Evidence */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          {t("form.section.evidence", lang)}
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                {t("form.evidence.label", lang)}
              </label>
              <span className="text-xs text-red-500">
                {t("form.evidence.required", lang)}
              </span>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                addFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all",
                dragOver
                  ? "border-teal-500 bg-teal-50"
                  : "border-gray-200 hover:border-teal-300 hover:bg-gray-50"
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

            {/* Thumbnails */}
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
                      <div className="w-16 h-16 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                        <span className="text-xs text-gray-500 text-center px-1 truncate">
                          {file.name}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
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
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-colors shadow-sm"
      >
        {t("form.submit", lang)}
      </button>
    </form>
  );
}
