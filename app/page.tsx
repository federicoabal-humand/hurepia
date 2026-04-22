"use client";

import { HuReportWidget } from "@/components/hureport/hureport-widget";

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      {/* Demo host page — simulates a SaaS admin dashboard */}
      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center gap-3">
          {/* Fake Humand logo placeholder */}
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-white text-xs font-bold">H</span>
          </div>
          <span className="text-sm font-semibold text-gray-800">Humand</span>
          <span className="ml-2 text-xs text-gray-400">Admin Panel</span>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Hackathon demo — el widget HuReport está en la esquina superior derecha.
          </p>
        </div>

        {/* Fake dashboard cards to simulate real context */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Comunidades activas", value: "142" },
            { label: "Usuarios totales", value: "38 420" },
            { label: "Reportes este mes", value: "7" },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                {card.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">
                {card.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <HuReportWidget />
    </main>
  );
}
