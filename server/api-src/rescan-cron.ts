/**
 * /api/rescan-cron — weekly monitoring worker, run by Vercel Cron (see vercel.json).
 * For each monitor due, re-run the deep URL grade, store the scan, diff it against
 * the previous run, and email the diff to the monitor's contact IF and ONLY IF an
 * SMTP server is configured (MONITOR_SMTP_URL). No mailer configured => no email,
 * reported honestly in the response. Protected by CRON_SECRET when set.
 */
import { getSqlClient } from "../../src/lib/db.ts";
import { parseTargetUrl } from "../../src/lib/instant-grade.ts";
import { runDeepGrade } from "../../src/lib/deep-grade.ts";
import {
  diffScans, ensureScanTables, markMonitorRun, monitorsDue, recordScan, scanHistory,
  type ScanDiff,
} from "../../src/lib/scan-store.ts";
import { mailerConfigured, sendMail } from "../../src/lib/mailer.ts";

type Req = { method?: string; headers?: Record<string, string | string[] | undefined>; query?: Record<string, string | string[] | undefined>; url?: string };
type Res = { status: (n: number) => Res; json: (b: unknown) => void };

function authorized(req: Req): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret set => allow (Vercel Cron is the only caller path in practice)
  const h = req.headers ?? {};
  const auth = (Array.isArray(h.authorization) ? h.authorization[0] : h.authorization) ?? "";
  if (auth === `Bearer ${secret}`) return true;
  let q = req.query?.key;
  if (Array.isArray(q)) q = q[0];
  if (!q && req.url) q = new URL(req.url, "http://x").searchParams.get("key") ?? undefined;
  return q === secret;
}

function diffEmail(origin: string, diff: ScanDiff): string {
  const lines: string[] = [`80/20 Launch Audit — weekly monitor for ${origin}`, ""];
  lines.push(`Score: ${diff.score_from} -> ${diff.score_to} (${diff.score_delta >= 0 ? "+" : ""}${diff.score_delta})`, "");
  if (diff.new_findings.length) { lines.push(`NEW issues (${diff.new_findings.length}):`); for (const f of diff.new_findings) lines.push(`  - [${f.severity}] ${f.title}`); lines.push(""); }
  if (diff.fixed_findings.length) { lines.push(`FIXED since last week (${diff.fixed_findings.length}):`); for (const f of diff.fixed_findings) lines.push(`  - ${f.title}`); lines.push(""); }
  if (!diff.new_findings.length && !diff.fixed_findings.length) lines.push("No change since the last scan.", "");
  lines.push(`Full report: https://80-20.dev/monitor?url=${encodeURIComponent(origin)}`);
  return lines.join("\n");
}

export default async function handler(req: Req, res: Res) {
  if (!authorized(req)) { res.status(401).json({ error: "Unauthorized." }); return; }
  const sql = await getSqlClient();
  if (!sql) { res.status(503).json({ error: "Monitoring requires Postgres." }); return; }
  try {
    await ensureScanTables(sql);
    const due = await monitorsDue(sql, 24 * 7, 15);
    const results: Array<Record<string, unknown>> = [];
    for (const m of due) {
      const parsed = parseTargetUrl(m.origin);
      if (!parsed.ok) { results.push({ origin: m.origin, skipped: parsed.error }); continue; }
      const grade = await runDeepGrade(parsed.url);
      if (!grade.ok) { results.push({ origin: m.origin, error: grade.error }); await markMonitorRun(sql, m.origin, m.last_scan_id ?? ""); continue; }
      const prevHistory = await scanHistory(sql, m.origin, 1);
      const prev = prevHistory[0] ?? null;
      const row = await recordScan(sql, grade, "monitor");
      await markMonitorRun(sql, m.origin, row.id);
      const diff = diffScans(prev ? { score: prev.score, findings: prev.findings } : null, { score: grade.score, findings: grade.findings });
      let mail: unknown = { skipped: "no recipient" };
      if (m.email) {
        mail = mailerConfigured()
          ? await sendMail({ to: m.email, subject: `Launch Audit: ${m.origin} scored ${grade.score}/100 (${diff.score_delta >= 0 ? "+" : ""}${diff.score_delta})`, text: diffEmail(m.origin, diff) })
          : { skipped: "SMTP not configured" };
      }
      results.push({ origin: m.origin, score: grade.score, delta: diff.score_delta, new: diff.new_findings.length, fixed: diff.fixed_findings.length, mail });
    }
    res.status(200).json({ ok: true, scanned: results.length, mailer: mailerConfigured() ? "configured" : "not configured", results });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Cron run failed." });
  }
}
