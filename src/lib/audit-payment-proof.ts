/**
 * Canonical proof that a Checkout Session is a real, settled, exact-amount
 * audit payment. The session must be the one re-fetched from Stripe with
 * payment_intent.latest_charge expanded, never the webhook's own copy.
 *
 * livemode must match the mode of the key this deployment runs with: a
 * sk_live_ key only accepts live sessions, a sk_test_ key only accepts test
 * sessions. That is what lets a Stripe TEST-mode rehearsal fulfil end to end
 * without any code change, while production still refuses test objects.
 */
import { AUDIT_TIERS, isAuditTier } from "./checkout-input.ts";

export function keyExpectsLive(secretKey: string | undefined = process.env.STRIPE_SECRET_KEY): boolean {
  return !(secretKey ?? "").startsWith("sk_test_");
}

export function validAuditPayment(s: any, expectLive: boolean = keyExpectsLive()): boolean {
  const tier = s?.metadata?.tier;
  const pi = s?.payment_intent, c = pi?.latest_charge;
  return Boolean(
    isAuditTier(tier) &&
    s.livemode === expectLive &&
    s.mode === "payment" &&
    s.status === "complete" &&
    s.payment_status === "paid" &&
    s.currency === "usd" &&
    s.amount_total === AUDIT_TIERS[tier].amountCents &&
    pi?.livemode === expectLive &&
    pi.status === "succeeded" &&
    c?.livemode === expectLive &&
    c.paid === true &&
    c.amount_refunded === 0 &&
    !c.disputed,
  );
}
