/**
 * /api/order-report?session_id=cs_...: the hosted PDF for a delivered order, regenerated
 * from grade_json on every request so it never depends on Blob. Same access model as the
 * success page: the unguessable Stripe session id is the key. Closed orders (refunded,
 * disputed) return 410 and no report.
 */
import { getSqlClient } from "../../src/lib/db.ts";
import { tierInfo } from "../../src/lib/checkout-input.ts";
import { ensurePaidAuditsTable, getPaidAuditBySession } from "../../src/lib/paid-audits.ts";
import { renderAuditReportPdf, reportFilename } from "../../src/lib/audit-report-pdf.ts";
import { orderPageUrl, orderReportRouteUrl } from "../../src/lib/audit-delivery.ts";

type Req = { method?: string; query?: Record<string, string | string[] | undefined>; url?: string };
type Res = { status: (n: number) => Res; setHeader?: (k: string, v: string) => void; json: (b: unknown) => void; end: (b?: Buffer | string) => void };

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET") { res.status(405).json({ error: "GET ?session_id=" }); return; }
  let sid = req.query?.session_id;
  if (Array.isArray(sid)) sid = sid[0];
  if (!sid && req.url) sid = new URL(req.url, "http://x").searchParams.get("session_id") ?? undefined;
  if (!sid || !/^cs_[A-Za-z0-9_]{8,200}$/.test(sid)) { res.status(400).json({ error: "Provide a valid session_id." }); return; }
  res.setHeader?.("cache-control", "private, no-store");
  const sql = await getSqlClient();
  if (!sql) { res.status(503).json({ error: "Reports are temporarily unavailable." }); return; }
  try {
    await ensurePaidAuditsTable(sql);
    const row = await getPaidAuditBySession(sql, sid);
    if (!row) { res.status(404).json({ error: "No order for that session id." }); return; }
    if (row.status === "refunded" || row.status === "disputed") { res.status(410).json({ error: `This order was ${row.status}; the report is no longer served.` }); return; }
    const grade = row.grade_json && "ok" in row.grade_json && row.grade_json.ok ? row.grade_json : null;
    if (!grade) { res.status(404).json({ error: "The report is not ready yet. Open your order page; it updates itself.", status: row.status }); return; }
    const info = tierInfo(row.tier);
    const pdf = renderAuditReportPdf({
      grade,
      order: { id: row.id, tier: row.tier, tierLabel: info.label, amountCents: row.amount_cents, email: row.email, targetUrl: row.target_url, createdAt: row.created_at, completedAt: row.completed_at, includes: info.includes, next: info.next, handsOn: info.handsOn },
      links: { page: orderPageUrl(row.stripe_session_id), report: orderReportRouteUrl(row.stripe_session_id) },
    });
    let host = row.target_url; try { host = new URL(grade.url).host; } catch { /* keep */ }
    res.setHeader?.("content-type", "application/pdf");
    res.setHeader?.("content-disposition", `inline; filename="${reportFilename(host)}"`);
    res.setHeader?.("content-length", String(pdf.length));
    res.status(200).end(pdf);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not render the report." });
  }
}
