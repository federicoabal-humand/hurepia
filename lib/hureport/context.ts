/**
 * lib/hureport/context.ts
 * Client-side admin context detection for HuReport AI.
 *
 * Modes:
 *   A. DEMO       — ?demo=<preset_id> in URL → skip gate instantly (pitch mode)
 *   B. STANDALONE — localStorage gate (production default)
 *
 * Demo presets are intentionally hardcoded and never reach the API.
 */

export interface AdminContext {
  mode: "demo" | "standalone";
  communityName: string;
  adminName?: string;
  instanceId?: number;
}

// ── Hardcoded demo presets ─────────────────────────────────────────────────────
const DEMO_PRESETS: Record<string, Omit<AdminContext, "mode">> = {
  juan_naranja: {
    communityName: "Naranja",
    adminName: "Juan Pérez",
    instanceId: 12345,
  },
  maria_tech: {
    communityName: "Tech Corp",
    adminName: "María García",
    instanceId: 67890,
  },
  demo: {
    communityName: "Acme Corp",
    adminName: "Demo User",
    instanceId: 99999,
  },
};

/**
 * Reads ?demo=<preset_id> from the URL and returns a demo AdminContext.
 * Returns null when not in demo mode or when running server-side.
 * Safe to call multiple times — reads only URL params, no side-effects.
 */
export function detectDemoContext(): AdminContext | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const presetId = params.get("demo");
    if (!presetId) return null;
    const preset = DEMO_PRESETS[presetId.toLowerCase()];
    if (!preset) return null;
    return { mode: "demo", ...preset };
  } catch {
    return null;
  }
}
