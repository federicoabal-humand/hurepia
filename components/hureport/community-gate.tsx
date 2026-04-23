"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { t, type Lang } from "@/lib/i18n";

interface Props {
  lang: Lang;
  onComplete: () => void;
}

const STORAGE_KEY = "hureport_community";

export function CommunityGate({ lang, onComplete }: Props) {
  const [name, setName] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ nameRaw: trimmed, selectedAt: Date.now() })
    );
    onComplete();
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-10 text-center gap-6">
      {/* Logo */}
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
        <AlertTriangle className="w-7 h-7 text-primary" />
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold text-gray-900">
          {t("gate.title", lang)}
        </h3>
        <p className="text-sm text-gray-500 max-w-xs">
          {t("gate.subtitle", lang)}
        </p>
      </div>

      {/* Simple text input */}
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("gate.placeholder", lang)}
          autoFocus
          className={cn(
            "w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm",
            "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          )}
        />
        <button
          type="submit"
          disabled={name.trim().length < 2}
          className="w-full px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {t("gate.continue", lang)}
        </button>
      </form>
    </div>
  );
}
