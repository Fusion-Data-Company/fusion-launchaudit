import { test } from "node:test";
import assert from "node:assert/strict";
import { launchGate, type ReportData } from "./render-report.ts";

const base = (over: Partial<ReportData>): ReportData => ({
  name: "X", appUrl: "https://x", readiness: 90, passed: 9, failed: 0, blocked: 0,
  cards: [], findings: [], generatedAt: new Date().toISOString(), ...over,
});

test("launchGate PASS: no confirmed security bugs and readiness >= threshold", () => {
  const v = launchGate(base({ readiness: 85 }));
  assert.equal(v.pass, true);
});

test("launchGate FAIL: a confirmed security/authz product bug blocks regardless of score", () => {
  const v = launchGate(base({ readiness: 100, findings: [{ title: "open admin", category: "roles_permissions", summary: "x", severity: "critical" }] }));
  assert.equal(v.pass, false);
  assert.equal(v.blockers.length, 1);
});

test("launchGate: needs_verification items NEVER block (honest middle ground)", () => {
  const v = launchGate(base({ readiness: 85, findings: [{ title: "weak CSP", category: "security_headers", summary: "x", severity: "needs verification" }] }));
  assert.equal(v.pass, true);
  assert.equal(v.blockers.length, 0);
});

test("launchGate FAIL: readiness below threshold even with zero blockers", () => {
  const v = launchGate(base({ readiness: 70 }));
  assert.equal(v.pass, false);
  assert.match(v.reason, /below the 80/);
});

test("launchGate: a confirmed NON-security bug does not block the security gate", () => {
  const v = launchGate(base({ readiness: 85, findings: [{ title: "broken page", category: "core_workflow", summary: "x", severity: "high" }] }));
  assert.equal(v.pass, true);
});
