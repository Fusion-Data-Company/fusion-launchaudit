import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFixPlan, loopInstruction, type PlanFinding } from "./fix-plan.ts";

const findings: PlanFinding[] = [
  { id: "TC-2", title: "Missing HSTS", category: "tls_hsts", severity: "medium", summary: "no HSTS", fixPrompt: "Add HSTS", repro: "curl -I ..." },
  { id: "TC-1", title: "IDOR", category: "object_authz", severity: "critical", summary: "cross-user read", fixPrompt: "Check ownership", repro: "curl ..." },
  { id: "TC-3", title: "HSTS?", category: "tls_hsts", severity: "needs verification", summary: "unclear" },
  { id: "TC-4", title: "OSV net", category: "dependency_cve", severity: "tooling", summary: "net error" },
];

test("plan includes only actionable confirmed bugs, ordered by severity", () => {
  const plan = buildFixPlan(findings);
  assert.deepEqual(plan.map((s) => s.id), ["TC-1", "TC-2"]); // critical before medium; verify/tooling excluded
  assert.equal(plan[0].order, 1);
  assert.equal(plan[0].severity, "critical");
});

test("each step carries fix, repro, and a targeted verify command", () => {
  const plan = buildFixPlan(findings, "npx launchaudit --reverify");
  const idor = plan[0];
  assert.equal(idor.fix, "Check ownership");
  assert.ok(idor.repro.startsWith("curl"));
  assert.ok(idor.verify.includes("--reverify"));
  assert.ok(idor.verify.includes("TC-1"));
});

test("a finding without a fixPrompt/repro still yields a usable step (no undefineds)", () => {
  const plan = buildFixPlan([{ title: "X", category: "cors", severity: "high", summary: "bad cors" }]);
  assert.equal(plan.length, 1);
  assert.ok(plan[0].fix.length > 0);
  assert.ok(plan[0].repro.length > 0);
  assert.ok(plan[0].id.length > 0);
});

test("loopInstruction reflects the step count, and is graceful when clean", () => {
  assert.ok(loopInstruction(buildFixPlan(findings)).includes("2 step"));
  assert.ok(loopInstruction([]).includes("already green"));
});
