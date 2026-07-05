import { test } from "node:test";
import assert from "node:assert/strict";
import { runWatchdog } from "./watchdog.ts";
import type { RawResult, Verdict } from "./verdict.ts";

const prov = { executor: "http" as const, attempts: 1, startedAt: "t0", endedAt: "t1" };

function passVerdict(checkId: string, category = "roles_permissions"): Verdict {
  return {
    checkId, title: checkId, category, risk: "critical", status: "pass", confidence: "medium",
    reason: "held on first run", evidence: [{ kind: "http_transcript", summary: "200 blocked" }], provenance: prov,
  };
}
const rawPass = (checkId: string, category = "roles_permissions"): RawResult => ({
  checkId, title: checkId, category, risk: "critical", rawStatus: "pass", reason: "ok",
  evidence: [{ kind: "http_transcript", summary: "re-run 200" }], provenance: prov,
});
const rawFail = (checkId: string, category = "roles_permissions"): RawResult => ({
  checkId, title: checkId, category, risk: "critical", rawStatus: "fail", reason: "exposed", evidence: [], provenance: prov,
});

test("pass^k: a pass that reproduces every time is verified", async () => {
  const report = await runWatchdog([passVerdict("A")], async () => rawPass("A"), { k: 3 });
  assert.equal(report.k, 3);
  assert.equal(report.verifiedPasses, 1);
  assert.equal(report.downgraded.length, 0);
  assert.equal(report.intermittent.length, 0);
  assert.equal(report.verdicts[0].status, "pass");
  assert.equal(report.verdicts[0].watchdog?.verified, true);
});

test("pass^k: a pass that never reproduces is downgraded to needs_verification", async () => {
  const report = await runWatchdog([passVerdict("B")], async () => rawFail("B"), { k: 3 });
  assert.equal(report.verifiedPasses, 0);
  assert.equal(report.downgraded.length, 1);
  assert.equal(report.intermittent.length, 0);
  assert.equal(report.verdicts[0].status, "needs_verification");
});

test("pass^k: a pass that holds only SOME re-runs is flagged INTERMITTENT", async () => {
  // Reproduces on calls 1 and 3, fails on call 2 → 2/3.
  let n = 0;
  const report = await runWatchdog([passVerdict("C")], async () => (++n === 2 ? rawFail("C") : rawPass("C")), { k: 3 });
  assert.equal(report.verifiedPasses, 0, "not a clean pass");
  assert.equal(report.intermittent.length, 1);
  assert.deepEqual(
    { passes: report.intermittent[0].passes, runs: report.intermittent[0].runs, category: report.intermittent[0].category },
    { passes: 2, runs: 3, category: "roles_permissions" },
  );
  assert.equal(report.verdicts[0].status, "needs_verification");
  assert.equal(report.verdicts[0].confidence, "high");
  assert.match(report.verdicts[0].reason, /INTERMITTENT/);
});

test("k defaults to 1 (single re-run) when not specified — backward compatible", async () => {
  const report = await runWatchdog([passVerdict("D")], async () => rawPass("D"));
  assert.equal(report.k, 1);
  assert.equal(report.verifiedPasses, 1);
});

test("non-pass verdicts are evidence-audited, never re-run", async () => {
  let called = 0;
  const failing: Verdict = { ...passVerdict("E"), status: "fail", reason: "already failing" };
  const report = await runWatchdog([failing], async () => { called++; return rawPass("E"); }, { k: 3 });
  assert.equal(called, 0, "a failing verdict is not re-executed");
  assert.equal(report.verdicts[0].watchdog?.method, "evidence_audit");
});
