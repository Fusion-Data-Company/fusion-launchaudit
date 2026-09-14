import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCheckoutInput, AUDIT_TIERS, formatUsd, tierInfo } from "./checkout-input.ts";
import { parseTargetUrl } from "./instant-grade.ts";

test("validateCheckoutInput accepts a Single Run order and normalizes the URL", () => {
  const r = validateCheckoutInput({ url: "example.com", email: "dev@example.com", tier: "single", authorized: true });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.url, "https://example.com");
    assert.equal(r.value.email, "dev@example.com");
    assert.equal(r.value.tier, "single");
  }
});

test("validateCheckoutInput defaults tier to single", () => {
  const r = validateCheckoutInput({ url: "https://example.com/app", email: "a@b.co", authorized: true });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.tier, "single");
});

test("validateCheckoutInput sells all three tiers", () => {
  for (const tier of ["single", "standard", "pro"] as const) {
    const r = validateCheckoutInput({ url: "https://example.com", email: "a@b.co", tier, authorized: true });
    assert.equal(r.ok, true, `should accept ${tier}`);
    if (r.ok) assert.equal(r.value.tier, tier);
  }
});

test("validateCheckoutInput requires the authorisation confirmation", () => {
  const r = validateCheckoutInput({ url: "https://example.com", email: "a@b.co", tier: "single" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /authorised/);
  assert.equal(validateCheckoutInput({ url: "https://example.com", email: "a@b.co", tier: "single", authorized: "yes" }).ok, false);
});

test("validateCheckoutInput rejects bad email, tier, and missing URL by default", () => {
  assert.equal(validateCheckoutInput({ url: "https://example.com", email: "nope", authorized: true }).ok, false);
  assert.equal(validateCheckoutInput({ url: "https://example.com", email: "a@b.co", tier: "enterprise", authorized: true }).ok, false);
  assert.equal(validateCheckoutInput({ email: "a@b.co", authorized: true }).ok, false);
  assert.equal(validateCheckoutInput(null).ok, false);
});

test("defer_url lets a buyer pay first and add the URL on the success page; Stripe collects the email", () => {
  const r = validateCheckoutInput({ tier: "pro", authorized: true, defer_url: true });
  assert.equal(r.ok, true);
  if (r.ok) { assert.equal(r.value.url, null); assert.equal(r.value.email, null); assert.equal(r.value.tier, "pro"); }
  // A supplied URL is still validated even when deferral is allowed.
  assert.equal(validateCheckoutInput({ url: "http://127.0.0.1", tier: "pro", authorized: true, defer_url: true }).ok, false);
  // A supplied email is still validated.
  assert.equal(validateCheckoutInput({ email: "nope", tier: "pro", authorized: true, defer_url: true }).ok, false);
});

test("validateCheckoutInput applies the same SSRF guard as the free grader", () => {
  for (const bad of ["http://localhost:3000", "http://127.0.0.1", "http://10.0.0.5", "http://169.254.169.254", "http://metadata.google.internal", "ftp://example.com", "http://[::1]"]) {
    assert.equal(validateCheckoutInput({ url: bad, email: "a@b.co", authorized: true }).ok, false, `should reject ${bad}`);
    assert.equal(parseTargetUrl(bad).ok, false, `grader should reject ${bad}`);
  }
});

test("tier price table matches the advertised prices and the Stripe env names", () => {
  assert.equal(AUDIT_TIERS.single.amountCents, 7900);
  assert.equal(AUDIT_TIERS.standard.amountCents, 14900);
  assert.equal(AUDIT_TIERS.pro.amountCents, 49900);
  assert.equal(AUDIT_TIERS.single.priceEnv, "STRIPE_PRICE_AUDIT_SINGLE");
  assert.equal(AUDIT_TIERS.standard.priceEnv, "STRIPE_PRICE_AUDIT");
  assert.equal(AUDIT_TIERS.pro.priceEnv, "STRIPE_PRICE_AUDIT_PRO");
  assert.equal(formatUsd(7900), "$79");
  assert.equal(formatUsd(14950), "$149.50");
  assert.equal(tierInfo("nonsense").label, "Single Run");
  assert.equal(tierInfo("pro").handsOn, true);
});
