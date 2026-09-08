/**
 * /api/waitlist — the free-scan unlock. POST { email, scan_id } records the lead
 * and returns the FULL findings for that stored scan (score, every issue, every
 * agent-ready fix). Also the door to weekly monitoring: pass monitor:true to
 * enrol the scanned URL. No email is ever sent from here.
 */
import { getSqlClient } from "../../src/lib/db.ts";
import { clientIp, consumeAttempt } from "../../src/lib/rate-limit.ts";
import { ensureScanTables, getScan, recordLead, upsertMonitor } from "../../src/lib/scan-store.ts";

type Req = { method?: string; headers?: Record<string, string | string[] | undefined>; body?: { email?: string; scan_id?: string; monitor?: boolean } };
type Res = { status: (n: number) => Res; json: (b: unknown) => void };

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST a JSON body { email, scan_id }." }); return; }
  const rl = consumeAttempt({ scope: "waitlist", key: clientIp(req.headers), limit: 20, windowMs: 10 * 60_000 });
  if (!rl.ok) { res.status(429).json({ error: `Too many requests. Try again in ${rl.retryAfterSec}s.` }); return; }
  const email = (req.body?.email ?? "").trim();
  const scanId = (req.body?.scan_id ?? "").trim() || null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { res.status(400).json({ error: "Enter a valid email." }); return; }
  if (email.length > 320) { res.status(400).json({ error: "That email is too long." }); return; }

  const sql = await getSqlClient();
  if (!sql) { res.status(503).json({ error: "Unlock is temporarily unavailable — the full report is free in your own agent (see Connect)." }); return; }
  try {
    await ensureScanTables(sql);
    const scan = scanId ? await getScan(sql, scanId) : null;
    await recordLead(sql, email, scanId, scan?.origin ?? null);
    if (req.body?.monitor && scan?.origin) await upsertMonitor(sql, { origin: scan.origin, email });
    res.status(200).json({
      ok: true,
      findings: scan?.findings ?? [],
      score: scan?.score ?? null,
      band: scan?.band ?? null,
      counts: scan?.counts ?? null,
      monitoring: Boolean(req.body?.monitor && scan?.origin),
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not unlock the report." });
  }
}
