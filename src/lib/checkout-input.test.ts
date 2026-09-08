import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCheckoutInput, AUDIT_TIERS } from "./checkout-input.ts";
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

test("validateCheckoutInput refuses the hand-fulfilled tiers until a fulfilment path exists", () => {
  for (const tier of ["standard", "pro"]) {
    const r = validateCheckoutInput({ url: "https://example.com", email: "a@b.co", tier, authorized: true });
    assert.equal(r.ok, false, `should refuse ${tier}`);
    if (!r.ok) assert.match(r.error, /quoted by hand/);
  }
});

test("validateCheckoutInput requires the authorisation confirmation", () => {
  const r = validateCheckoutInput({ url: "https://example.com", email: "a@b.co", tier: "single" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /authorised/);
  assert.equal(validateCheckoutInput({ url: "https://example.com", email: "a@b.co", tier: "single", authorized: "yes" }).ok, false);
});

test("validateCheckoutInput rejects bad email, tier, and missing URL", () => {
  assert.equal(validateCheckoutInput({ url: "https://example.com", email: "nope", authorized: true }).ok, false);
  assert.equal(validateCheckoutInput({ url: "https://example.com", email: "a@b.co", tier: "enterprise", authorized: true }).ok, false);
  assert.equal(validateCheckoutInput({ email: "a@b.co", authorized: true }).ok, false);
  assert.equal(validateCheckoutInput(null).ok, false);
});

test("validateCheckoutInput applies the same SSRF guard as the free grader", () => {
  for (const bad of ["http://localhost:3000", "http://127.0.0.1", "http://10.0.0.5", "http://169.254.169.254", "http://metadata.google.internal", "ftp://example.com", "http://[::1]"]) {
    assert.equal(validateCheckoutInput({ url: bad, email: "a@b.co", authorized: true }).ok, false, `should reject ${bad}`);
    assert.equal(parseTargetUrl(bad).ok, false, `grader should reject ${bad}`);
  }
});

test("tier price table matches the advertised prices", () => {
  assert.equal(AUDIT_TIERS.single.amountCents, 7900);
  assert.equal(AUDIT_TIERS.standard.amountCents, 14900);
  assert.equal(AUDIT_TIERS.pro.amountCents, 49900);
});
