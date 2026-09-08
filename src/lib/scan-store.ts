/**
 * scan-store — durable history for the free surface scan. It backs three things:
 *  1. the free-scan unlock gate (store the full scan, hand back only the top
 *     findings until an email is captured),
 *  2. weekly monitoring (re-scan a URL, diff against the last run, keep history),
 *  3. the /monitor page (score sparkline + latest findings, per URL).
 *
 * Everything degrades honestly: with no Postgres the API still grades and simply
 * returns the full result (no gate, no history) — it never pretends to persist.
 */
import type { SqlClient } from "./db.ts";
import { scansSchemaSql } from "./storage-contract.ts";
import type { Finding, InstantGrade, Sev } from "./instant-grade.ts";
import type { DeepGrade } from "./deep-grade.ts";

export type AnyGrade = InstantGrade | DeepGrade;
export type SevCounts = Record<Sev, number>;

export type ScanRow = {
  id: string;
  url: string;
  origin: string;
  score: number;
  band: string;
  passed: number;
  counts: SevCounts;
  findings: Finding[];
  source: string;
  created_at: string;
};

const FREE_FINDINGS = 5;

export function countBySeverity(findings: Finding[]): SevCounts {
  const c: SevCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) c[f.severity] = (c[f.severity] ?? 0) + 1;
  return c;
}

export function newScanId(): string {
  return "scan_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export async function ensureScanTables(sql: SqlClient): Promise<void> {
  for (const stmt of scansSchemaSql.split(";").map((s) => s.trim()).filter(Boolean)) await sql(stmt);
}

export async function recordScan(sql: SqlClient, grade: AnyGrade, source = "free"): Promise<ScanRow> {
  const id = newScanId();
  const counts = countBySeverity(grade.findings);
  await sql(
    `insert into scans (id, url, origin, score, band, passed, counts, findings, source)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)`,
    [id, grade.url, grade.url, grade.score, grade.band, grade.passed, JSON.stringify(counts), JSON.stringify(grade.findings), source],
  );
  return { id, url: grade.url, origin: grade.url, score: grade.score, band: grade.band, passed: grade.passed, counts, findings: grade.findings, source, created_at: new Date().toISOString() };
}

export async function getScan(sql: SqlClient, id: string): Promise<ScanRow | null> {
  const rows = await sql(`select * from scans where id = $1 limit 1`, [id]);
  return (rows[0] as ScanRow | undefined) ?? null;
}

export async function scanHistory(sql: SqlClient, origin: string, limit = 30): Promise<ScanRow[]> {
  const rows = await sql(`select * from scans where origin = $1 order by created_at desc limit $2`, [origin, limit]);
  return rows as ScanRow[];
}

/** Public projection for the free scan: top findings shown, the rest locked. */
export function gateFreeGrade(grade: AnyGrade, scanId: string | null) {
  const findings = grade.findings;
  const shown = findings.slice(0, FREE_FINDINGS);
  const rest = findings.slice(FREE_FINDINGS);
  return {
    ok: true as const,
    url: grade.url,
    score: grade.score,
    band: grade.band,
    passed: grade.passed,
    summary: grade.summary,
    note: grade.note,
    findings: shown,
    counts: countBySeverity(findings),
    locked: {
      count: rest.length,
      by_severity: countBySeverity(rest),
      categories: [...new Set(rest.map((f) => f.category))],
    },
    scan_id: scanId,
  };
}

/** A diff between two scans: which findings appeared, which cleared, score delta. */
export type ScanDiff = {
  score_from: number;
  score_to: number;
  score_delta: number;
  new_findings: Finding[];
  fixed_findings: Finding[];
  unchanged: number;
};

export function diffScans(prev: { score: number; findings: Finding[] } | null, next: { score: number; findings: Finding[] }): ScanDiff {
  const key = (f: Finding) => `${f.category}::${f.title}`;
  const prevKeys = new Set((prev?.findings ?? []).map(key));
  const nextKeys = new Set(next.findings.map(key));
  const newFindings = next.findings.filter((f) => !prevKeys.has(key(f)));
  const fixedFindings = (prev?.findings ?? []).filter((f) => !nextKeys.has(key(f)));
  const unchanged = next.findings.length - newFindings.length;
  return {
    score_from: prev?.score ?? next.score,
    score_to: next.score,
    score_delta: next.score - (prev?.score ?? next.score),
    new_findings: newFindings,
    fixed_findings: fixedFindings,
    unchanged,
  };
}

// ---- leads (unlock email capture) ------------------------------------------
export async function recordLead(sql: SqlClient, email: string, scanId: string | null, origin: string | null): Promise<void> {
  const id = "lead_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  await sql(`insert into scan_leads (id, email, scan_id, origin) values ($1, $2, $3, $4)`, [id, email, scanId, origin]);
}

// ---- monitors ---------------------------------------------------------------
export type MonitorRow = {
  id: string;
  origin: string;
  email: string | null;
  frequency: string;
  agency_name: string | null;
  logo_url: string | null;
  active: boolean;
  last_scan_id: string | null;
  last_run_at: string | null;
  created_at: string;
};

export async function upsertMonitor(
  sql: SqlClient,
  m: { origin: string; email?: string | null; agencyName?: string | null; logoUrl?: string | null },
): Promise<MonitorRow> {
  const id = "mon_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  await sql(
    `insert into monitors (id, origin, email, agency_name, logo_url)
     values ($1, $2, $3, $4, $5)
     on conflict (origin) do update set
       email = coalesce(excluded.email, monitors.email),
       agency_name = coalesce(excluded.agency_name, monitors.agency_name),
       logo_url = coalesce(excluded.logo_url, monitors.logo_url),
       active = true`,
    [id, m.origin, m.email ?? null, m.agencyName ?? null, m.logoUrl ?? null],
  );
  const rows = await sql(`select * from monitors where origin = $1 limit 1`, [m.origin]);
  return rows[0] as MonitorRow;
}

export async function getMonitor(sql: SqlClient, origin: string): Promise<MonitorRow | null> {
  const rows = await sql(`select * from monitors where origin = $1 limit 1`, [origin]);
  return (rows[0] as MonitorRow | undefined) ?? null;
}

/** Monitors due for a re-scan (active, never run or older than the interval). */
export async function monitorsDue(sql: SqlClient, olderThanHours = 24 * 7, limit = 25): Promise<MonitorRow[]> {
  const rows = await sql(
    `select * from monitors
     where active = true and (last_run_at is null or last_run_at < now() - ($1 || ' hours')::interval)
     order by last_run_at asc nulls first limit $2`,
    [String(olderThanHours), limit],
  );
  return rows as MonitorRow[];
}

export async function markMonitorRun(sql: SqlClient, origin: string, scanId: string): Promise<void> {
  await sql(`update monitors set last_scan_id = $2, last_run_at = now() where origin = $1`, [origin, scanId]);
}
