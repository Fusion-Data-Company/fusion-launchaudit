import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeForm, signStripePayload, verifyStripeSignature } from "./stripe.ts";

test("verifyStripeSignature accepts a correctly signed payload and rejects tampering", () => {
  const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
  const header = signStripePayload(body, "whsec_test");
  assert.equal(verifyStripeSignature(body, header, "whsec_test"), true);
  assert.equal(verifyStripeSignature(body + " ", header, "whsec_test"), false);
  assert.equal(verifyStripeSignature(body, header, "whsec_other"), false);
  assert.equal(verifyStripeSignature(body, undefined, "whsec_test"), false);
});

test("verifyStripeSignature rejects stale timestamps", () => {
  const body = "{}";
  const stale = Math.floor(Date.now() / 1000) - 3600;
  const header = signStripePayload(body, "whsec_test", stale);
  assert.equal(verifyStripeSignature(body, header, "whsec_test"), false);
});

test("encodeForm produces Stripe bracket encoding", () => {
  const s = encodeForm({ mode: "payment", line_items: [{ price: "price_1", quantity: 1 }], metadata: { tier: "pro" } });
  assert.equal(s, "mode=payment&line_items%5B0%5D%5Bprice%5D=price_1&line_items%5B0%5D%5Bquantity%5D=1&metadata%5Btier%5D=pro");
});
