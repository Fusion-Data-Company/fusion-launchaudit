/**
 * Fixture gate — the mechanical proof of catch-rate + precision that CI enforces.
 *
 * Runs the FULL audit against both ground-truth fixtures and asserts:
 *   buggy-shop  → catches all 5 planted bug classes AND the Launch Gate FAILS.
 *   shop-fixed  → scores 100/100, zero confirmed product bugs (no false positives),
 *                 AND the Launch Gate PASSES.
 *
 * Exits non-zero on any miss, so a detector regression (recall drop or a new false
 * positive) fails the build instead of shipping green. Needs a browser (Playwright
 * Chromium) — the audit drives a real Chromium + HTTP.
 *
 * Run:  node --experimental-strip-types scripts/test-fixtures.ts
 */
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";

type Report = {
  readiness: number;
  findings: Array<{ category?: string; severity: string; title: string }>;
  launch_gate?: { pass: boolean; coverageGaps?: string[]; reason?: string };
};

const REPO = process.cwd();
const AUDIT = path.join(REPO, "runner", "audit.ts");

// The 5 planted bugs, expressed as the detector categories that MUST fire on buggy-shop.
// bug#1 RBAC direct-URL → roles_permissions + object_authz; bug#2 admin API → mutation_authz;
// bug#3 orders 500 → api_contract; bug#4 overflow → responsive_visual; bug#5 headers → security_headers.
const REQUIRED_BUG_CATEGORIES = [
  "roles_permissions", "object_authz", "mutation_authz", "api_contract", "responsive_visual", "security_headers",
];

function waitForHttp(port: number, timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get({ host: "127.0.0.1", port, path: "/", timeout: 2000 }, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) reject(new Error(`fixture on :${port} never came up`));
        else setTimeout(tick, 250);
      });
      req.on("timeout", () => { req.destroy(); if (Date.now() > deadline) reject(new Error(`fixture on :${port} timed out`)); else setTimeout(tick, 250); });
    };
    tick();
  });
}

function startServer(file: string, port: number) {
  const child = spawn("node", [file], { stdio: "ignore", env: { ...process.env } });
  return { child, ready: waitForHttp(port) };
}

function runAudit(args: { name: string; port: number; repo: string; hints: string; out: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [
      "--experimental-strip-types", AUDIT,
      "--name", args.name,
      "--app-url", `http://127.0.0.1:${args.port}`,
      "--repo", args.repo,
      "--hints", args.hints,
      "--out", args.out,
      "--no-open",
    ], { stdio: ["ignore", "ignore", "inherit"], env: { ...process.env, LAUNCHAUDIT_NO_OPEN: "1", LAUNCHAUDIT_API_URL: "", BLOB_READ_WRITE_TOKEN: "" } });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`audit exited ${code}`))));
    child.on("error", reject);
  });
}

async function latestReport(outDir: string): Promise<Report> {
  const files = (await fsp.readdir(outDir)).filter((f) => /^launch-audit-.*\.json$/.test(f)).sort();
  const latest = files[files.length - 1];
  if (!latest) throw new Error(`no report written to ${outDir}`);
  return JSON.parse(await fsp.readFile(path.join(outDir, latest), "utf8"));
}

const confirmedBugs = (r: Report) => r.findings.filter((f) => {
  const s = f.severity.toLowerCase();
  return s !== "needs verification" && s !== "needs input" && s !== "blocked" && s !== "tooling";
});

const failures: string[] = [];
function check(cond: boolean, pass: string, fail: string) {
  if (cond) console.log(`  ✓ ${pass}`);
  else { console.log(`  ✗ ${fail}`); failures.push(fail); }
}

async function audit(fixtureDir: string, port: number, name: string): Promise<Report> {
  const outDir = await fsp.mkdtemp(path.join(os.tmpdir(), "la-fixture-"));
  const { child, ready } = startServer(path.join(REPO, fixtureDir, "server.js"), port);
  try {
    await ready;
    await runAudit({ name, port, repo: path.join(REPO, fixtureDir), hints: path.join(REPO, fixtureDir, "launchaudit-hints.json"), out: outDir });
    return await latestReport(outDir);
  } finally {
    child.kill();
    await fsp.rm(outDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  console.log("Fixture gate — proving catch-rate + precision against ground truth\n");

  console.log("buggy-shop (must catch all 5 planted bugs; gate must FAIL):");
  const buggy = await audit("fixtures/buggy-shop", 4400, "fixture-gate buggy-shop");
  const caught = new Set(confirmedBugs(buggy).map((f) => f.category));
  for (const cat of REQUIRED_BUG_CATEGORIES) {
    check(caught.has(cat), `caught ${cat}`, `MISSED a planted bug: no confirmed finding in category "${cat}" (recall regression)`);
  }
  check(buggy.launch_gate?.pass === false, "Launch Gate correctly FAILS a buggy app", "Launch Gate PASSED a buggy app (should fail)");

  console.log("\nshop-fixed (must score 100/100, zero false positives; gate must PASS):");
  const fixed = await audit("fixtures/shop-fixed", 4401, "fixture-gate shop-fixed");
  const fps = confirmedBugs(fixed);
  check(fixed.readiness === 100, `readiness is 100/100`, `readiness is ${fixed.readiness}/100, expected 100 (a runnable check regressed)`);
  check(fps.length === 0, "zero false positives on the clean app", `${fps.length} false positive(s) on the clean app: ${fps.map((f) => f.category + "/" + f.title).join("; ")}`);
  check(fixed.launch_gate?.pass === true, "Launch Gate correctly PASSES a clean app", "Launch Gate FAILED a clean app (false negative on readiness)");

  console.log("");
  if (failures.length) {
    console.error(`FIXTURE GATE FAILED — ${failures.length} assertion(s) did not hold.`);
    process.exit(1);
  }
  console.log("FIXTURE GATE PASSED — recall 5/5 on buggy-shop, 100/100 + 0 false positives on shop-fixed.");
}

main().catch((e) => { console.error("fixture gate crashed:", e instanceof Error ? e.message : e); process.exit(1); });
