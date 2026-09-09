import { test } from "node:test";
import assert from "node:assert/strict";
import { signStripePayload } from "./stripe.ts";
import handler from "../../server/api-src/stripe-webhook.ts";
import { getSqlClient } from "./db.ts";

type EventSession = {
  id: string;
  payment_status?: string;
  amount_total: number;
  customer_email: string;
  metadata: { target_url: string; tier: string };
};

function checkoutEvent(session: EventSession): string {
  return JSON.stringify({
    id: `evt_${session.id}`,
    type: "checkout.session.completed",
    data: { object: session },
  });
}

async function invoke(body: string) {
  const response: { statusCode?: number; body?: unknown } = {};
  const res = {
    status(code: number) { response.statusCode = code; return res; },
    json(value: unknown) { response.body = value; },
  };
  const headers = { "stripe-signature": signStripePayload(body, "whsec_webhook_test") };
  await handler({ method: "POST", headers, body }, res);
  return response;
}

test("signed checkout fulfillment requires explicit paid status", async () => {
  const previousSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const previousDb = process.env.LAUNCHAUDIT_LOCAL_DB;
  const previousPostgres = process.env.POSTGRES_URL;
  delete process.env.POSTGRES_URL;
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_webhook_test";
  process.env.LAUNCHAUDIT_LOCAL_DB = `/tmp/launchaudit-webhook-${process.pid}-${Date.now()}`;
  try {
    const paid = await invoke(checkoutEvent({
      id: "cs_paid", payment_status: "paid", amount_total: 7900,
      customer_email: "buyer@example.com", metadata: { target_url: "https://example.com", tier: "single" },
    }));
    assert.equal(paid.statusCode, 200);
    assert.equal((paid.body as { status?: string }).status, "queued");

    for (const paymentStatus of [undefined, "unpaid"]) {
      const ignored = await invoke(checkoutEvent({
        id: `cs_${paymentStatus ?? "missing"}`, payment_status: paymentStatus, amount_total: 7900,
        customer_email: "buyer@example.com", metadata: { target_url: "https://example.com", tier: "single" },
      }));
      assert.equal(ignored.statusCode, 200);
      assert.deepEqual(ignored.body, { received: true, ignored: `payment_status=${paymentStatus ?? "missing"}` });
    }

    const sql = await getSqlClient();
    assert.ok(sql);
    const rows = await sql("select stripe_session_id from paid_audits order by stripe_session_id");
    assert.deepEqual(rows, [{ stripe_session_id: "cs_paid" }]);
  } finally {
    if (previousSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = previousSecret;
    if (previousPostgres === undefined) delete process.env.POSTGRES_URL;
    else process.env.POSTGRES_URL = previousPostgres;
    if (previousDb === undefined) delete process.env.LAUNCHAUDIT_LOCAL_DB;
    else process.env.LAUNCHAUDIT_LOCAL_DB = previousDb;
  }
});
