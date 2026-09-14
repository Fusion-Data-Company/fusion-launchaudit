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
import { getSqlClient } from "../../src/lib/db.ts";
import { demoReportsSchemaSql } from "../../src/lib/storage-contract.ts";
import { runDeepGrade } from "../../src/lib/deep-grade.ts";
import { parseTargetUrl } from "../../src/lib/instant-grade.ts";
import { withAuditDeadline } from "../../src/lib/audit-deadline.ts";
import snapshot from "../../public/demo/fusiondataco.json" with { type: "json" };

type Req = { method?: string; headers?: Record<string, string | string[] | undefined>; query?: Record<string, string | string[] | undefined>; url?: string };
type Res = { status: (n: number) => Res; setHeader?: (k: string, v: string) => void; json: (b: unknown) => void };

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
      id: row.id, url: row.url, tier: row.tier, grade: row.grade_json, pdf_url: row.pdf_url,
      buyer: { name: row.buyer_name, company: row.buyer_company, email: row.buyer_email },
      created_at: row.created_at,
    },
  };
}

export default async function handler(req: Req, res: Res) {
  res.setHeader?.("cache-control", "public, max-age=300, s-maxage=3600");
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
      const rows = (await sql(`select * from demo_reports where url = $1 order by created_at desc limit 1`, [DEMO_URL])) as DemoRow[];
      if (rows[0]) { res.status(200).json(shape(rows[0], "postgres")); return; }
    } catch { /* fall through to the committed snapshot */ }
  }
  const snap = snapshot as unknown as { seeded?: boolean; report?: DemoRow };
  if (snap && snap.seeded && snap.report) { res.status(200).json(shape(snap.report, "snapshot")); return; }
  res.setHeader?.("cache-control", "no-store");
  res.status(404).json({ ok: false, error: "The sample report has not been generated yet. Run `npm run demo:seed` (real audit of fusiondataco.com, persisted to Postgres and public/demo/fusiondataco.json)." });
}
