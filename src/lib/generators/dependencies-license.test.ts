import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readDirectLicenses } from "./dependencies.ts";
import { classifyFailure } from "../../../runner/classify.ts";

function fixtureRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lic-"));
  const write = (name: string, pkg: unknown) => {
    fs.mkdirSync(path.join(dir, "node_modules", name), { recursive: true });
    fs.writeFileSync(path.join(dir, "node_modules", name, "package.json"), JSON.stringify(pkg));
  };
  write("gpllib", { name: "gpllib", license: "GPL-3.0-only" });
  write("agpllib", { name: "agpllib", license: { type: "AGPL-3.0" } });
  write("mitlib", { name: "mitlib", license: "MIT" });
  write("nolic", { name: "nolic" }); // no license field at all
  return dir;
}

test("readDirectLicenses flags copyleft + unknown, ignores permissive + uninstalled", () => {
  const dir = fixtureRepo();
  const hits = readDirectLicenses(dir, new Set(["gpllib", "agpllib", "mitlib", "nolic", "notinstalled"]));
  const by = Object.fromEntries(hits.map((h) => [h.name, h.kind]));
  assert.equal(by["gpllib"], "copyleft");
  assert.equal(by["agpllib"], "copyleft", "object-form license type detected");
  assert.equal(by["nolic"], "unknown");
  assert.ok(!("mitlib" in by), "MIT is permitted — not flagged");
  assert.ok(!("notinstalled" in by), "uninstalled dep is skipped, not guessed");
});

test("classify: a license-review finding is needs_verification, never a bug", () => {
  const ctx = { appUrl: "https://x", devStubAuth: false };
  const res = (error: string) => ({ card: { category: "dependency_license" }, error } as never);
  assert.equal(classifyFailure(res("2 direct dependencies need license review: 2 copyleft (gpllib: GPL-3.0-only, agpllib: AGPL-3.0)"), ctx).type, "needs_verification");
});
