import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scanCodeSmells, generateCodeSmells } from "./code-smells.ts";
import { classifyFailure } from "../../../runner/classify.ts";
import { Counter } from "./types.ts";

test("scanCodeSmells finds dynamic-code + HTML-injection sinks, skips node_modules", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "smell-"));
  fs.mkdirSync(path.join(dir, "src"));
  fs.writeFileSync(path.join(dir, "src", "a.ts"), [
    "const r = eval(userInput);",
    'const f = new Function("return 1");',
    "execSync(`ls ${dir}`);",
    "el.dangerouslySetInnerHTML = { __html: x };",
    "node.innerHTML = data;",
    'const safe = "this is fine";',
  ].join("\n"));
  fs.mkdirSync(path.join(dir, "node_modules", "evil"), { recursive: true });
  fs.writeFileSync(path.join(dir, "node_modules", "evil", "x.js"), "eval(bad);");

  const hits = scanCodeSmells(dir);
  const cwes = new Set(hits.map((h) => h.cwe));
  assert.ok(cwes.has("CWE-95"), "eval/new Function");
  assert.ok(cwes.has("CWE-78"), "interpolated child_process");
  assert.ok(cwes.has("CWE-79"), "innerHTML/dangerouslySetInnerHTML");
  assert.ok(hits.every((h) => !h.file.includes("node_modules")), "node_modules skipped");
  assert.ok(hits.every((h) => h.line >= 1), "hits carry line numbers");
});

test("generateCodeSmells returns [] without a repo (runtime-only audit)", () => {
  assert.deepEqual(generateCodeSmells(null, {} as never, {}, new Counter()), []);
});

test("classify: a code sink is needs_verification (grep smell, not a proven exploit)", () => {
  const ctx = { appUrl: "https://x", devStubAuth: false };
  const res = { card: { category: "code_smell" }, error: "2 dangerous code sinks to review: eval() on a dynamic value (CWE-95) at src/a.ts:1" } as never;
  assert.equal(classifyFailure(res, ctx).type, "needs_verification");
});
