/**
 * lib/hureport/context.ts
 * Client-side admin context detection for HuReport AI.
 *
 * Modes:
 *   A. DEMO       — ?demo=<preset_id> in URL → skip gate instantly (pitch mode)
 *   B. EMBEDDED   — postMessage from parent Humand frame with HMAC signature
 *   C. STANDALONE — localStorage gate (production default)
 *
 * Demo presets are intentionally hardcoded and never reach any API.
 * Embedded mode signature verification is delegated to /api/verify-context (server-side).
 */

export interface AdminContext {
  mode: "demo" | "embedded" | "standalone";
  communityName: string;
  adminName?: string;
  adminEmail?: string;
  instanceId?: number;
  /** Whether signature was verified server-side (only true in embedded mode) */
  verified?: boolean;
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

// ── Embedded mode ─────────────────────────────────────────────────────────────

const TRUSTED_ORIGINS = [
  "https://admin.humand.co",
  "https://humand.co",
  "https://app.humand.co",
];

/**
 * Calls /api/verify-context to validate the HMAC signature server-side.
 * The shared secret lives only on the server.
 */
async function verifyContextSignature(data: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch("/api/verify-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) return false;
    const json = await res.json();
    return json.valid === true;
  } catch {
    return false;
  }
}

/**
 * Sets up a postMessage listener for embedded mode (HuReport inside admin.humand.co iframe).
 *
 * Usage in the parent (admin.humand.co):
 * ```javascript
 * const payload = {
 *   type: "HUMAND_CONTEXT",
 *   instanceId: currentInstance.id,
 *   communityName: currentInstance.name,
 *   adminEmail: currentUser.email,
 *   adminName: currentUser.name,
 *   timestamp: Date.now(),
 * };
 * const signature = await hmacSha256(JSON.stringify(payload), HUMAND_SHARED_SECRET);
 * iframe.contentWindow.postMessage({ ...payload, signature }, "https://hureport.humand.co");
 * ```
 *
 * Returns a cleanup function (call on unmount).
 */
export function listenForEmbeddedContext(
  callback: (ctx: AdminContext) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = async (event: MessageEvent) => {
    // ── Validate origin ──────────────────────────────────────────────────────
    if (!TRUSTED_ORIGINS.some((o) => event.origin.startsWith(o))) return;

    // ── Validate payload type ────────────────────────────────────────────────
    const data = event.data as Record<string, unknown> | null;
    if (!data || data.type !== "HUMAND_CONTEXT") return;

    // ── Validate timestamp (< 5 min) ─────────────────────────────────────────
    const ts = typeof data.timestamp === "number" ? data.timestamp : 0;
    if (!ts || Date.now() - ts > 5 * 60 * 1000) return;

    // ── Server-side HMAC check ────────────────────────────────────────────────
    const isValid = await verifyContextSignature(data);
    if (!isValid) return;

    callback({
      mode: "embedded",
      communityName: String(data.communityName ?? ""),
      adminName: data.adminName ? String(data.adminName) : undefined,
      adminEmail: data.adminEmail ? String(data.adminEmail) : undefined,
      instanceId: typeof data.instanceId === "number" ? data.instanceId : undefined,
      verified: true,
    });
  };

  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}
