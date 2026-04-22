"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import type { Lang } from "@/lib/i18n";
import { t } from "@/lib/i18n";

export interface Community {
  id: string;
  name: string;
}

interface Props {
  lang: Lang;
  value: Community | null;
  onChange: (community: Community | null) => void;
}

export function CommunitySearch({ lang, value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Community[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleInput(q: string) {
    setQuery(q);
    if (value) onChange(null);
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
        const data: Community[] = await res.json();
        setResults(data);
        setIsOpen(true);
      } finally {
        setIsLoading(false);
      }
    }, 300);
  }

  function selectCommunity(c: Community) {
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
      <div className="rounded-lg border border-primary/20 bg-primary-light px-3 py-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium text-primary">{value.name}</span>
          <button
            type="button"
            onClick={clear}
            className="text-primary/60 hover:text-primary ml-2"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={t("form.community.placeholder", lang)}
          className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
        />
        {isLoading && (
          <div className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        )}
      </div>

      {isOpen && (
        <ul className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden max-h-48 overflow-y-auto">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">
              {t("form.community.notFound", lang)}
            </li>
          ) : (
            results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseDown={() => selectCommunity(c)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-primary-light transition-colors"
                >
                  <span className="font-medium text-gray-900">{c.name}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
