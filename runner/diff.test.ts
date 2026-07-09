import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findingKey, toBaseline, diffFindings, evaluateDiffGate, readBaseline, writeBaseline } from "./diff.ts";
import type { ReportData } from "./render-report.ts";

function report(findings: ReportData["findings"]): ReportData {
  return { name: "x", appUrl: "https://ex.test", readiness: 80, passed: 5, failed: findings.length, blocked: 0, cards: [], findings, generatedAt: "2026-07-09T00:00:00.000Z" };
}

const F_ADMIN = { title: "Admin API anon", category: "roles_permissions", summary: "GET /api/admin returned 200 for anon", severity: "high" };
const F_SEO = { title: "Missing meta", category: "seo", summary: "no meta description", severity: "low" };
const F_IDOR = { title: "IDOR read", category: "object_authz", summary: "user B read user A object 1234", severity: "critical" };

test("findingKey is stable across volatile digits in the summary", () => {
  const a = findingKey({ title: "IDOR read", category: "object_authz", summary: "read object 1234" });
  const b = findingKey({ title: "IDOR read", category: "object_authz", summary: "read object 9999" });
  assert.equal(a, b); // digits normalized → same identity
});

test("diff surfaces exactly the newly introduced finding", () => {
  const baseline = toBaseline(report([F_ADMIN, F_SEO]));
  const current = report([F_ADMIN, F_SEO, F_IDOR]); // one new bug added
  const d = diffFindings(baseline, current);
  assert.equal(d.newFindings.length, 1);
  assert.equal(d.newFindings[0].title, "IDOR read");
  assert.equal(d.unchanged.length, 2);
  assert.equal(d.resolved.length, 0);
});

test("regression gate fails on a NEW confirmed bug, passes when nothing new", () => {
  const baseline = toBaseline(report([F_ADMIN]));
  const withNew = diffFindings(baseline, report([F_ADMIN, F_IDOR]));
  const noNew = diffFindings(baseline, report([F_ADMIN]));
  assert.equal(evaluateDiffGate(withNew).pass, false);
  assert.equal(evaluateDiffGate(noNew).pass, true);
});

test("a pre-existing bug does NOT block the PR that didn't add it", () => {
  const baseline = toBaseline(report([F_ADMIN, F_IDOR])); // both already there
  const current = report([F_ADMIN, F_IDOR]); // unchanged
  const gate = evaluateDiffGate(diffFindings(baseline, current));
  assert.equal(gate.pass, true);
  assert.ok(gate.reason.includes("pre-existing"));
});

test("a NEW needs-verification item does not fail the regression gate", () => {
  const baseline = toBaseline(report([F_ADMIN]));
  const current = report([F_ADMIN, { title: "HSTS?", category: "tls_hsts", summary: "unclear", severity: "needs verification" }]);
  assert.equal(evaluateDiffGate(diffFindings(baseline, current)).pass, true);
});

test("resolved findings are credited", () => {
  const baseline = toBaseline(report([F_ADMIN, F_IDOR]));
  const current = report([F_ADMIN]); // IDOR fixed
  const d = diffFindings(baseline, current);
  assert.equal(d.resolved.length, 1);
  assert.equal(d.resolved[0].title, "IDOR read");
});

test("baseline round-trips through disk", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "la-diff-"));
  const p = path.join(dir, "baseline.json");
  assert.equal(readBaseline(p), null); // absent
  writeBaseline(p, report([F_ADMIN, F_SEO]));
  const b = readBaseline(p);
  assert.ok(b);
  assert.equal(b!.findings.length, 2);
});
