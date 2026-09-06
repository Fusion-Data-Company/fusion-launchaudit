/**
 * Minimal Stripe client — no SDK. Two things only:
 *  - create a Checkout Session (REST, form-encoded, secret key)
 *  - verify a webhook signature (Stripe-Signature: t=..,v1=.. over `${t}.${rawBody}`)
 * Keeping this dependency-free keeps the serverless bundle small and auditable.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type StripeEnv = Record<string, string | undefined>;

/** Flatten a nested object into Stripe's bracketed form encoding (a[b][0][c]=v). */
export function encodeForm(obj: Record<string, unknown>, prefix = "", out: string[] = []): string {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === "object" && item ? encodeForm(item as Record<string, unknown>, `${key}[${i}]`, out) : out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`)));
    else if (typeof v === "object") encodeForm(v as Record<string, unknown>, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out.join("&");
}

export async function stripeRequest<T = Record<string, unknown>>(
  secretKey: string,
  path: string,
  body: Record<string, unknown>,
  opts: { idempotencyKey?: string } = {},
): Promise<T> {
  const r = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secretKey}`,
      "content-type": "application/x-www-form-urlencoded",
      ...(opts.idempotencyKey ? { "idempotency-key": opts.idempotencyKey } : {}),
    },
    body: encodeForm(body),
  });
  const json = (await r.json()) as T & { error?: { message?: string } };
  if (!r.ok) throw new Error(json.error?.message || `Stripe ${path} failed (${r.status})`);
  return json;
}

/**
 * Verify a Stripe webhook signature. Returns true when any v1 signature matches
 * and the timestamp is within `toleranceSec` of now (replay protection).
 */
export function verifyStripeSignature(rawBody: string | Buffer, header: string | undefined, secret: string, toleranceSec = 300, now = Date.now()): boolean {
  if (!header || !secret) return false;
  const parts = Object.create(null) as Record<string, string[]>;
  for (const kv of header.split(",")) {
    const i = kv.indexOf("=");
    if (i < 0) continue;
    const k = kv.slice(0, i).trim(), v = kv.slice(i + 1).trim();
    (parts[k] ||= []).push(v);
  }
  const t = parts.t?.[0];
  const sigs = parts.v1 || [];
  if (!t || !/^\d+$/.test(t) || !sigs.length) return false;
  if (Math.abs(now / 1000 - Number(t)) > toleranceSec) return false;
  const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf8");
  const expected = createHmac("sha256", secret).update(Buffer.concat([Buffer.from(`${t}.`), payload])).digest("hex");
  const exp = Buffer.from(expected, "utf8");
  return sigs.some((s) => { const b = Buffer.from(s, "utf8"); return b.length === exp.length && timingSafeEqual(b, exp); });
}

/** Test helper / documentation of the scheme: build a valid Stripe-Signature header. */
export function signStripePayload(rawBody: string, secret: string, t = Math.floor(Date.now() / 1000)): string {
  const v1 = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return `t=${t},v1=${v1}`;
}
