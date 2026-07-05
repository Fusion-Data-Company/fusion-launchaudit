import { test } from "node:test";
import assert from "node:assert/strict";
import { generateAccessibility } from "./accessibility.ts";
import { Counter } from "./types.ts";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const scan = null as unknown as RepoScan | null;
const crawl = {} as unknown as RuntimeCrawl;

test("accessibility: emits a single axe card categorized 'accessibility'", () => {
  const cards = generateAccessibility(scan, crawl, {}, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].category, "accessibility");
  assert.equal(cards[0].status, "ready");
});

test("accessibility: card runs axe with a serious impact floor on the home page", () => {
  const cards = generateAccessibility(scan, crawl, {}, new Counter());
  const goto = cards[0].exec.find((e) => (e as { action: string }).action === "goto") as { path: string };
  assert.equal(goto.path, "/");
  const axe = cards[0].exec.find((e) => (e as { action: string }).action === "axe") as { impactFloor: string };
  assert.equal(axe.impactFloor, "serious");
});
