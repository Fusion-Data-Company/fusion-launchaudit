import { test } from "node:test";
import assert from "node:assert/strict";
import { rankLeaderboard, renderLeaderboard, type LeaderboardEntry } from "./benchmark.ts";

const entries: LeaderboardEntry[] = [
  { tool: "80/20 Launch Audit", measured: true, recall: 1.0, precision: 1.0, f1: 1.0 },
  { tool: "Scanner B", measured: true, recall: 0.6, precision: 0.9, f1: 0.72 },
  { tool: "ZAP baseline", measured: false, note: "run to populate" },
];

test("measured rows rank by F1 desc; unmeasured sort last", () => {
  const ranked = rankLeaderboard(entries);
  assert.deepEqual(ranked.map((e) => e.tool), ["80/20 Launch Audit", "Scanner B", "ZAP baseline"]);
});

test("the leaderboard renders percentages for measured rows and — for unmeasured", () => {
  const md = renderLeaderboard(entries);
  assert.ok(md.includes("| 1 | 80/20 Launch Audit | 100% | 100% | 1.000 |"));
  assert.ok(md.includes("| 2 | Scanner B | 60% | 90% | 0.720 |"));
  // The unmeasured competitor never gets a fabricated score.
  assert.ok(/ZAP baseline.*—.*—.*—/.test(md));
});

test("an unmeasured tool cannot leak a fake number even if fields are set to 0", () => {
  const md = renderLeaderboard([{ tool: "X", measured: false, recall: 0, precision: 0, f1: 0 }]);
  // measured:false → still shows — (we don't publish an unverified competitor score)
  assert.ok(md.includes("| — | X"));
  assert.ok(!md.includes("0%"));
});
