"use client";

import { HuReportWidget } from "@/components/hureport/hureport-widget";

const STATS = [
  { label: "Comunidades activas", value: "142",    delta: "+12 este mes" },
  { label: "Usuarios totales",     value: "38 420", delta: "+3 % vs. mes anterior" },
  { label: "Reportes este mes",    value: "7",      delta: "−2 vs. mes anterior" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-surface-50">
      {/* ── Top nav ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-white border-b border-surface-200 shadow-hu-sm">
        <div className="mx-auto max-w-5xl px-6 h-14 flex items-center gap-3">
          {/* Humand logo mark */}
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-hu-sm">
            <span className="text-white text-sm font-bold leading-none">H</span>
          </div>
          <span className="text-sm font-semibold text-gray-800 tracking-tight">
            Humand
          </span>
          <span className="ml-1 text-xs text-gray-400 font-medium">
            Admin Panel
          </span>

          <div className="ml-auto flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary-light flex items-center justify-center">
              <span className="text-primary text-xs font-semibold">FG</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Page body ───────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">

        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Bienvenido de vuelta. Aquí está el resumen de tu comunidad.
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {STATS.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-surface-200 bg-white p-5 shadow-hu-sm hover:shadow-hu-md transition-shadow duration-250"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                {card.label}
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900 tabular-nums">
                {card.value}
              </p>
              <p className="mt-1 text-xs text-gray-400">{card.delta}</p>
            </div>
          ))}
        </div>

        {/* Placeholder content rows */}
        <div className="space-y-3">
          {[
            { w: "w-full",   h: "h-10" },
            { w: "w-5/6",    h: "h-10" },
            { w: "w-4/6",    h: "h-10" },
          ].map((bar, i) => (
            <div
              key={i}
              className={`${bar.w} ${bar.h} rounded-xl bg-surface-100 animate-pulse`}
            />
          ))}
        </div>

        {/* Activity section placeholder */}
        <div className="rounded-2xl border border-surface-200 bg-white shadow-hu-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-100">
            <h2 className="text-sm font-semibold text-gray-800">
              Actividad reciente
            </h2>
          </div>
          <div className="divide-y divide-surface-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-surface-100 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 rounded bg-surface-100 animate-pulse w-2/3" />
                  <div className="h-2.5 rounded bg-surface-100 animate-pulse w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Floating HuReport widget ─────────────────────────────────────── */}
      <HuReportWidget />
    </main>
  );
}
