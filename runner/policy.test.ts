import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { evaluatePolicy, normalizePolicy, loadPolicy, defaultPolicy, isConfirmedBug } from "./policy.ts";
import type { ReportData } from "./render-report.ts";

// A buggy report: 2 confirmed authz bugs + 1 seo bug + 1 needs-verification (not a bug).
function buggy(): ReportData {
  return {
    name: "buggy", appUrl: "https://ex.test", readiness: 62, passed: 6, failed: 3, blocked: 0, cards: [],
    findings: [
      { title: "Admin API anon", category: "roles_permissions", summary: "200 for anon", severity: "high" },
      { title: "IDOR read", category: "object_authz", summary: "read another user", severity: "critical" },
      { title: "Missing meta description", category: "seo", summary: "no meta", severity: "low" },
      { title: "HSTS?", category: "tls_hsts", summary: "unclear", severity: "needs verification" },
    ],
    generatedAt: "2026-07-09T00:00:00.000Z",
  };
}

// A clean report: no confirmed bugs, high readiness.
function fixed(): ReportData {
  return { ...buggy(), readiness: 96, findings: [{ title: "HSTS?", category: "tls_hsts", summary: "unclear", severity: "needs verification" }] };
}

test("default policy passes a clean report, fails a low-readiness one", () => {
  assert.equal(evaluatePolicy(fixed(), defaultPolicy()).pass, true);
  assert.equal(evaluatePolicy(buggy(), defaultPolicy()).pass, false); // readiness 62 < 80
});

test("a strict budget flips buggy→fail and fixed→pass deterministically", () => {
  const strict = normalizePolicy({ readinessMin: 85, maxProductBugs: 0 });
  const b = evaluatePolicy(buggy(), strict);
  const f = evaluatePolicy(fixed(), strict);
  assert.equal(b.pass, false);
  assert.equal(f.pass, true);
  assert.ok(b.violations.some((v) => v.includes("confirmed product bugs")));
});

test("needs-verification never counts against a budget", () => {
  // fixed() has only a needs-verification finding; even maxProductBugs:0 must pass.
  const p = normalizePolicy({ readinessMin: 0, maxProductBugs: 0 });
  assert.equal(evaluatePolicy(fixed(), p).pass, true);
  assert.equal(isConfirmedBug("needs verification"), false);
  assert.equal(isConfirmedBug("high"), true);
});

test("per-category budget catches an over-budget category", () => {
  const p = normalizePolicy({ readinessMin: 0, maxByCategory: { seo: 0 } });
  const r = evaluatePolicy(buggy(), p);
  assert.equal(r.pass, false);
  assert.ok(r.violations.some((v) => v.includes('"seo"')));
});

test("failOnAnyIn is a hard stop for the named categories", () => {
  const p = normalizePolicy({ readinessMin: 0, failOnAnyIn: ["object_authz"] });
  const r = evaluatePolicy(buggy(), p);
  assert.equal(r.pass, false);
  assert.ok(r.violations.some((v) => v.includes("hard-stop")));
  // The same policy passes the fixed report (no confirmed authz bug).
  assert.equal(evaluatePolicy(fixed(), p).pass, true);
});

test("malformed config throws loudly; absent config yields the default", () => {
  assert.throws(() => normalizePolicy({ readinessMin: 150 }), /0–100/);
  assert.throws(() => normalizePolicy({ maxByCategory: { seo: -1 } }), /≥ 0/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "la-policy-"));
  const { policy, source } = loadPolicy(undefined, dir); // no file present
  assert.equal(source, "default");
  assert.deepEqual(policy, defaultPolicy());
});

test("loadPolicy reads a real config file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "la-policy-"));
  fs.writeFileSync(path.join(dir, "launchaudit.config.json"), JSON.stringify({ readinessMin: 90, maxProductBugs: 0 }));
  const { policy, source } = loadPolicy(undefined, dir);
  assert.equal(policy.readinessMin, 90);
  assert.ok(source.endsWith("launchaudit.config.json"));
});
