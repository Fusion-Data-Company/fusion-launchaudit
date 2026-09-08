/**
 * /api/grade — free, instant, URL-only surface grade with the vibe-coder checks.
 * Returns a score + the top findings, and (when Postgres is configured) locks the
 * rest behind an email unlock, persisting the full scan so /api/waitlist can
 * hand it back. Without Postgres it degrades honestly: full findings, no gate.
 */
import { parseTargetUrl, runInstantGrade } from "../../src/lib/instant-grade.ts";
import { clientIp, consumeAttempt } from "../../src/lib/rate-limit.ts";
import { getSqlClient } from "../../src/lib/db.ts";
import { ensureScanTables, gateFreeGrade, recordScan, countBySeverity } from "../../src/lib/scan-store.ts";

type VercelRequest = { method?: string; headers?: Record<string, string | string[] | undefined>; body?: { url?: string } };
type VercelResponse = { status: (code: number) => VercelResponse; json: (body: unknown) => void };

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "POST") { response.status(405).json({ error: "POST a JSON body { url }." }); return; }
  // The free grader probes third-party hosts on the visitor's say-so. Cap it per IP so
  // nobody turns it into a scanner they point at other people's sites all day.
  const rl = consumeAttempt({ scope: "grade", key: clientIp(request.headers), limit: 10, windowMs: 10 * 60_000 });
  if (!rl.ok) { response.status(429).json({ error: `Too many scans from this address. Try again in ${rl.retryAfterSec}s, or run the audit free in your own agent.` }); return; }
  const parsed = parseTargetUrl(request.body?.url);
  if (!parsed.ok) { response.status(400).json({ error: parsed.error }); return; }
  const result = await runInstantGrade(parsed.url);
  if (!result.ok) { response.status(result.status).json({ error: result.error }); return; }

  // Persist + gate when Postgres is available; otherwise return everything.
  try {
    const sql = await getSqlClient();
    if (sql) {
      await ensureScanTables(sql);
      const row = await recordScan(sql, result, "free");
      response.status(200).json(gateFreeGrade(result, row.id));
      return;
    }
  } catch { /* fall through to the ungated result — never fail the scan on storage */ }

  response.status(200).json({ ...result, counts: countBySeverity(result.findings), locked: { count: 0, by_severity: { critical: 0, high: 0, medium: 0, low: 0 }, categories: [] }, scan_id: null });
}
