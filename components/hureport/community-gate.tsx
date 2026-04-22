"use client";

import { useState, useEffect, useRef } from "react";
import { AlertTriangle, Search, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { t, type Lang } from "@/lib/i18n";

export interface GateCommunity {
  pageId: string;
  name: string;
}

interface Props {
  lang: Lang;
  onSelect: (community: GateCommunity) => void;
}

interface SearchResult {
  id: string;
  name: string;
}

export function CommunityGate({ lang, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/client?q=${encodeURIComponent(query)}`);
        const data: SearchResult[] = await res.json();
        // API returns only { id, name } — no sensitive fields
        setResults(data);
        setShowDropdown(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, [query]);

  function handleSelect(item: SearchResult) {
    onSelect({ pageId: item.id, name: item.name });
    setShowDropdown(false);
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

      {/* Search input */}
      <div className="w-full max-w-xs relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin pointer-events-none" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("gate.placeholder", lang)}
            autoFocus
            className={cn(
              "w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm",
              "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            )}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
          />
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <ul className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-hu-md overflow-hidden max-h-52 overflow-y-auto">
            {results.length === 0 ? (
              <li className="px-4 py-3 text-sm text-gray-400 text-center">
                {t("gate.noResults", lang)}
              </li>
            ) : (
              results.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onMouseDown={() => handleSelect(item)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-primary-light transition-colors"
                  >
                    <span className="font-medium text-gray-800">{item.name}</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <p className="text-xs text-gray-400 max-w-xs">
        {t("gate.hint", lang)}
      </p>
    </div>
  );
}
