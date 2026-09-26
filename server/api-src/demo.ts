/**
 * /api/demo: the public sample report. One REAL run of the paid generator
 * (runDeepGrade) against https://fusiondataco.com, persisted so the page never
 * re-runs it per view. Source order: newest demo_reports row in Postgres, then
 * the committed snapshot public/demo/fusiondataco.json (same run, written by
 * scripts/seed-demo.ts), then an honest 404 with the seed command.
 *
 * POST with Authorization: Bearer <RUNNER_SYNC_SECRET or CRON_SECRET> re-runs
 * the generator now and persists the new row (that is the refresh path; it is
 * never triggered by a page view).
 */
import { renderAuditReportPdf, reportFilename, type ReportInput } from "../../src/lib/audit-report-pdf.ts";
import { tierInfo } from "../../src/lib/checkout-input.ts";
import { getSqlClient } from "../../src/lib/db.ts";
import { demoReportsSchemaSql } from "../../src/lib/storage-contract.ts";
import { runDeepGrade } from "../../src/lib/deep-grade.ts";
import { parseTargetUrl } from "../../src/lib/instant-grade.ts";
import { withAuditDeadline } from "../../src/lib/audit-deadline.ts";
import snapshot from "../../public/demo/fusiondataco.json" with { type: "json" };

type Req = { method?: string; headers?: Record<string, string | string[] | undefined>; query?: Record<string, string | string[] | undefined>; url?: string };
type Res = { status: (n: number) => Res; setHeader?: (k: string, v: string) => void; json: (b: unknown) => void; end: (b?: Buffer | string) => void };

export const DEMO_URL = "https://fusiondataco.com";
export const DEMO_BUYER = { name: "Rob Yeager", company: "Fusion Data Company", email: "rob@fusiondataco.com" };

type DemoRow = { id: string; url: string; tier: string; grade_json: unknown; pdf_url: string | null; buyer_name: string | null; buyer_company: string | null; buyer_email: string | null; created_at: string };

export function newDemoId(): string { return "demo_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

export async function ensureDemoTable(sql: NonNullable<Awaited<ReturnType<typeof getSqlClient>>>): Promise<void> {
  for (const stmt of demoReportsSchemaSql.split(";").map((s) => s.trim()).filter(Boolean)) await sql(stmt);
}

function shape(row: DemoRow, source: string) {
  return {
    ok: true, source,
    report: {
      id: row.id, url: row.url, tier: row.tier, grade: row.grade_json, pdf_url: `/api/demo?format=pdf&id=${encodeURIComponent(row.id)}`,
      buyer: { name: row.buyer_name, company: row.buyer_company, email: row.buyer_email },
      created_at: row.created_at,
    },
  };
}

function respond(row: DemoRow, source: string, pdf: boolean, res: Res) {
  if (!pdf) { res.status(200).json(shape(row, source)); return; }
  const grade = row.grade_json as ReportInput['grade'];
  if (!grade?.ok || !Array.isArray(grade.findings)) {
    res.setHeader?.('cache-control', 'no-store');
    res.status(503).json({ error: 'This sample report cannot be rendered.' }); return;
  }
  const info = tierInfo(row.tier);
  const bytes = renderAuditReportPdf({
    grade, sample: true,
    order: { id: row.id, tier: row.tier, tierLabel: info.label, amountCents: info.amountCents,
      email: row.buyer_email || '', targetUrl: row.url, createdAt: row.created_at, completedAt: row.created_at,
      includes: info.includes, next: 'This is a saved sample run, not a paid customer order. Choose a tier to audit your own application.', handsOn: false },
    links: { page: 'https://80-20.dev/demo', report: `https://80-20.dev/api/demo?format=pdf&id=${encodeURIComponent(row.id)}` },
    eyebrow: '80/20 LAUNCH AUDIT | SAMPLE REPORT (SAVED RUN)',
  });
  res.setHeader?.('content-type', 'application/pdf');
  res.setHeader?.('content-disposition', `inline; filename="${reportFilename(new URL(row.url).host)}"`);
  res.setHeader?.('content-length', String(bytes.length));
  res.status(200).end(bytes);
}

export default async function handler(req: Req, res: Res) {
  res.setHeader?.("cache-control", "public, max-age=300, s-maxage=3600");
  const params = new URL(req.url || '/api/demo', 'https://80-20.dev').searchParams;
  const queryValue = (key: string) => {
    const value = req.query?.[key];
    return (Array.isArray(value) ? value[0] : value) ?? params.get(key);
  };
  const id = queryValue('id');
  const pdf = queryValue('format') === 'pdf';
  if (id && !/^demo_[A-Za-z0-9_]{1,100}$/.test(id)) {
    res.setHeader?.('cache-control', 'no-store');
    res.status(400).json({ error: 'Invalid sample report ID.' }); return;
  }
  const sql = await getSqlClient();

  if (req.method === "POST") {
    const secrets = [process.env.RUNNER_SYNC_SECRET, process.env.CRON_SECRET].filter(Boolean);
    const auth = req.headers?.["authorization"];
    const given = (Array.isArray(auth) ? auth[0] : auth) || "";
    if (!secrets.length || !secrets.some((s) => given === `Bearer ${s}`)) { res.status(401).json({ error: "Unauthorized." }); return; }
    if (!sql) { res.status(503).json({ error: "Postgres is required to persist the demo run." }); return; }
    const parsed = parseTargetUrl(DEMO_URL);
    if (!parsed.ok) { res.status(500).json({ error: parsed.error }); return; }
    const result = await withAuditDeadline(runDeepGrade(parsed.url));
    if (!result.ok) { res.status(502).json({ error: result.error, blocked: "blocked" in result ? result.blocked ?? false : false }); return; }
    await ensureDemoTable(sql);
    const id = newDemoId();
    await sql(`insert into demo_reports (id, url, tier, grade_json, buyer_name, buyer_company, buyer_email) values ($1,$2,'single',$3::jsonb,$4,$5,$6)`,
      [id, DEMO_URL, JSON.stringify(result), DEMO_BUYER.name, DEMO_BUYER.company, DEMO_BUYER.email]);
    const rows = (await sql(`select * from demo_reports where id = $1`, [id])) as DemoRow[];
    res.setHeader?.("cache-control", "no-store");
    res.status(200).json(shape(rows[0], "postgres:fresh"));
    return;
  }

  if (req.method !== "GET") { res.status(405).json({ error: "GET the sample report, or POST with the runner secret to refresh it." }); return; }

  if (sql) {
    try {
      await ensureDemoTable(sql);
      const rows = (await sql(id
        ? `select * from demo_reports where url=$1 and id=$2 limit 1`
        : `select * from demo_reports where url=$1 order by created_at desc limit 1`, id ? [DEMO_URL, id] : [DEMO_URL])) as DemoRow[];
      if (rows[0]) { respond(rows[0], 'postgres', pdf, res); return; }
    } catch { /* fall through to the committed snapshot */ }
  }
  const snap = snapshot as unknown as { seeded?: boolean; report?: DemoRow };
  if (snap && snap.seeded && snap.report && (!id || id === snap.report.id)) { respond(snap.report, "snapshot", pdf, res); return; }
  res.setHeader?.("cache-control", "no-store");
  res.status(404).json({ ok: false, error: "This saved sample is unavailable. Return to /demo to open the current published report." });
}
