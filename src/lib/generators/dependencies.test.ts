import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseNpmLock, generateDependencies } from "./dependencies.ts";
import { summarizeOsv } from "../../../runner/execute-core.ts";
import { classifyFailure } from "../../../runner/classify.ts";
import { Counter } from "./types.ts";

// minimal scan/crawl stand-ins (types are stripped at runtime)
const crawl = {} as never;
const scanWith = (repoPath?: string) => (repoPath ? ({ detail: { repo_path: repoPath } } as never) : null);

test("parseNpmLock reads v2/v3 `packages` and flags direct vs transitive", () => {
  const lock = {
    packages: {
      "": { name: "app" },
      "node_modules/lodash": { version: "4.17.4" },
      "node_modules/lodash/node_modules/nested": { version: "1.0.0" },
    },
  };
  const deps = parseNpmLock(lock, new Set(["lodash"]));
  const lodash = deps.find((d) => d.name === "lodash");
  const nested = deps.find((d) => d.name === "nested");
  assert.ok(lodash && lodash.version === "4.17.4" && lodash.direct === true);
  assert.ok(nested && nested.version === "1.0.0" && nested.direct === false);
});

test("parseNpmLock falls back to legacy v1 `dependencies` (nested)", () => {
  const lock = { dependencies: { lodash: { version: "4.17.4", dependencies: { sub: { version: "2.0.0" } } } } };
  const deps = parseNpmLock(lock, new Set());
  assert.equal(deps.length, 2);
  assert.ok(deps.some((d) => d.name === "sub" && d.version === "2.0.0"));
});

test("generateDependencies → blocked with no repo and with an empty repo", () => {
  assert.equal(generateDependencies(null, crawl, {}, new Counter())[0].status, "blocked");
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "depcve-"));
  assert.equal(generateDependencies(scanWith(empty), crawl, {}, new Counter())[0].status, "blocked");
});

test("generateDependencies → ready card carrying a dep_cve_audit exec step", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "depcve-"));
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ dependencies: { lodash: "^4.17.4" } }));
  fs.writeFileSync(path.join(dir, "package-lock.json"), JSON.stringify({ packages: { "": {}, "node_modules/lodash": { version: "4.17.4" } } }));
  const cards = generateDependencies(scanWith(dir), crawl, {}, new Counter());
  assert.equal(cards[0].status, "ready");
  assert.equal(cards[0].category, "dependency_cve");
  const step = cards[0].exec[0] as { action: string; deps: Array<{ name: string; version: string }>; direct: string[] };
  assert.equal(step.action, "dep_cve_audit");
  assert.ok(step.deps.some((d) => d.name === "lodash" && d.version === "4.17.4"));
  assert.ok(step.direct.includes("lodash"));
});

test("summarizeOsv flags vulnerable packages, direct first", () => {
  const deps = [{ name: "safe", version: "1.0.0" }, { name: "lodash", version: "4.17.4" }];
  const resp = { results: [{}, { vulns: [{ id: "GHSA-x" }, { id: "GHSA-y" }] }] };
  const { count, directCount, lines } = summarizeOsv(deps, resp, new Set(["lodash"]));
  assert.equal(count, 1);
  assert.equal(directCount, 1);
  assert.ok(lines[0].includes("lodash@4.17.4") && lines[0].includes("GHSA-x"));
});

test("summarizeOsv returns zero when no results carry vulns", () => {
  const { count } = summarizeOsv([{ name: "a", version: "1" }], { results: [{}] }, new Set());
  assert.equal(count, 0);
});

test("classify: dependency_cve advisory → product_bug; OSV failure → test_bug", () => {
  const ctx = { appUrl: "https://x", devStubAuth: false };
  const res = (error: string) => ({ card: { category: "dependency_cve" }, error } as never);
  assert.equal(classifyFailure(res("2 dependency versions match a known OSV/GHSA advisory (1 direct): lodash@4.17.4"), ctx).type, "product_bug");
  assert.equal(classifyFailure(res("OSV query failed (HTTP 500) — could not check dependencies"), ctx).type, "test_bug");
});
