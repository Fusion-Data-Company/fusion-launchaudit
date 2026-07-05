import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { collectImportedNames } from "./dependencies.ts";
import { summarizeOsv } from "../../../runner/execute-core.ts";
import { classifyFailure } from "../../../runner/classify.ts";

test("collectImportedNames finds imported direct deps, skips unimported + node_modules", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reach-"));
  fs.mkdirSync(path.join(dir, "src"));
  fs.writeFileSync(path.join(dir, "src", "a.ts"), `import _ from "lodash";\nconst x = require("axios/lib/foo");`);
  // a dep only referenced inside node_modules must NOT count as imported by the app
  fs.mkdirSync(path.join(dir, "node_modules", "pkg"), { recursive: true });
  fs.writeFileSync(path.join(dir, "node_modules", "pkg", "i.js"), `require("leftpad");`);
  const found = collectImportedNames(dir, new Set(["lodash", "axios", "leftpad"]));
  assert.ok(found.has("lodash"), "lodash imported");
  assert.ok(found.has("axios"), "axios subpath import counts");
  assert.ok(!found.has("leftpad"), "leftpad only in node_modules → not imported by app");
});

test("summarizeOsv marks imported hits and counts them", () => {
  const deps = [{ name: "lodash", version: "4.17.4" }, { name: "trans", version: "1.0.0" }];
  const resp = { results: [{ vulns: [{ id: "GHSA-x" }] }, { vulns: [{ id: "GHSA-y" }] }] };
  const { count, importedCount, lines } = summarizeOsv(deps, resp, new Set(["lodash"]), new Set(["lodash"]));
  assert.equal(count, 2);
  assert.equal(importedCount, 1);
  assert.ok(lines.some((l) => l.includes("lodash@4.17.4 [imported]")));
});

test("classify: imported advisory → product_bug; none-imported → needs_verification", () => {
  const ctx = { appUrl: "https://x", devStubAuth: false };
  const res = (error: string) => ({ card: { category: "dependency_cve" }, error } as never);
  assert.equal(classifyFailure(res("1 dependency version matches a known OSV/GHSA advisory (1 direct; 1 imported by your code): lodash@4.17.4 [imported]"), ctx).type, "product_bug");
  assert.equal(classifyFailure(res("1 dependency version matches a known OSV/GHSA advisory (0 direct; none imported by your code (transitive/unused — lower priority)): trans@1.0.0"), ctx).type, "needs_verification");
});
