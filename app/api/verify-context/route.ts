/**
 * POST /api/verify-context
 *
 * Server-side HMAC verification for embedded mode (postMessage from Humand admin).
 * The HUMAND_SHARED_SECRET lives only on the server — never exposed to the browser.
 *
 * Body: full postMessage payload including `signature`
 * Returns: { valid: boolean }
 *
 * Signing convention (must match what admin.humand.co uses):
 *   signature = HMAC-SHA256(JSON.stringify(payload_without_signature), HUMAND_SHARED_SECRET)
 *   hex-encoded
 */
import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

export async function POST(req: NextRequest) {
  const secret = process.env.HUMAND_SHARED_SECRET;

  if (!secret) {
    // Secret not configured — embedded mode disabled gracefully
    console.warn("[verify-context] HUMAND_SHARED_SECRET not configured. Embedded mode disabled.");
    return NextResponse.json({ valid: false });
  }

  try {
    const body = await req.json();
    const { signature, ...payload } = body as Record<string, unknown>;

    if (typeof signature !== "string" || !signature) {
      return NextResponse.json({ valid: false });
    }

    // Validate timestamp < 5 minutes old (replay attack protection)
    const ts = typeof payload.timestamp === "number" ? payload.timestamp : 0;
    if (!ts || Date.now() - ts > 5 * 60 * 1000) {
      return NextResponse.json({ valid: false });
    }

    // Compute expected HMAC over the payload (without signature field)
    const payloadStr = JSON.stringify(payload);
    const expected = createHmac("sha256", secret).update(payloadStr).digest("hex");

    // Constant-time comparison
    const sigBuf = Buffer.from(signature.toLowerCase(), "hex");
    const expBuf = Buffer.from(expected, "hex");

    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({ valid: true });
  } catch (err) {
    console.error("[verify-context] error:", err);
    return NextResponse.json({ valid: false });
  }
}
