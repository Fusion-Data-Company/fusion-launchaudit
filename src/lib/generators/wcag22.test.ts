import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWcag22 } from "./wcag22.ts";
import { Counter, type AuditHints } from "./types.ts";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const crawl = {} as RuntimeCrawl;

test("emits three WCAG 2.2 cards: reflow, target size, focus order", () => {
  const cards = generateWcag22(null as RepoScan | null, crawl, {} as AuditHints, new Counter());
  assert.equal(cards.length, 3);
  const cats = cards.map((c) => c.category).sort();
  assert.deepEqual(cats, ["focus_order", "wcag22", "wcag22"]);
});

test("reflow card sets a 320px viewport then asserts no horizontal overflow", () => {
  const cards = generateWcag22(null, crawl, {} as AuditHints, new Counter());
  const reflow = cards.find((c) => c.title.includes("1.4.10"))!;
  const actions = reflow.exec.map((s) => s.action);
  assert.deepEqual(actions, ["set_viewport", "goto", "expect_no_horizontal_overflow"]);
  const vp = reflow.exec[0] as { width: number; height: number };
  assert.equal(vp.width, 320);
});

test("target-size card runs the wcag22 target_size measurement", () => {
  const cards = generateWcag22(null, crawl, {} as AuditHints, new Counter());
  const ts = cards.find((c) => c.title.includes("2.5.8"))!;
  const step = ts.exec.find((s) => s.action === "wcag22") as { action: string; check: string };
  assert.equal(step.check, "target_size");
  assert.equal(ts.category, "wcag22");
});

test("focus-order card is its own category (classified as a review question, not a hard bug)", () => {
  const cards = generateWcag22(null, crawl, {} as AuditHints, new Counter());
  const fo = cards.find((c) => c.category === "focus_order")!;
  const step = fo.exec.find((s) => s.action === "wcag22") as { action: string; check: string };
  assert.equal(step.check, "focus_order");
  assert.equal(fo.risk, "low");
});
