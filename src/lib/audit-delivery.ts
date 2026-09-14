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
import type { SqlClient } from "./db.ts";
import type { DeepGrade } from "./deep-grade.ts";
import type { InstantGrade } from "./instant-grade.ts";
import { sendMail } from "./mailer.ts";
import { formatUsd, tierInfo } from "./checkout-input.ts";
import { renderAuditReportPdf, reportFilename } from "./audit-report-pdf.ts";
import type { PaidAuditRow } from "./paid-audits.ts";

export const SITE_URL = (process.env.PUBLIC_SITE_URL || "https://80-20.dev").replace(/\/$/, "");

export type DeliveryRecord = {
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

export async function deliverPaidAudit(sql: SqlClient, row: PaidAuditRow): Promise<PaidAuditRow> {
  const grade = row.grade_json && "ok" in row.grade_json && row.grade_json.ok ? (row.grade_json as OkGrade) : null;
  if (!grade) return row;
  if (row.delivery_json && row.delivery_json.email.status === "sent" && row.report_url) return row;

  const info = tierInfo(row.tier);
  const host = hostOf(grade.url);
  const pdf = renderAuditReportPdf({
    grade,
    order: { id: row.id, tier: row.tier, tierLabel: info.label, amountCents: row.amount_cents, email: row.email, targetUrl: row.target_url, createdAt: row.created_at, completedAt: row.completed_at, includes: info.includes, next: info.next, handsOn: info.handsOn },
    links: { page: orderPageUrl(row.stripe_session_id), report: orderReportRouteUrl(row.stripe_session_id) },
  });
  const blob = await uploadPdf(row, host, pdf);
  const routeUrl = orderReportRouteUrl(row.stripe_session_id);
  const reportUrl = blob?.url ?? routeUrl;
  const mail = deliveryEmail(row, grade, { report: reportUrl, page: orderPageUrl(row.stripe_session_id) });
  const at = new Date().toISOString();
  const sent = await sendMail({ to: row.email, subject: mail.subject, text: mail.text, attachments: [{ filename: reportFilename(host), contentType: "application/pdf", content: pdf }] });
  const email: DeliveryRecord["email"] = {
    status: "ok" in sent ? (sent.ok ? "sent" : "error") : "skipped",
    detail: "ok" in sent ? (sent.ok ? null : sent.error) : sent.skipped,
    to: row.email, at, subject: mail.subject, preview: mail.text.slice(0, 900), captured: sent.captured ?? null,
  };
  const record: DeliveryRecord = {
    delivered_at: at, pdf_bytes: pdf.length, blob, email,
    hands_on: { required: info.handsOn, status: info.handsOn ? "scheduled_by_email" : "not_applicable" },
  };
  await sql(
    `update paid_audits set report_url = $2, report_pdf_url = $3, delivery_json = $4::jsonb, delivered_email_at = case when $5::boolean then now() else delivered_email_at end where id = $1`,
    [row.id, reportUrl, routeUrl, JSON.stringify(record), email.status === "sent"],
  );
  const rows = await sql(`select * from paid_audits where id = $1 limit 1`, [row.id]);
  return (rows[0] as PaidAuditRow | undefined) ?? { ...row, report_url: reportUrl, report_pdf_url: routeUrl, delivery_json: record };
}
