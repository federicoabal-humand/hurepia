"use client";

import { HuReportWidget } from "@/components/hureport/hureport-widget";

export default function Home() {
  return (
    <main className="min-h-screen bg-bg">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-text-primary">
          HuReport AI — Demo
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Widget flotante embebido. Click en el botón arriba a la derecha para abrir.
        </p>
      </div>
      <HuReportWidget />
    </main>
  );
}
