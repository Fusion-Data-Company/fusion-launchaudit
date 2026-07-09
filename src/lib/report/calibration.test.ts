import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCalibration, gateCalibration, renderCalibrationTable } from "./calibration.ts";

const EXPECTED = ["roles_permissions", "object_authz", "mutation_authz", "api_contract", "responsive_visual", "security_headers"];

test("perfect run → 100% recall, 100% precision, F1 = 1, gate passes", () => {
  const cal = computeCalibration({ buggyCaught: EXPECTED, expected: EXPECTED, cleanFalsePositives: [] });
  assert.equal(cal.recall, 1);
  assert.equal(cal.precision, 1);
  assert.equal(cal.f1, 1);
  assert.equal(gateCalibration(cal).pass, true);
});

test("a missed category drops recall below 1 and fails the default gate", () => {
  const cal = computeCalibration({ buggyCaught: EXPECTED.slice(1), expected: EXPECTED, cleanFalsePositives: [] });
  assert.ok(cal.recall < 1);
  assert.deepEqual(cal.missed, ["roles_permissions"]);
  const g = gateCalibration(cal);
  assert.equal(g.pass, false);
  assert.ok(g.violations.some((v) => v.includes("recall")));
});

test("a false positive on the clean fixture drops precision and fails the gate", () => {
  const cal = computeCalibration({ buggyCaught: EXPECTED, expected: EXPECTED, cleanFalsePositives: ["seo"] });
  assert.ok(cal.precision < 1);
  assert.equal(cal.falsePositives, 1);
  const g = gateCalibration(cal);
  assert.equal(g.pass, false);
  assert.ok(g.violations.some((v) => v.includes("false positive")));
});

test("thresholds can be relaxed (e.g. allow one FP)", () => {
  const cal = computeCalibration({ buggyCaught: EXPECTED, expected: EXPECTED, cleanFalsePositives: ["seo"] });
  assert.equal(gateCalibration(cal, { maxFalsePositives: 1, minPrecision: 0 }).pass, true);
});

test("precision/recall math is correct on a mixed case", () => {
  // caught 4 of 6, plus 1 false positive → recall 4/6, precision 4/(4+1)=0.8
  const cal = computeCalibration({ buggyCaught: EXPECTED.slice(0, 4), expected: EXPECTED, cleanFalsePositives: ["x"] });
  assert.equal(cal.caught, 4);
  assert.equal(cal.recall.toFixed(2), (4 / 6).toFixed(2));
  assert.equal(cal.precision, 0.8);
});

test("the table renders recall/precision + a per-category checklist", () => {
  const cal = computeCalibration({ buggyCaught: EXPECTED.slice(0, 5), expected: EXPECTED, cleanFalsePositives: [] });
  const table = renderCalibrationTable(cal);
  assert.ok(table.includes("Recall:"));
  assert.ok(table.includes("Precision:"));
  assert.ok(table.includes("✗ security_headers")); // the one not caught
});
