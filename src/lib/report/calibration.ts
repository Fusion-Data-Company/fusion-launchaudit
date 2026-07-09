/**
 * Precision/recall calibration — you don't get to ASSERT the Truth Protocol, you EARN
 * it, measurably, on every CI run. Against the two ground-truth fixtures:
 *   • recall    = of the planted-bug categories, how many did we catch (buggy-shop)?
 *   • precision = of everything we confirmed, how many were real (0 false positives on
 *                 the clean shop-fixed means precision 1.0)?
 * A drift below threshold fails the build, so recall/precision can't silently rot as we
 * add detector surface. Pure + deterministic; the benchmark script feeds it real runs.
 */

export type CalibrationInput = {
  /** Confirmed-bug categories the audit fired on the buggy fixture. */
  buggyCaught: string[];
  /** Ground-truth categories that MUST be caught on the buggy fixture. */
  expected: string[];
  /** Confirmed bugs on the CLEAN fixture — every one is a false positive. */
  cleanFalsePositives: string[];
};

export type CategoryResult = { category: string; caught: boolean };
export type Calibration = {
  perCategory: CategoryResult[];
  caught: number;
  expected: number;
  recall: number;
  falsePositives: number;
  precision: number;
  f1: number;
  missed: string[];
};

export function computeCalibration(input: CalibrationInput): Calibration {
  const caughtSet = new Set(input.buggyCaught);
  const perCategory = input.expected.map((category) => ({ category, caught: caughtSet.has(category) }));
  const caught = perCategory.filter((r) => r.caught).length;
  const expected = input.expected.length;
  const missed = perCategory.filter((r) => !r.caught).map((r) => r.category);
  const fp = input.cleanFalsePositives.length;

  const recall = expected === 0 ? 1 : caught / expected;
  // True positives = caught planted bugs; false positives = confirmed bugs on the clean app.
  const precision = caught + fp === 0 ? 1 : caught / (caught + fp);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { perCategory, caught, expected, recall, falsePositives: fp, precision, f1, missed };
}

export type CalibrationThresholds = { minRecall?: number; minPrecision?: number; maxFalsePositives?: number };

export type CalibrationGate = { pass: boolean; violations: string[] };

/** Gate the calibration. Defaults enforce the repo's standing claim: 100% recall, 0 FP. */
export function gateCalibration(cal: Calibration, thresholds: CalibrationThresholds = {}): CalibrationGate {
  const minRecall = thresholds.minRecall ?? 1.0;
  const minPrecision = thresholds.minPrecision ?? 1.0;
  const maxFalsePositives = thresholds.maxFalsePositives ?? 0;
  const violations: string[] = [];
  if (cal.recall < minRecall) violations.push(`recall ${cal.recall.toFixed(2)} < required ${minRecall.toFixed(2)} (missed: ${cal.missed.join(", ") || "—"})`);
  if (cal.precision < minPrecision) violations.push(`precision ${cal.precision.toFixed(2)} < required ${minPrecision.toFixed(2)}`);
  if (cal.falsePositives > maxFalsePositives) violations.push(`${cal.falsePositives} false positive(s) > allowed ${maxFalsePositives}`);
  return { pass: violations.length === 0, violations };
}

/** Render a compact, human-readable calibration table for the CI log / README. */
export function renderCalibrationTable(cal: Calibration): string {
  const rows = cal.perCategory.map((r) => `  ${r.caught ? "✓" : "✗"} ${r.category}`);
  return [
    `Recall:    ${(cal.recall * 100).toFixed(0)}%  (${cal.caught}/${cal.expected} planted-bug categories caught)`,
    `Precision: ${(cal.precision * 100).toFixed(0)}%  (${cal.falsePositives} false positive(s) on the clean fixture)`,
    `F1:        ${cal.f1.toFixed(3)}`,
    ...rows,
  ].join("\n");
}
