/**
 * Delivery of a graded paid audit: render the PDF, park a durable copy in Vercel
 * Blob (hosted link), and email the buyer with the PDF attached. Runs right after
 * the grade lands, inside the same serverless invocation, and is idempotent on
 * the row: a second call after a successful send does nothing.
 *
 * Every outcome is recorded in paid_audits.delivery_json so the success page,
 * the operator and STATUS.md can all say exactly what happened:
 *   email.status = "sent" | "skipped" (no SMTP configured) | "error"
 *
 * The hosted link is the platform's own PDF route (always works, regenerates
 * from grade_json) unless a Blob copy uploaded, in which case the Blob URL is the
 * primary link and the route stays as the fallback.
 */
import { randomUUID } from "node:crypto";
import type { SqlClient } from "./db.ts";
import type { DeepGrade } from "./deep-grade.ts";
import type { InstantGrade } from "./instant-grade.ts";
import { sendMail } from "./mailer.ts";
import { formatUsd, tierInfo } from "./checkout-input.ts";
import { renderAuditReportPdf, reportFilename } from "./audit-report-pdf.ts";
import type { PaidAuditRow } from "./paid-audits.ts";

export const SITE_URL = (process.env.PUBLIC_SITE_URL || "https://80-20.dev").replace(/\/$/, "");

export type DeliveryRecord = {
  attempt?: { token: string; state: "preparing" | "sending" | "done" | "retryable" | "uncertain"; started_at: string };
  delivered_at: string;
  pdf_bytes: number;
  blob: { url: string; pathname: string } | null;
  email: { status: "sent" | "skipped" | "error"; detail: string | null; to: string; at: string; subject: string; preview: string; captured?: string | null };
  hands_on: { required: boolean; status: "not_applicable" | "scheduled_by_email" } ;
};

type OkGrade = (InstantGrade | DeepGrade) & { ok: true };

function hostOf(url: string): string { try { return new URL(url).host; } catch { return url; } }

export function orderPageUrl(sessionId: string): string {
  return `${SITE_URL}/order/success?session_id=${encodeURIComponent(sessionId)}`;
}
export function orderReportRouteUrl(sessionId: string): string {
  return `${SITE_URL}/api/order-report?session_id=${encodeURIComponent(sessionId)}`;
}

const BAND_LABEL: Record<string, string> = { green: "launch ready", yellow: "needs work", red: "not ready" };

/** Plain-text email body. Plain hyphens, straight quotes, no filler. */
export function deliveryEmail(row: PaidAuditRow, grade: OkGrade, links: { report: string; page: string }): { subject: string; text: string } {
  const info = tierInfo(row.tier);
  const host = hostOf(grade.url);
  const top = grade.findings.slice(0, 5).map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.title}`).join("\n");
  const pages = "pages_scanned" in grade ? grade.pages_scanned : 1;
  const lines = [
    `Hi,`,
    ``,
    `Your ${info.label} audit of ${grade.url} is finished.`,
    ``,
    `Score: ${grade.score}/100 (${BAND_LABEL[grade.band] ?? grade.band}). ${grade.summary}`,
    `Pages scanned: ${pages}. Checks passed: ${grade.passed}. Findings: ${grade.findings.length}.`,
    ``,
    grade.findings.length ? `Top findings:\n${top}` : `No findings at the URL level. Every check that can be answered from outside the app came back clean.`,
    ``,
    `The full report is attached as a PDF and also lives here:`,
    links.report,
    ``,
    `Your order page keeps working and re-renders the report any time:`,
    links.page,
    ``,
    info.handsOn
      ? `What happens next: ${info.next}`
      : `What happens next: nothing you need to do. If we could not read part of the site, the report says so plainly rather than guessing.`,
    ``,
    `Order: ${row.id}, ${info.label}, ${formatUsd(row.amount_cents)}, site ${host}.`,
    ``,
    `Questions? Reply to this email or write to rob@fusiondataco.com.`,
    ``,
    `Rob Yeager`,
    `Fusion Data Company`,
    `80/20 Launch Audit - https://80-20.dev`,
  ];
  return { subject: `Your 80/20 Launch Audit report: ${host} scored ${grade.score}/100`, text: lines.join("\n") };
}

async function uploadPdf(row: PaidAuditRow, host: string, pdf: Buffer): Promise<{ url: string; pathname: string } | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  try {
    const blob = await import("@vercel/blob");
    const pathname = `launchaudit/orders/${row.id}/${reportFilename(host)}`;
    // The production store is public; a random suffix keeps the URL unguessable, like the evidence uploads.
    const r = await blob.put(pathname, pdf, { access: "public", addRandomSuffix: true, contentType: "application/pdf", token });
    return { url: r.url, pathname: r.pathname };
  } catch {
    return null;
  }
}

/** Only pre-send work or a definite rejection can retry automatically. SMTP uncertainty stays held. */
export const DELIVERY_RECOVERY_PREDICATE = `status = 'delivered' and delivered_email_at is null
  and coalesce(delivery_json->'email'->>'status','') <> 'sent'
  and (delivery_json is null
    or (delivery_json->'attempt'->>'state' in ('preparing','retryable')
      and (delivery_json->'attempt'->>'started_at')::timestamptz < now() - interval '10 minutes')
    or (delivery_json->'attempt' is null and delivery_json->'email'->>'status' = 'skipped'))`;

