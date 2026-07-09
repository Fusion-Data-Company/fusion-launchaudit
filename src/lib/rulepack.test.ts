import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseRulePack, compileRulePack, loadRulePacksFromDir } from "./rulepack.ts";
import { Counter } from "./generators/types.ts";

const VALID = {
  name: "acme",
  rules: [
    { id: "no-debug", title: "No X-Debug header", path: "/", method: "GET", expectHeaderAbsent: ["x-debug"] },
    { id: "health", title: "Health 200", path: "/api/health", expectStatusOneOf: [200], risk: "high" },
  ],
};

test("parseRulePack accepts a valid pack", () => {
  const p = parseRulePack(VALID, "acme.rulepack.json");
  assert.equal(p.name, "acme");
  assert.equal(p.rules.length, 2);
});

test("parseRulePack rejects malformed packs loudly", () => {
  assert.throws(() => parseRulePack({}, "x"), /name/);
  assert.throws(() => parseRulePack({ name: "x", rules: [] }, "x"), /non-empty "rules"/);
  assert.throws(() => parseRulePack({ name: "x", rules: [{ id: "a", title: "t", path: "no-slash", expectStatusOneOf: [200] }] }), /path/);
  assert.throws(() => parseRulePack({ name: "x", rules: [{ id: "a", title: "t", path: "/" }] }), /at least one assertion/);
  assert.throws(() => parseRulePack({ name: "x", rules: [{ id: "d", title: "t", path: "/", expectStatusOneOf: [200] }, { id: "d", title: "u", path: "/", expectStatusOneOf: [200] }] }), /duplicate/);
});

test("compileRulePack produces http cards with the declared matchers", () => {
  const cards = compileRulePack(parseRulePack(VALID), new Counter());
  assert.equal(cards.length, 2);
  assert.equal(cards[0].category, "custom_rule");
  assert.ok(cards[0].title.startsWith("[acme]"));
  const step = cards[0].exec[0] as { action: string; method: string; path: string; expectHeaderAbsent: string[] };
  assert.equal(step.action, "http");
  assert.equal(step.method, "GET");
  assert.deepEqual(step.expectHeaderAbsent, ["x-debug"]);
  // Risk carries through; default is medium.
  assert.equal(cards[0].risk, "medium");
  assert.equal(cards[1].risk, "high");
});

test("loadRulePacksFromDir loads valid packs and SKIPS malformed ones (fail-safe)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "la-rules-"));
  fs.writeFileSync(path.join(dir, "good.rulepack.json"), JSON.stringify(VALID));
  fs.writeFileSync(path.join(dir, "bad.rulepack.json"), "{ not valid json");
  fs.writeFileSync(path.join(dir, "ignored.json"), JSON.stringify(VALID)); // wrong extension
  const { packs, skipped } = loadRulePacksFromDir(dir);
  assert.equal(packs.length, 1);
  assert.equal(packs[0].name, "acme");
  assert.equal(skipped.length, 1);
  assert.ok(skipped[0].file === "bad.rulepack.json");
});

test("a missing rules dir yields no packs, no throw", () => {
  const { packs, skipped } = loadRulePacksFromDir("/does/not/exist");
  assert.equal(packs.length, 0);
  assert.equal(skipped.length, 0);
});

test("the shipped example rule pack is valid", () => {
  const file = path.join(process.cwd(), "docs", "examples", "house-rules.rulepack.json");
  if (!fs.existsSync(file)) return; // only assert when run from repo root
  const p = parseRulePack(JSON.parse(fs.readFileSync(file, "utf8")), "house-rules.rulepack.json");
  assert.ok(p.rules.length >= 1);
});
