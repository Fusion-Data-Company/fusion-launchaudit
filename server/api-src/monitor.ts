/**
 * /api/monitor — scan history + weekly monitoring for a URL.
 *   GET  ?url=<origin>   -> { monitor, history:[{score,band,counts,created_at}], latest, diff }
 *   POST { url, email?, agency_name?, logo_url? } -> enrol/refresh a weekly monitor
 *                                                    (also runs one scan now so
 *                                                    the sparkline is not empty).
 * Read is public (the /monitor page uses it); enrolment records a lead too.
 */
import { getSqlClient } from "../../src/lib/db.ts";
import { clientIp, consumeAttempt } from "../../src/lib/rate-limit.ts";
import { parseTargetUrl, runInstantGrade } from "../../src/lib/instant-grade.ts";
import {
  diffScans, ensureScanTables, getMonitor, getScan, markMonitorRun,
  recordScan, scanHistory, upsertMonitor,
} from "../../src/lib/scan-store.ts";

type Req = { method?: string; headers?: Record<string, string | string[] | undefined>; query?: Record<string, string | string[] | undefined>; url?: string; body?: { url?: string; email?: string; agency_name?: string; logo_url?: string } };
type Res = { status: (n: number) => Res; setHeader?: (k: string, v: string) => void; json: (b: unknown) => void };

function originOf(input: string): string | null {
  const parsed = parseTargetUrl(input);
  return parsed.ok ? parsed.url.origin : null;
}

export default async function handler(req: Req, res: Res) {
  const sql = await getSqlClient();
  if (!sql) { res.status(503).json({ error: "Monitoring requires Postgres and is not configured here." }); return; }
  try {
    await ensureScanTables(sql);

    if (req.method === "GET") {
      let raw = req.query?.url;
      if (Array.isArray(raw)) raw = raw[0];
      if (!raw && req.url) raw = new URL(req.url, "http://x").searchParams.get("url") ?? undefined;
      const origin = raw ? originOf(String(raw)) : null;
      if (!origin) { res.status(400).json({ error: "Provide ?url=" }); return; }
      res.setHeader?.("cache-control", "no-store");
      const history = await scanHistory(sql, origin, 30);
      const monitor = await getMonitor(sql, origin);
      const latest = history[0] ?? null;
      const prev = history[1] ?? null;
      const diff = latest ? diffScans(prev ? { score: prev.score, findings: prev.findings } : null, { score: latest.score, findings: latest.findings }) : null;
      res.status(200).json({
        ok: true,
        origin,
        monitor: monitor ? { active: monitor.active, frequency: monitor.frequency, email_set: Boolean(monitor.email), agency_name: monitor.agency_name, logo_url: monitor.logo_url, last_run_at: monitor.last_run_at } : null,
        history: history.map((h) => ({ id: h.id, score: h.score, band: h.band, counts: h.counts, created_at: h.created_at })).reverse(),
        latest,
        diff,
      });
      return;
    }

    if (req.method === "POST") {
      const rl = consumeAttempt({ scope: "monitor", key: clientIp(req.headers), limit: 10, windowMs: 10 * 60_000 });
      if (!rl.ok) { res.status(429).json({ error: `Too many requests. Try again in ${rl.retryAfterSec}s.` }); return; }
      const origin = req.body?.url ? originOf(req.body.url) : null;
      if (!origin) { res.status(400).json({ error: "Provide a valid url." }); return; }
      const email = (req.body?.email ?? "").trim() || null;
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { res.status(400).json({ error: "Enter a valid email." }); return; }
      const agencyName = (req.body?.agency_name ?? "").trim().slice(0, 120) || null;
      const logoUrl = (req.body?.logo_url ?? "").trim().slice(0, 500) || null;
      const monitor = await upsertMonitor(sql, { origin, email, agencyName, logoUrl });
      // Run one scan now so the history/sparkline is not empty on day one.
      const parsed = parseTargetUrl(origin);
      if (parsed.ok) {
        const grade = await runInstantGrade(parsed.url);
        if (grade.ok) { const row = await recordScan(sql, grade, "monitor"); await markMonitorRun(sql, origin, row.id); }
      }
      res.status(200).json({ ok: true, origin, monitoring: true, frequency: monitor.frequency });
      return;
    }

    res.status(405).json({ error: "GET ?url= or POST { url }." });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Monitor request failed." });
  }
}
