/**
 * paid_audits store — hosted deep-audit orders (see db/migrations/003_paid_audits.sql).
 *
 * What is automatic today: on checkout.session.completed we insert the order and
 * immediately run the site-wide URL-only deep grade (grade_json; Single Run → delivered, others → graded).
 * What is NOT automatic: the Playwright deep audit needs Chromium, which Vercel
 * functions don't have. Rows stay at 'graded' until a worker/human runs it and
 * sets report_url + status 'delivered'. Never claim otherwise in the UI.
 */
import { paymentLifecycleSchema, reconcilePaymentState } from "./payment-lifecycle.ts";
import { randomUUID } from "node:crypto";
import type { SqlClient } from "./db.ts";
import { paidAuditsSchemaSql } from "./storage-contract.ts";
import { parseTargetUrl, type InstantGrade } from "./instant-grade.ts";
import { runDeepGrade, type DeepGrade } from "./deep-grade.ts";
import { stripeGet, stripeRequest } from "./stripe.ts";

export type PaidAuditStatus = "queued" | "graded" | "delivered" | "blocked" | "payment_failed" | "refunded" | "disputed";

export type PaidAuditRow = {
  id: string;
  stripe_session_id: string;
  email: string;
  target_url: string;
  tier: string;
  amount_cents: number;
  status: PaidAuditStatus;
  grade_json: InstantGrade | DeepGrade | { error: string } | null;
  created_at: string;
  completed_at: string | null;
  report_url: string | null;
};

export async function ensurePaidAuditsTable(sql: SqlClient): Promise<void> {
  await sql(paymentLifecycleSchema);
  for (const stmt of paidAuditsSchemaSql.split(";").map((s) => s.trim()).filter(Boolean)) await sql(stmt);
}

