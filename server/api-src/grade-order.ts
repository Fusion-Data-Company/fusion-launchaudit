/**
 * /api/grade-order — grade every queued paid audit (or one, with ?session_id=).
 * Gated by RUNNER_SYNC_SECRET or CRON_SECRET as a bearer token. Reconciles
 * eligible scan, email-delivery and blocked-refund retries one job per invocation. Exists so an order whose buyer closed the tab
 * still gets graded by the hourly sweep instead of sitting queued forever.
 */
import { DELIVERY_RECOVERY_PREDICATE } from "../../src/lib/audit-delivery.ts";
import { getSqlClient } from "../../src/lib/db.ts";
import { BLOCKED_REFUND_RECOVERY_PREDICATE, ensurePaidAuditsTable, getPaidAuditBySession, gradePaidAudit, type PaidAuditRow } from "../../src/lib/paid-audits.ts";

type Req = { method?: string; headers: Record<string, string | string[] | undefined>; query?: Record<string, string | string[] | undefined>; url?: string };
type Res = { status: (n: number) => Res; json: (b: unknown) => void };

export default async function handler(req: Req, res: Res) {
  const secrets = [process.env.CRON_SECRET, process.env.RUNNER_SYNC_SECRET].filter(Boolean);
  const auth = req.headers["authorization"];
  const given = (Array.isArray(auth) ? auth[0] : auth) || "";
  if (!secrets.some(secret => given === `Bearer ${secret}`)) { res.status(401).json({ error: "Unauthorized." }); return; }
  const sql = await getSqlClient();
  if (!sql) { res.status(503).json({ error: "Database not configured." }); return; }
  await ensurePaidAuditsTable(sql);
  let sid = req.query?.session_id;
  if (Array.isArray(sid)) sid = sid[0];
  if (!sid && req.url) sid = new URL(req.url, "http://x").searchParams.get("session_id") ?? undefined;
  const rows = sid
    ? [await getPaidAuditBySession(sql, sid)].filter((r): r is PaidAuditRow => !!r)
    : ((await sql(`select * from paid_audits
      where (status = 'queued' and (grade_claimed_at is null or grade_claimed_at < now() - interval '10 minutes'))
        or (${DELIVERY_RECOVERY_PREDICATE})
        or (${BLOCKED_REFUND_RECOVERY_PREDICATE})
      order by case when status in ('queued','blocked') then coalesce(grade_claimed_at, created_at)
        else coalesce((delivery_json->'attempt'->>'started_at')::timestamptz, created_at)
      end asc, created_at asc, id asc limit 1`)) as PaidAuditRow[]);
  const out: Array<{ id: string; status: string }> = [];
  for (const row of rows) {
    const g = await gradePaidAudit(sql, row);
    out.push({ id: g.id, status: g.status });
  }
  res.status(200).json({ ok: true, graded: out });
}
