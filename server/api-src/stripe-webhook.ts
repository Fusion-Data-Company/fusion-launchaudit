import {validAuditPayment} from '../../src/lib/audit-payment-proof.ts';
import { recordPaymentState, type ClosedPaymentStatus } from "../../src/lib/payment-lifecycle.ts";
/**
 * /api/stripe-webhook — Stripe → us. Raw body, signature verified with
 * STRIPE_WEBHOOK_SECRET. On checkout.session.completed (or async_payment_succeeded):
 *   insert the order into paid_audits (idempotent on stripe_session_id, status 'queued')
 *   and ack Stripe at once. The grade runs in /api/order-status on the buyer's first poll,
 *   or in /api/grade-order (the sweep) if nobody polls.
 * Lifecycle: async_payment_failed -> payment_failed; charge.refunded -> refunded;
 * charge.dispute.created -> disputed. Refunded/disputed orders stop serving the report.
 */
import { getSqlClient } from "../../src/lib/db.ts";
import { stripeGet, verifyStripeSignature } from "../../src/lib/stripe.ts";
import { ensurePaidAuditsTable, upsertPaidAudit } from "../../src/lib/paid-audits.ts";
import { isAuditTier } from "../../src/lib/checkout-input.ts";

// Vercel: disable the JSON body parser so the raw bytes are available for signature verification.
export const config = { api: { bodyParser: false } };

type Req = AsyncIterable<Uint8Array> & { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type Res = { status: (n: number) => Res; json: (b: unknown) => void };

async function readRawBody(req: Req): Promise<Buffer> {
  if (typeof req.body === "string") return Buffer.from(req.body, "utf8");
  if (Buffer.isBuffer(req.body)) return req.body;
  const chunks: Uint8Array[] = [];
  for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
  return Buffer.concat(chunks);
}

type CheckoutSession = {
  id: string;
  payment_intent?: {latest_charge?:{created?:number}};
  payment_status?: string;
  amount_total?: number | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null } | null;
  metadata?: Record<string, string> | null;
};

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Stripe webhook endpoint." }); return; }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) { res.status(503).json({ error: "STRIPE_WEBHOOK_SECRET not configured." }); return; }

  const raw = await readRawBody(req);
  const sigHeader = req.headers["stripe-signature"];
  if (!verifyStripeSignature(raw, Array.isArray(sigHeader) ? sigHeader[0] : sigHeader, secret)) {
    res.status(400).json({ error: "Invalid signature." }); return;
  }

  let event: { id?: string; type?: string; data?: { object?: CheckoutSession } };
  try { event = JSON.parse(raw.toString("utf8")); } catch { res.status(400).json({ error: "Malformed JSON." }); return; }

  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    // Lifecycle events. A session-shaped object carries the cs_ id directly; a refund or
    // dispute arrives as a Charge, which we map back to the session via its payment_intent.
    const lifecycle: Record<string, ClosedPaymentStatus> = {
      "checkout.session.async_payment_failed": "payment_failed",
      "charge.refunded": "refunded",
      "charge.dispute.created": "disputed",
    };
    const next = lifecycle[event.type];
    if (next) {
      const obj = event.data?.object as { id?: string; object?: string; payment_intent?: string | null } | undefined;
      const sql0 = await getSqlClient();
      if (!sql0) { res.status(503).json({ error: "Database unavailable; retry lifecycle event." }); return; }
      let sessionId = obj?.id?.startsWith("cs_") ? obj.id : null;
      const secretKey = process.env.STRIPE_SECRET_KEY;
      if (!sessionId && obj?.payment_intent && secretKey) {
        try {
          const list = await stripeGet<{ data?: { id: string }[] }>(secretKey, `/v1/checkout/sessions?payment_intent=${encodeURIComponent(obj.payment_intent)}&limit=1`);
          sessionId = list.data?.[0]?.id ?? null;
        } catch { res.status(502).json({ error: "Payment lookup failed; retry lifecycle event." }); return; }
      }
      if (!sessionId && obj?.payment_intent && !secretKey) {
        res.status(503).json({ error: "Payment lookup unavailable; retry lifecycle event." }); return;
      }
      if (sessionId) {
        try {
          await ensurePaidAuditsTable(sql0);
          await recordPaymentState(sql0, sessionId, next);
        } catch {
          res.status(500).json({ error: "Could not persist lifecycle event; Stripe should retry." }); return;
        }
      }
    }
    res.status(200).json({ received: true, ignored: event.type }); return;
  }
  let session = event.data?.object;
  if(session?.id){try{const key=process.env.STRIPE_SECRET_KEY;if(!key)throw Error('notconfigured');session=await stripeGet<CheckoutSession>(key,`/v1/checkout/sessions/${encodeURIComponent(session.id)}?expand[]=payment_intent.latest_charge`);if(!validAuditPayment(session)){res.status(200).json({received:true,ignored:'not_verified_live_paid_audit'});return;}}catch{res.status(503).json({error:'Canonical payment verification unavailable; retry event'});return;}}
  if (!session?.id) { res.status(400).json({ error: "No session in event." }); return; }
  if (session.payment_status !== "paid") { res.status(200).json({ received: true, ignored: `payment_status=${session.payment_status ?? "missing"}` }); return; }

  const targetUrl = session.metadata?.target_url?.trim();
  const tier = session.metadata?.tier;
  const email = (session.customer_details?.email || session.customer_email || "").trim();
  if (!targetUrl || !isAuditTier(tier) || !email) { res.status(400).json({ error: "Session is missing target_url / tier / email." }); return; }

  const sql = await getSqlClient();
  if (!sql) { res.status(503).json({ error: "Database not configured — Stripe will retry." }); return; }

  try {
    await ensurePaidAuditsTable(sql);
    const row = await upsertPaidAudit(sql, {
      stripeSessionId: session.id, email, targetUrl, tier, amountCents: session.amount_total ?? 0, paidAt:session.payment_intent?.latest_charge?.created?new Date(session.payment_intent.latest_charge.created*1000).toISOString():undefined,
    });
    // Ack Stripe inside a second. The grade itself runs in /api/order-status (the
    // success page polls it) or /api/grade-order (secret-gated sweep), each with
    // its own time budget, so a slow or blocked target never times out the webhook.
    res.status(200).json({ received: true, id: row.id, status: row.status });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not record order." });
  }
}
