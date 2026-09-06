/**
 * /api/stripe-webhook — Stripe → us. Raw body, signature verified with
 * STRIPE_WEBHOOK_SECRET. On checkout.session.completed:
 *   1. insert the order into paid_audits (idempotent on stripe_session_id, status 'queued')
 *   2. IMMEDIATELY run the instant surface grader against target_url → grade_json, status 'graded'
 * The Playwright deep audit is NOT run here (no Chromium on Vercel); the row stays
 * at 'graded' so a worker/human can pick it up, run it, and set report_url + 'delivered'.
 */
import { getSqlClient } from "../../src/lib/db.ts";
import { verifyStripeSignature } from "../../src/lib/stripe.ts";
import { ensurePaidAuditsTable, gradePaidAudit, upsertPaidAudit } from "../../src/lib/paid-audits.ts";
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

  if (event.type !== "checkout.session.completed") { res.status(200).json({ received: true, ignored: event.type }); return; }
  const session = event.data?.object;
  if (!session?.id) { res.status(400).json({ error: "No session in event." }); return; }
  if (session.payment_status && session.payment_status !== "paid") { res.status(200).json({ received: true, ignored: `payment_status=${session.payment_status}` }); return; }

  const targetUrl = session.metadata?.target_url?.trim();
  const tier = session.metadata?.tier;
  const email = (session.customer_details?.email || session.customer_email || "").trim();
  if (!targetUrl || !isAuditTier(tier) || !email) { res.status(400).json({ error: "Session is missing target_url / tier / email." }); return; }

  const sql = await getSqlClient();
  if (!sql) { res.status(503).json({ error: "Database not configured — Stripe will retry." }); return; }

  try {
    await ensurePaidAuditsTable(sql);
    const row = await upsertPaidAudit(sql, {
      stripeSessionId: session.id, email, targetUrl, tier, amountCents: session.amount_total ?? 0,
    });
    // Automatic part that ships today: the instant surface grade. Deep audit is queued for a worker.
    const graded = await gradePaidAudit(sql, row);
    res.status(200).json({ received: true, id: graded.id, status: graded.status });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not record order." });
  }
}