/** Read-only operator queue: never release these records automatically. */
export const DELIVERY_ATTENTION_PREDICATE = `status = 'delivered' and (
  delivery_json->'attempt'->>'state' = 'uncertain'
  or (delivery_json->'attempt'->>'state' = 'sending'
    and (delivery_json->'attempt'->>'started_at')::timestamptz < now() - interval '10 minutes')
  or (delivery_json->'attempt' is null and delivery_json->'email'->>'status' = 'error'))`;

type DeliveryDependencies = { send?: typeof sendMail; upload?: typeof uploadPdf };
function definitelyRejected(error: string): boolean {
  const rejection = /^SMTP step (\d+) expected \d+, got: [45]\d\d(?:[ -]|$)/.exec(error);
  // Step 9 is QUIT: DATA was already accepted, so its failure must never resend.
  return Boolean(rejection && Number(rejection[1]) <= 8)
    || /^(MONITOR_SMTP_URL is not a valid URL|Only smtps:\/\/)/.test(error);
}

export async function deliverPaidAudit(sql: SqlClient, row: PaidAuditRow, deps: DeliveryDependencies = {}): Promise<PaidAuditRow> {
  if (row.status !== "delivered") return row;
  const grade = row.grade_json && "ok" in row.grade_json && row.grade_json.ok ? (row.grade_json as OkGrade) : null;
  if (!grade) return row;
  const token = randomUUID();
  const at = new Date().toISOString();
  const routeUrl = orderReportRouteUrl(row.stripe_session_id);
  const info = tierInfo(row.tier);
  const record: DeliveryRecord = {
    attempt: { token, state: 'preparing', started_at: at }, delivered_at: at, pdf_bytes: 0, blob: row.delivery_json?.blob ?? null,
    email: { status: 'skipped', detail: 'Preparing report delivery.', to: row.email, at, subject: '', preview: '' },
    hands_on: { required: info.handsOn, status: info.handsOn ? 'scheduled_by_email' : 'not_applicable' },
  };
  // Persist the regenerable PDF link and claim before upload/render/mail. A crash cannot hide the report.
  const claimed = await sql(`update paid_audits set report_url=coalesce(report_url,$2), report_pdf_url=$2,
    delivery_json=$3::jsonb where id=$1 and ${DELIVERY_RECOVERY_PREDICATE} returning *`,
    [row.id, routeUrl, JSON.stringify(record)]);
  if (!claimed.length) return ((await sql('select * from paid_audits where id=$1', [row.id]))[0] as PaidAuditRow) ?? row;
  row = claimed[0] as PaidAuditRow;
  const host = hostOf(grade.url);
  const pdf = renderAuditReportPdf({
    grade,
    order: { id: row.id, tier: row.tier, tierLabel: info.label, amountCents: row.amount_cents, email: row.email, targetUrl: row.target_url, createdAt: row.created_at, completedAt: row.completed_at, includes: info.includes, next: info.next, handsOn: info.handsOn },
    links: { page: orderPageUrl(row.stripe_session_id), report: routeUrl },
  });
  const blob = record.blob ?? await (deps.upload ?? uploadPdf)(row, host, pdf);
  const reportUrl = blob?.url ?? row.report_url ?? routeUrl;
  const mail = deliveryEmail(row, grade, { report: reportUrl, page: orderPageUrl(row.stripe_session_id) });
  record.pdf_bytes = pdf.length; record.blob = blob;
  record.attempt!.state = 'sending';
  record.email = { status: 'error', detail: 'Email acceptance is unconfirmed. Hold for operator review; do not resend automatically.', to: row.email, at, subject: mail.subject, preview: mail.text.slice(0,900) };
  const sending = await sql(`update paid_audits set report_url=$2, delivery_json=$3::jsonb
    where id=$1 and status='delivered' and delivery_json->'attempt'->>'token'=$4 returning id`,
    [row.id, reportUrl, JSON.stringify(record), token]);
  if (sending.length) {
    try {
      const sent = await (deps.send ?? sendMail)({ to: row.email, subject: mail.subject, text: mail.text, attachments: [{ filename: reportFilename(host), contentType: 'application/pdf', content: pdf }] });
      record.email.status = 'ok' in sent ? (sent.ok ? 'sent' : 'error') : 'skipped';
      record.email.detail = 'ok' in sent ? (sent.ok ? null : sent.error) : sent.skipped;
      record.email.captured = sent.captured ?? null;
      record.attempt!.state = 'ok' in sent ? (sent.ok ? 'done' : definitelyRejected(sent.error) ? 'retryable' : 'uncertain') : 'retryable';
    } catch {
      record.attempt!.state = 'uncertain';
    }
    await sql(`update paid_audits set delivery_json=$2::jsonb,
      delivered_email_at=case when $3::boolean then now() else delivered_email_at end
      where id=$1 and status='delivered' and delivery_json->'attempt'->>'token'=$4`,
      [row.id, JSON.stringify(record), record.email.status === 'sent', token]);
  }
  return ((await sql('select * from paid_audits where id=$1', [row.id]))[0] as PaidAuditRow) ?? row;
}