export function newPaidAuditId(): string {
  return "pa_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Idempotent insert keyed on the Stripe session id. Returns the current row either way. */
export async function upsertPaidAudit(
  sql: SqlClient,
  order: { stripeSessionId: string; email: string; targetUrl: string; tier: string; amountCents: number },
): Promise<PaidAuditRow> {
  await sql(
    `insert into paid_audits (id, stripe_session_id, email, target_url, tier, amount_cents, status)
     values ($1, $2, $3, $4, $5, $6, 'queued')
     on conflict (stripe_session_id) do nothing`,
    [newPaidAuditId(), order.stripeSessionId, order.email, order.targetUrl, order.tier, order.amountCents],
  );
  await reconcilePaymentState(sql, order.stripeSessionId);
  const row = await getPaidAuditBySession(sql, order.stripeSessionId);
  if (!row) throw new Error("paid_audits insert did not persist");
  return row;
}

export async function getPaidAuditBySession(sql: SqlClient, stripeSessionId: string): Promise<PaidAuditRow | null> {
  const rows = await sql(`select * from paid_audits where stripe_session_id = $1 limit 1`, [stripeSessionId]);
  return (rows[0] as PaidAuditRow | undefined) ?? null;
}

/**
 * Run the paid (site-wide) grader for a queued order and persist the result. Safe to re-run.
 * Every paid tier gets the deep URL-only grade; the free /api/grade stays the single-URL surface scan.
 */
export async function gradePaidAudit(sql: SqlClient, row: PaidAuditRow): Promise<PaidAuditRow> {
  if (row.status !== "queued") return row;
  const claim = randomUUID();
  const owned = await sql(`update paid_audits set grade_claim_token=$2, grade_claimed_at=now()
    where id=$1 and status='queued'
      and (grade_claimed_at is null or grade_claimed_at < now() - interval '10 minutes')
    returning id`, [row.id, claim]);
  if (!owned.length) return (await getPaidAuditBySession(sql, row.stripe_session_id)) ?? row;
  const parsed = parseTargetUrl(row.target_url);
  const result = parsed.ok ? await runDeepGrade(parsed.url) : { ok: false as const, status: 400, error: parsed.error };
  if (result.ok) {
    // Single Run: the instant grade IS the deliverable, so the order completes here with no human step.
    if (row.tier === "single") {
      await sql(`update paid_audits set grade_json = $2::jsonb, status = 'delivered', completed_at = now() where id = $1 and status='queued' and grade_claim_token=$3`, [row.id, JSON.stringify(result), claim]);
    } else {
      await sql(`update paid_audits set grade_json = $2::jsonb, status = 'graded' where id = $1 and status='queued' and grade_claim_token=$3`, [row.id, JSON.stringify(result), claim]);
    }
  } else if ("blocked" in result && result.blocked) {
    // The target would not let us see it. That is a real outcome the buyer must
    // be told about, and it is the refund trigger the refund policy names.
    const refund = await refundBlockedOrder(sql, row, claim);
    await sql(`update paid_audits set grade_json = $2::jsonb, status = 'blocked', completed_at = now() where id = $1 and status='queued' and grade_claim_token=$3`, [row.id, JSON.stringify({ error: result.error, blocked: true, http_status: result.http_status ?? null, refund }), claim]);
  } else {
    // Keep status 'queued' so a retry (the next poll or the sweep) can grade it later.
    await sql(`update paid_audits set grade_json = $2::jsonb, grade_claim_token=null, grade_claimed_at=null where id = $1 and status='queued' and grade_claim_token=$3`, [row.id, JSON.stringify({ error: result.error }), claim]);
  }
  return (await getPaidAuditBySession(sql, row.stripe_session_id)) ?? row;
}

/**
 * The refund policy promises a blocked run is refunded in full, automatically. Do it here,
 * idempotent on the session id, and record the outcome in grade_json so the order page and
 * the operator can both see whether it went through. A failure never hides the blocked result.
 */
export async function refundBlockedOrder(sql: SqlClient, row: PaidAuditRow, claim: string): Promise<{ id?: string; error?: string; skipped?: string }> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return { skipped: "STRIPE_SECRET_KEY unset" };
  if (process.env.AUTO_REFUND_BLOCKED === "0") return { skipped: "AUTO_REFUND_BLOCKED=0" };
  try {
    // The grader's row may be stale while a Stripe lifecycle webhook closes the
    // payment. Reconcile first, then require the same queued claim before any
    // external refund side effect.
    await reconcilePaymentState(sql, row.stripe_session_id);
    const current = await sql(`select a.status, a.grade_claim_token
      from paid_audits a where a.id=$1 limit 1`, [row.id]);
    const currentRow = current[0] as { status?: PaidAuditStatus; grade_claim_token?: string | null } | undefined;
    if (!currentRow || currentRow.status !== "queued" || currentRow.grade_claim_token !== claim) {
      return { skipped: `order is ${currentRow?.status ?? "missing"}` };
    }
    const session = await stripeGet<{ payment_intent?: string | null }>(secret, `/v1/checkout/sessions/${encodeURIComponent(row.stripe_session_id)}`);
    if (!session.payment_intent) return { error: "session has no payment_intent" };
    const r = await stripeRequest<{ id: string }>(
      secret,
      "/v1/refunds",
      { payment_intent: session.payment_intent, reason: "requested_by_customer", metadata: { launchaudit_order: row.id, cause: "blocked" } },
      { idempotencyKey: `launchaudit-refund-${row.stripe_session_id}` },
    );
    return { id: r.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Public-safe projection for the success page (no email, no internal ids). */
export function publicOrderStatus(row: PaidAuditRow) {
  const closed = row.status === "refunded" || row.status === "disputed";
  const g = !closed && row.grade_json && "ok" in row.grade_json && row.grade_json.ok ? row.grade_json : null;
  const gj = row.grade_json as { blocked?: boolean; error?: string; refund?: { id?: string; error?: string; skipped?: string } } | null;
  const blocked = gj && gj.blocked ? gj.error ?? null : null;
  const refunded = !!(gj && gj.refund && gj.refund.id);
  return {
    status: row.status,
    blocked,
    refunded,
    tier: row.tier,
    target_url: row.target_url,
    created_at: row.created_at,
    completed_at: row.completed_at,
    report_url: closed ? null : row.report_url,
    grade: g
      ? {
          url: g.url, score: g.score, band: g.band, passed: g.passed, summary: g.summary, findings: g.findings,
          kind: "kind" in g ? g.kind : "surface",
          pages_scanned: "pages_scanned" in g ? g.pages_scanned : 1,
          checks_run: "checks_run" in g ? g.checks_run : null,
          lighthouse: "lighthouse" in g ? g.lighthouse : null,
        }
      : null,
    grade_error: row.grade_json && "error" in row.grade_json ? row.grade_json.error : null,
  };
}
