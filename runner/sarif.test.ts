import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSarif, renderSarif } from "./sarif.ts";
import type { ReportData } from "./render-report.ts";

function sampleData(overrides: Partial<ReportData> = {}): ReportData {
  return {
    name: "Sample",
    appUrl: "https://example.test",
    readiness: 72,
    passed: 8,
    failed: 2,
    blocked: 1,
    cards: [],
    findings: [
      { id: "TC-1", title: "Admin API reachable by anon", category: "roles_permissions", summary: "GET /api/admin returned 200 for an unauthenticated request.", severity: "high", fixPrompt: "Add a server-side role guard." },
      { id: "TC-2", title: "Missing HSTS", category: "tls_hsts", summary: "No Strict-Transport-Security header.", severity: "needs verification" },
      { id: "TC-3", title: "OSV lookup failed", category: "dependency_cve", summary: "Network error contacting OSV.", severity: "tooling" },
    ],
    generatedAt: "2026-07-09T00:00:00.000Z",
    ...overrides,
  };
}

test("SARIF has the required 2.1.0 envelope", () => {
  const s = buildSarif(sampleData());
  assert.equal(s.version, "2.1.0");
  assert.ok(String(s.$schema).includes("sarif-2.1.0"));
  assert.ok(Array.isArray(s.runs) && (s.runs as unknown[]).length === 1);
});

test("driver carries a name and one rule per distinct category", () => {
  const run = (buildSarif(sampleData()).runs as Array<Record<string, unknown>>)[0];
  const driver = (run.tool as Record<string, Record<string, unknown>>).driver;
  assert.equal(driver.name, "80/20 Launch Audit");
  const rules = driver.rules as Array<{ id: string }>;
  const ids = rules.map((r) => r.id).sort();
  assert.deepEqual(ids, ["dependency_cve", "roles_permissions", "tls_hsts"]);
});

test("severity maps to the fixed SARIF level enum without over-claiming", () => {
  const run = (buildSarif(sampleData()).runs as Array<Record<string, unknown>>)[0];
  const results = run.results as Array<{ ruleId: string; level: string }>;
  const byRule = Object.fromEntries(results.map((r) => [r.ruleId, r.level]));
  assert.equal(byRule["roles_permissions"], "error"); // confirmed high
  assert.equal(byRule["tls_hsts"], "warning"); // needs verification never becomes an error
  assert.equal(byRule["dependency_cve"], "note"); // tooling hiccup is only a note
});

test("every result has a location and a stable fingerprint (GitHub dedupe)", () => {
  const run = (buildSarif(sampleData()).runs as Array<Record<string, unknown>>)[0];
  const results = run.results as Array<Record<string, unknown>>;
  for (const r of results) {
    assert.ok(Array.isArray(r.locations) && (r.locations as unknown[]).length >= 1);
    const fp = r.partialFingerprints as Record<string, string>;
    assert.ok(fp.launchauditIdV1 && fp.launchauditIdV1.length === 32);
  }
});

test("fingerprints are deterministic across runs", () => {
  const a = renderSarif(sampleData());
  const b = renderSarif(sampleData());
  assert.equal(a, b);
});

test("renderSarif emits valid, parseable JSON", () => {
  const parsed = JSON.parse(renderSarif(sampleData()));
  assert.equal(parsed.version, "2.1.0");
});

test("a clean report yields zero results but still a valid tool driver", () => {
  const s = buildSarif(sampleData({ findings: [] }));
  const run = (s.runs as Array<Record<string, unknown>>)[0];
  assert.equal((run.results as unknown[]).length, 0);
  assert.ok(((run.tool as Record<string, Record<string, unknown>>).driver as Record<string, unknown>).name);
});
