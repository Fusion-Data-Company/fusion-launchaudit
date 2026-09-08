/**
 * Input validation for the hosted-audit order path (/api/checkout).
 * Pure + synchronous so it is unit-testable without Stripe or network.
 */
import { parseTargetUrl } from "./instant-grade.ts";

export type AuditTier = "single" | "standard" | "pro";

export const AUDIT_TIERS: Record<AuditTier, { label: string; amountCents: number; priceEnv: string }> = {
  single: { label: "Single Run", amountCents: 7900, priceEnv: "STRIPE_PRICE_AUDIT_SINGLE" },
  standard: { label: "Hosted Deep Audit", amountCents: 14900, priceEnv: "STRIPE_PRICE_AUDIT" },
  pro: { label: "Hosted Deep Audit — Pro", amountCents: 49900, priceEnv: "STRIPE_PRICE_AUDIT_PRO" },
};

export type CheckoutInput = { url: string; email: string; tier: AuditTier };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function isAuditTier(value: unknown): value is AuditTier {
  return value === "single" || value === "standard" || value === "pro";
}

export function validateCheckoutInput(body: unknown): { ok: true; value: CheckoutInput } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const parsed = parseTargetUrl(b.url);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const email = typeof b.email === "string" ? b.email.trim() : "";
  if (!email) return { ok: false, error: "Enter the email the report should go to." };
  if (email.length > 320 || !EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email." };
  const tier = b.tier ?? "single";
  if (!isAuditTier(tier)) return { ok: false, error: "tier must be \"single\", \"standard\" or \"pro\"." };
  // Only the automated tier is sold from the page. The deep and Pro audits are done by a
  // person and have no fulfilment path in this codebase yet, so they cannot be bought here.
  if (tier !== "single") return { ok: false, error: "Deep and Pro audits are quoted by hand. Use the contact form and we will reply with a scope and a price." };
  if (b.authorized !== true) return { ok: false, error: "Confirm that you own this site or are authorised to test it." };
  return { ok: true, value: { url: parsed.url.origin + (parsed.url.pathname === "/" ? "" : parsed.url.pathname), email, tier } };
}
