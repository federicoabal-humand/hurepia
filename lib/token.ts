/**
 * lib/token.ts
 * Signs and verifies issue references so HUREP-XX keys are NEVER exposed to the frontend.
 *
 * Format: base64url(jiraKey).base64url(HMAC-SHA256(base64url(jiraKey), COMMENT_REF_SECRET))
 *
 * Stateless — no server-side storage needed; works across serverless invocations.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const secret = process.env.COMMENT_REF_SECRET ?? "dev-secret-change-me";

/**
 * signIssueRef("HUREP-42") → opaque token the frontend can store and send back.
 * The jiraKey is base64url-encoded (not human-readable at a glance) and HMAC-verified.
 */
export function signIssueRef(jiraKey: string): string {
  const encoded = Buffer.from(jiraKey, "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

/**
 * verifyIssueRef(ref) → original jiraKey, or null if tampered / invalid.
 */
export function verifyIssueRef(ref: string): string | null {
  const dotIdx = ref.lastIndexOf(".");
  if (dotIdx < 1) return null;

  const encoded = ref.slice(0, dotIdx);
  const sig = ref.slice(dotIdx + 1);
  const expectedSig = createHmac("sha256", secret).update(encoded).digest("base64url");

  try {
    const a = Buffer.from(sig, "base64url");
    const b = Buffer.from(expectedSig, "base64url");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  return Buffer.from(encoded, "base64url").toString("utf8");
}
