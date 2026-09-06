/**
 * paid_audits store — hosted deep-audit orders (see db/migrations/003_paid_audits.sql).
 *
 * What is automatic today: on checkout.session.completed we insert the order and
 * immediately run the instant surface grade (grade_json, status 'graded').
 * What is NOT automatic: the Playwright deep audit needs Chromium, which Vercel
 * functions don't have. Rows stay at 'graded' until a worker/human runs it and
 * sets report_url + status 'delivered'. Never claim otherwise in the UI.
 */
import type { SqlClient } from "./db.ts";
import { paidAuditsSchemaSql } from "./storage-contract.ts";
import { parseTargetUrl, runInstantGrade, type InstantGrade } from "./instant-grade.ts";

export type PaidAuditStatus = "queued" | "graded" | "delivered";

export type PaidAuditRow = {
  id: string;
  stripe_session_id: string;
  email: string;
  target_url: string;
  tier: string;
  amount_cents: number;
  status: PaidAuditStatus;
  grade_json: InstantGrade | { error: string } | null;
  created_at: string;
  completed_at: string | null;
  report_url: string | null;
};

export async function ensurePaidAuditsTable(sql: SqlClient): Promise<void> {
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
  const row = await getPaidAuditBySession(sql, order.stripeSessionId);
  if (!row) throw new Error("paid_audits insert did not persist");
  return row;
}

export async function getPaidAuditBySession(sql: SqlClient, stripeSessionId: string): Promise<PaidAuditRow | null> {
  const rows = await sql(`select * from paid_audits where stripe_session_id = $1 limit 1`, [stripeSessionId]);
  return (rows[0] as PaidAuditRow | undefined) ?? null;
}

/** Run the instant grader for a queued order and persist the result. Safe to re-run. */
export async function gradePaidAudit(sql: SqlClient, row: PaidAuditRow): Promise<PaidAuditRow> {
  if (row.status !== "queued") return row;
  const parsed = parseTargetUrl(row.target_url);
  const result = parsed.ok ? await runInstantGrade(parsed.url) : { ok: false as const, status: 400, error: parsed.error };
  if (result.ok) {
    await sql(`update paid_audits set grade_json = $2::jsonb, status = 'graded' where id = $1`, [row.id, JSON.stringify(result)]);
  } else {
    // Keep status 'queued' so a retry (Stripe redelivery or the worker) can grade it later.
    await sql(`update paid_audits set grade_json = $2::jsonb where id = $1`, [row.id, JSON.stringify({ error: result.error })]);
  }
  return (await getPaidAuditBySession(sql, row.stripe_session_id)) ?? row;
}

/** Public-safe projection for the success page (no email, no internal ids). */
export function publicOrderStatus(row: PaidAuditRow) {
  const g = row.grade_json && "ok" in row.grade_json && row.grade_json.ok ? row.grade_json : null;
  return {
    status: row.status,
    tier: row.tier,
    target_url: row.target_url,
    created_at: row.created_at,
    completed_at: row.completed_at,
    report_url: row.report_url,
    grade: g
      ? { url: g.url, score: g.score, band: g.band, passed: g.passed, summary: g.summary, findings: g.findings }
      : null,
    grade_error: row.grade_json && "error" in row.grade_json ? row.grade_json.error : null,
  };
}
