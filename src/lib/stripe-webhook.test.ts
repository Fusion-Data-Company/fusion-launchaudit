import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { signStripePayload } from "./stripe.ts";
import handler from "../../server/api-src/stripe-webhook.ts";
import { getSqlClient } from "./db.ts";

type EventSession = {
  id: string;
  payment_status?: string;
  amount_total: number;
  customer_email: string;
  metadata: { target_url?: string; tier: string };
};

function checkoutEvent(session: EventSession): string {
  return JSON.stringify({ id: `evt_${session.id}`, type: "checkout.session.completed", data: { object: session } });
}

/** The canonical session the webhook re-fetches: what Stripe returns with payment_intent.latest_charge expanded, test mode. */
function canonical(session: EventSession, overrides: Record<string, unknown> = {}) {
  return {
    id: session.id, object: "checkout.session", livemode: false, mode: "payment", status: "complete",
    payment_status: session.payment_status, currency: "usd", amount_total: session.amount_total,
    customer_email: session.customer_email, customer_details: { email: session.customer_email },
    metadata: session.metadata,
    payment_intent: { id: `pi_${session.id}`, livemode: false, status: "succeeded", latest_charge: { id: `ch_${session.id}`, livemode: false, paid: true, amount_refunded: 0, disputed: false, created: 1757836800 } },
    ...overrides,
  };
}

async function invoke(body: string) {
  const response: { statusCode?: number; body?: unknown } = {};
  const res = {
    status(code: number) { response.statusCode = code; return res; },
    json(value: unknown) { response.body = value; },
  };
  const headers = { "stripe-signature": signStripePayload(body, "whsec_webhook_test") };
  await handler({ method: "POST", headers, body } as never, res);
  return response;
}

test("signed checkout fulfillment requires a canonical paid session; missing URL parks the order as awaiting_url", async () => {
  const saved = { ...process.env };
  const fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), "stripe-fixtures-"));
  delete process.env.POSTGRES_URL;
  delete process.env.VERCEL_ENV;
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_webhook_test";
  process.env.STRIPE_SECRET_KEY = "sk_test_unit";
  process.env.STRIPE_SESSION_FIXTURE_DIR = fixtureDir;
  process.env.LAUNCHAUDIT_LOCAL_DB = `/tmp/launchaudit-webhook-${process.pid}-${Date.now()}`;
  try {
    const paidSession: EventSession = { id: "cs_paid", payment_status: "paid", amount_total: 7900, customer_email: "buyer@example.com", metadata: { target_url: "https://example.com", tier: "single" } };
    await fs.writeFile(path.join(fixtureDir, "cs_paid.json"), JSON.stringify(canonical(paidSession)));
    const paid = await invoke(checkoutEvent(paidSession));
    assert.equal(paid.statusCode, 200);
    assert.equal((paid.body as { status?: string }).status, "queued");

    // Same event again: idempotent, still one row, same status.
    const again = await invoke(checkoutEvent(paidSession));
    assert.equal((again.body as { status?: string }).status, "queued");

    for (const paymentStatus of [undefined, "unpaid"]) {
      const s: EventSession = { id: `cs_${paymentStatus ?? "missing"}`, payment_status: paymentStatus, amount_total: 7900, customer_email: "buyer@example.com", metadata: { target_url: "https://example.com", tier: "single" } };
      await fs.writeFile(path.join(fixtureDir, `${s.id}.json`), JSON.stringify(canonical(s)));
      const ignored = await invoke(checkoutEvent(s));
      assert.equal(ignored.statusCode, 200);
      assert.deepEqual(ignored.body, { received: true, ignored: "not_verified_paid_audit" });
    }

    // Wrong amount for the tier: refused even though paid.
    const wrong: EventSession = { id: "cs_wrongamount", payment_status: "paid", amount_total: 100, customer_email: "buyer@example.com", metadata: { target_url: "https://example.com", tier: "pro" } };
    await fs.writeFile(path.join(fixtureDir, "cs_wrongamount.json"), JSON.stringify(canonical(wrong)));
    assert.deepEqual((await invoke(checkoutEvent(wrong))).body, { received: true, ignored: "not_verified_paid_audit" });

    // Pro tier, pay-first (no target_url): recorded and parked for the success page to collect the URL.
    const deferred: EventSession = { id: "cs_deferred", payment_status: "paid", amount_total: 49900, customer_email: "rob@fusiondataco.com", metadata: { tier: "pro" } };
    await fs.writeFile(path.join(fixtureDir, "cs_deferred.json"), JSON.stringify(canonical(deferred)));
    const parked = await invoke(checkoutEvent(deferred));
    assert.equal(parked.statusCode, 200);
    assert.equal((parked.body as { status?: string }).status, "awaiting_url");

    // Missing fixture (Stripe unreachable in production terms) -> 503 so Stripe retries.
    const gone: EventSession = { id: "cs_nofixture", payment_status: "paid", amount_total: 7900, customer_email: "b@example.com", metadata: { target_url: "https://example.com", tier: "single" } };
    assert.equal((await invoke(checkoutEvent(gone))).statusCode, 503);

    const sql = await getSqlClient();
    assert.ok(sql);
    const rows = await sql("select stripe_session_id, status, target_url from paid_audits order by stripe_session_id");
    assert.deepEqual(rows, [
      { stripe_session_id: "cs_deferred", status: "awaiting_url", target_url: "" },
      { stripe_session_id: "cs_paid", status: "queued", target_url: "https://example.com" },
    ]);
  } finally {
    for (const k of ["STRIPE_WEBHOOK_SECRET", "STRIPE_SECRET_KEY", "STRIPE_SESSION_FIXTURE_DIR", "LAUNCHAUDIT_LOCAL_DB", "POSTGRES_URL", "VERCEL_ENV"]) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
  }
});

test("the fixture hook is ignored in production", async () => {
  const saved = { ...process.env };
  process.env.VERCEL_ENV = "production";
  process.env.STRIPE_SESSION_FIXTURE_DIR = "/nonexistent";
  delete process.env.STRIPE_SECRET_KEY;
  try {
    const { loadCanonicalSession } = await import("../../server/api-src/stripe-webhook.ts");
    await assert.rejects(loadCanonicalSession("cs_x"), /STRIPE_SECRET_KEY not configured/);
  } finally {
    for (const k of ["VERCEL_ENV", "STRIPE_SESSION_FIXTURE_DIR", "STRIPE_SECRET_KEY"]) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
  }
});
