"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MockCommunity } from "@/lib/mock-data";
import type { Lang } from "@/lib/i18n";
import { t } from "@/lib/i18n";

interface Props {
  lang: Lang;
  value: MockCommunity | null;
  onChange: (community: MockCommunity | null) => void;
}

export function CommunitySearch({ lang, value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MockCommunity[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleInput(q: string) {
    setQuery(q);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (q.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/client?q=${encodeURIComponent(q)}`);
        const data: MockCommunity[] = await res.json();
        setResults(data);
        setIsOpen(true);
      } finally {
        setIsLoading(false);
      }
    }, 300);
  }

  function selectCommunity(c: MockCommunity) {
    onChange(c);
    setQuery("");
    setIsOpen(false);
    setResults([]);
  }

  function clear() {
    onChange(null);
    setQuery("");
  }

  if (value) {
    return (
      <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium text-teal-900">{value.name}</span>
          <button onClick={clear} className="text-teal-500 hover:text-teal-700 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-1 flex gap-3 text-xs text-teal-700">
          <span>{t("form.community.instance", lang)}: {value.instanceId}</span>
          <span>{t("form.community.country", lang)}: {value.country}</span>
          <span>{t("form.community.cxOwner", lang)}: {value.cxOwner}</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={t("form.community.placeholder", lang)}
          className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
        {isLoading && (
          <div className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              {t("form.community.notFound", lang)}
            </div>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => selectCommunity(c)}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm hover:bg-teal-50 transition-colors",
                  "first:rounded-t-md last:rounded-b-md"
                )}
              >
                <div className="font-medium text-gray-900">{c.name}</div>
                <div className="text-xs text-gray-500">{c.country} · {c.cxOwner}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
