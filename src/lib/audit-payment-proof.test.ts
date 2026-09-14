import { test } from "node:test";
import assert from "node:assert/strict";
import { keyExpectsLive, validAuditPayment } from "./audit-payment-proof.ts";

function session(live: boolean, tier = "single", amount = 7900) {
  return { metadata: { tier }, livemode: live, mode: "payment", status: "complete", payment_status: "paid", currency: "usd", amount_total: amount,
    payment_intent: { livemode: live, status: "succeeded", latest_charge: { livemode: live, paid: true, amount_refunded: 0, disputed: false } } };
}

test("live exact audit payment only, under a live key", () => {
  const s = session(true);
  assert.equal(validAuditPayment(s, true), true);
  assert.equal(validAuditPayment({ ...s, livemode: false }, true), false);
  assert.equal(validAuditPayment({ ...s, amount_total: 1 }, true), false);
  s.payment_intent.latest_charge.amount_refunded = 1;
  assert.equal(validAuditPayment(s, true), false);
});

test("every tier is accepted at its exact amount and rejected at any other", () => {
  assert.equal(validAuditPayment(session(true, "standard", 14900), true), true);
  assert.equal(validAuditPayment(session(true, "pro", 49900), true), true);
  assert.equal(validAuditPayment(session(true, "pro", 14900), true), false);
  assert.equal(validAuditPayment(session(true, "growth", 0), true), false);
});

test("a test key accepts test-mode sessions and refuses live ones; a live key the reverse", () => {
  assert.equal(keyExpectsLive("sk_test_abc"), false);
  assert.equal(keyExpectsLive("sk_live_abc"), true);
  assert.equal(keyExpectsLive(undefined), true);
  assert.equal(validAuditPayment(session(false), false), true);
  assert.equal(validAuditPayment(session(true), false), false);
  assert.equal(validAuditPayment(session(false), true), false);
});
