import { test } from "node:test";
import assert from "node:assert/strict";
import { countBySeverity, diffScans, gateFreeGrade } from "./scan-store.ts";
import type { Finding, InstantGrade } from "./instant-grade.ts";

function f(severity: Finding["severity"], title: string, category = "Security headers"): Finding {
  return { severity, title, category, detail: "d", fix: "fix it" };
}

test("countBySeverity tallies each severity", () => {
  const c = countBySeverity([f("critical", "a"), f("high", "b"), f("high", "c"), f("low", "d")]);
  assert.deepEqual(c, { critical: 1, high: 2, medium: 0, low: 1 });
});

test("gateFreeGrade shows the top 5 and locks the rest with a severity breakdown", () => {
  const findings = [
    f("critical", "1"), f("high", "2"), f("high", "3"), f("medium", "4"), f("medium", "5"),
    f("low", "6"), f("low", "7"),
  ];
  const grade = { ok: true, url: "https://x", score: 40, band: "yellow", passed: 3, summary: "s", findings, note: "n" } as InstantGrade;
  const gated = gateFreeGrade(grade, "scan_1");
  assert.equal(gated.findings.length, 5);
  assert.equal(gated.locked.count, 2);
  assert.deepEqual(gated.locked.by_severity, { critical: 0, high: 0, medium: 0, low: 2 });
  assert.equal(gated.scan_id, "scan_1");
  assert.equal(gated.counts.critical, 1);
});

test("gateFreeGrade with <=5 findings locks nothing", () => {
  const findings = [f("high", "1"), f("low", "2")];
  const grade = { ok: true, url: "https://x", score: 84, band: "green", passed: 8, summary: "s", findings, note: "n" } as InstantGrade;
  const gated = gateFreeGrade(grade, "scan_2");
  assert.equal(gated.findings.length, 2);
  assert.equal(gated.locked.count, 0);
});

test("diffScans reports new, fixed, and score delta", () => {
  const prev = { score: 60, findings: [f("high", "A"), f("medium", "B")] };
  const next = { score: 72, findings: [f("high", "A"), f("low", "C")] };
  const d = diffScans(prev, next);
  assert.equal(d.score_delta, 12);
  assert.deepEqual(d.new_findings.map((x) => x.title), ["C"]);
  assert.deepEqual(d.fixed_findings.map((x) => x.title), ["B"]);
  assert.equal(d.unchanged, 1);
});

test("diffScans against no previous run treats everything as baseline (no delta)", () => {
  const d = diffScans(null, { score: 55, findings: [f("high", "A")] });
  assert.equal(d.score_delta, 0);
  assert.equal(d.new_findings.length, 1);
  assert.equal(d.fixed_findings.length, 0);
});
