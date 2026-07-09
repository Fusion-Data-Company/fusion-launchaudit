/**
 * Continuous regression mode — diff a run against a stored baseline and gate on
 * NEW findings only, so re-runs on a big legacy app aren't a wall of red. The
 * "clean-as-you-code" move: turn a one-shot audit into a per-PR guardrail.
 *
 * A finding is keyed by (category + title + normalized summary) so the same issue
 * across runs collapses to one identity — new bugs surface, resolved ones are
 * credited, unchanged ones are muted from the gate.
 */
import fs from "node:fs";
import { createHash } from "node:crypto";
import type { ReportData } from "./render-report.ts";
import { isConfirmedBug } from "./policy.ts";

export type BaselineFinding = { key: string; title: string; category?: string; severity: string };
export type Baseline = { appUrl: string; generatedAt: string; findings: BaselineFinding[] };

export type Diff = {
  newFindings: ReportData["findings"];
  resolved: BaselineFinding[];
  unchanged: ReportData["findings"];
};

// Stable identity for a finding across runs. Summary is normalized (whitespace +
// volatile digits collapsed) so a re-run with a slightly different number doesn't
// look like a brand-new bug.
export function findingKey(f: { title: string; category?: string; summary?: string }): string {
  const summary = (f.summary ?? "").toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
  return createHash("sha256").update(`${f.category ?? ""}::${f.title}::${summary}`).digest("hex").slice(0, 24);
}

/** Build a compact baseline snapshot from a report. */
export function toBaseline(data: ReportData): Baseline {
  return {
    appUrl: data.appUrl,
    generatedAt: data.generatedAt,
    findings: data.findings.map((f) => ({ key: findingKey(f), title: f.title, category: f.category, severity: f.severity })),
  };
}

/** Diff current findings against a baseline. */
export function diffFindings(baseline: Baseline, current: ReportData): Diff {
  const baseKeys = new Set(baseline.findings.map((f) => f.key));
  const currentByKey = new Map(current.findings.map((f) => [findingKey(f), f]));

  const newFindings = current.findings.filter((f) => !baseKeys.has(findingKey(f)));
  const unchanged = current.findings.filter((f) => baseKeys.has(findingKey(f)));
  const resolved = baseline.findings.filter((f) => !currentByKey.has(f.key));
  return { newFindings, resolved, unchanged };
}

/**
 * Regression gate: pass when there are no NEW confirmed product bugs vs the baseline.
 * Pre-existing bugs (already in the baseline) don't block the PR that didn't add them —
 * that's the whole point of clean-as-you-code.
 */
export function evaluateDiffGate(diff: Diff): { pass: boolean; newBugs: ReportData["findings"]; reason: string } {
  const newBugs = diff.newFindings.filter((f) => isConfirmedBug(f.severity));
  const pass = newBugs.length === 0;
  const reason = pass
    ? `no new confirmed issues vs baseline (${diff.resolved.length} resolved, ${diff.unchanged.length} pre-existing)`
    : `${newBugs.length} NEW confirmed issue${newBugs.length === 1 ? "" : "s"} introduced since the baseline`;
  return { pass, newBugs, reason };
}

export function readBaseline(path: string): Baseline | null {
  if (!fs.existsSync(path)) return null;
  const parsed = JSON.parse(fs.readFileSync(path, "utf8")) as Baseline;
  if (!parsed || !Array.isArray(parsed.findings)) throw new Error(`baseline at ${path} is malformed (no findings array)`);
  return parsed;
}

export function writeBaseline(path: string, data: ReportData): void {
  fs.writeFileSync(path, JSON.stringify(toBaseline(data), null, 2), "utf8");
}
