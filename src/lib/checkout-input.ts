/**
 * Input validation for the hosted-audit order path (/api/checkout).
 * Pure + synchronous so it is unit-testable without Stripe or network.
 *
 * All three tiers are purchasable. Every tier receives the same automated
 * site-wide URL audit, delivered as a PDF + hosted link + email the moment
 * the grade finishes. The Deep Audit and Pro tiers additionally include the
 * hands-on Playwright work, which a person schedules from the order email.
 */
import { parseTargetUrl } from "./instant-grade.ts";

export type AuditTier = "single" | "standard" | "pro";

export type TierInfo = {
  label: string;
  amountCents: number;
  priceEnv: string;
  /** true when a person follows up with the browser-based deep audit after the automated report. */
  handsOn: boolean;
  /** One line a buyer sees on the success page and in the email. */
  includes: string;
  /** What happens after payment, in plain words. */
  next: string;
};

export const AUDIT_TIERS: Record<AuditTier, TierInfo> = {
  single: {
    label: "Single Run",
    amountCents: 7900,
    priceEnv: "STRIPE_PRICE_AUDIT_SINGLE",
    handsOn: false,
    includes: "Automated site-wide URL audit of up to 8 pages: security headers, cookies, CORS, exposed files, accessibility basics, broken links, mixed content, SEO and launch blockers, error leaks, TLS, email DNS, page weight.",
    next: "The audit runs now, usually in 30 to 60 seconds. The report renders on this page, is emailed to you as a PDF, and stays at the hosted link below.",
  },
  standard: {
    label: "Deep Audit",
    amountCents: 14900,
    priceEnv: "STRIPE_PRICE_AUDIT",
    handsOn: true,
    includes: "Everything in Single Run, delivered now, plus a hands-on Playwright deep audit of the same app in a real browser: broken access control, admin and RBAC routes, write authorization, with evidence per check and a prioritised fix plan.",
    next: "The automated report lands on this page and in your inbox now. Within one business day we email you from rob@fusiondataco.com to confirm scope and schedule the browser-based deep audit; that report follows by email within two business days of scope confirmation.",
  },
  pro: {
    label: "Pro",
    amountCents: 49900,
    priceEnv: "STRIPE_PRICE_AUDIT_PRO",
    handsOn: true,
    includes: "Everything in Deep Audit, plus credentialed testing with a test login you provide (two-identity IDOR and privilege checks), one re-audit after you ship the fixes, and a 30 minute call to walk the findings.",
    next: "The automated report lands on this page and in your inbox now. Within one business day we email you from rob@fusiondataco.com to collect a test login and confirm scope; the credentialed deep audit follows within three business days, and the re-audit is yours whenever the fixes are live.",
  },
};

export type CheckoutInput = {
  /** null when the buyer chose to add the URL after paying (defer_url). The success page collects it. */
  url: string | null;
  /** null when deferred: Stripe Checkout collects the email itself. */
  email: string | null;
  tier: AuditTier;
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function isAuditTier(value: unknown): value is AuditTier {
  return value === "single" || value === "standard" || value === "pro";
}

export function tierInfo(tier: string): TierInfo {
  return isAuditTier(tier) ? AUDIT_TIERS[tier] : AUDIT_TIERS.single;
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function validateCheckoutInput(body: unknown): { ok: true; value: CheckoutInput } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const tier = b.tier ?? "single";
  if (!isAuditTier(tier)) return { ok: false, error: "tier must be \"single\", \"standard\" or \"pro\"." };
  if (b.authorized !== true) return { ok: false, error: "Confirm that you own this site or are authorised to test it." };
  const defer = b.defer_url === true;

  const rawUrl = typeof b.url === "string" ? b.url.trim() : "";
  let url: string | null = null;
  if (rawUrl || !defer) {
    const parsed = parseTargetUrl(b.url);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    url = parsed.url.origin + (parsed.url.pathname === "/" ? "" : parsed.url.pathname);
  }

  const email = typeof b.email === "string" ? b.email.trim() : "";
  if (!email && !defer) return { ok: false, error: "Enter the email the report should go to." };
  if (email && (email.length > 320 || !EMAIL_RE.test(email))) return { ok: false, error: "Enter a valid email." };

  return { ok: true, value: { url, email: email || null, tier } };
}
