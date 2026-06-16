import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeAxeViolations, type AxeViolation } from "./axe-audit.ts";

const v = (id: string, impact: string, nodes = 1): AxeViolation => ({ id, impact, help: `${id} help`, nodes: Array(nodes).fill({}) });

test("no violations passes", () => {
  assert.doesNotThrow(() => summarizeAxeViolations([]));
});

test("minor/moderate violations are below the default 'serious' floor (no false alarm)", () => {
  assert.doesNotThrow(() => summarizeAxeViolations([v("color-x", "minor"), v("region", "moderate")]));
});

test("a serious violation fails and names the rule", () => {
  assert.throws(() => summarizeAxeViolations([v("label", "serious", 3)]), /label/);
});

test("a critical violation fails even when others are minor", () => {
  assert.throws(() => summarizeAxeViolations([v("color", "minor"), v("aria-required", "critical")]), /aria-required/);
});

test("raising the floor to 'critical' ignores serious violations", () => {
  assert.doesNotThrow(() => summarizeAxeViolations([v("label", "serious")], "critical"));
});
