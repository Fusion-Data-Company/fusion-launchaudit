/**
 * Calibration benchmark — the published precision/recall proof, runnable by anyone.
 *
 * Runs the FULL audit against both ground-truth fixtures, then computes and gates
 * precision/recall (src/lib/report/calibration.ts). Exits non-zero if recall or
 * precision drift below threshold — so the Truth-Protocol claim is EARNED on every CI
 * run, not asserted. Needs a browser (Playwright Chromium).
 *
 * Run:  npm run benchmark    (alias: node --experimental-strip-types scripts/calibrate.ts)
 */
import { spawn } from "node:child_process";
import http from "node:http";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { computeCalibration, gateCalibration, renderCalibrationTable } from "../src/lib/report/calibration.ts";

type Report = { readiness: number; findings: Array<{ category?: string; severity: string; title: string }> };

const REPO = process.cwd();
const AUDIT = path.join(REPO, "runner", "audit.ts");

// Ground truth: the categories that MUST be confirmed on buggy-shop.
const EXPECTED = ["roles_permissions", "object_authz", "mutation_authz", "api_contract", "responsive_visual", "security_headers"];

function waitForHttp(port: number, timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get({ host: "127.0.0.1", port, path: "/", timeout: 2000 }, (res) => { res.resume(); resolve(); });
      req.on("error", () => (Date.now() > deadline ? reject(new Error(`fixture :${port} never came up`)) : setTimeout(tick, 250)));
      req.on("timeout", () => { req.destroy(); Date.now() > deadline ? reject(new Error(`fixture :${port} timed out`)) : setTimeout(tick, 250); });
    };
    tick();
  });
}

function runAudit(port: number, repo: string, hints: string, out: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["--experimental-strip-types", AUDIT, "--name", "calibrate", "--app-url", `http://127.0.0.1:${port}`, "--repo", repo, "--hints", hints, "--out", out, "--no-open"],
      { stdio: ["ignore", "ignore", "inherit"], env: { ...process.env, LAUNCHAUDIT_NO_OPEN: "1", LAUNCHAUDIT_API_URL: "", BLOB_READ_WRITE_TOKEN: "" } });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`audit exited ${code}`))));
    child.on("error", reject);
  });
}

async function latestReport(outDir: string): Promise<Report> {
  const files = (await fsp.readdir(outDir)).filter((f) => /^launch-audit-.*\.json$/.test(f)).sort();
  const latest = files[files.length - 1];
  if (!latest) throw new Error(`no report in ${outDir}`);
  return JSON.parse(await fsp.readFile(path.join(outDir, latest), "utf8"));
}

const confirmed = (r: Report) => r.findings.filter((f) => {
  const s = f.severity.toLowerCase();
  return s !== "needs verification" && s !== "needs input" && s !== "blocked" && s !== "tooling";
});

async function audit(fixtureDir: string, port: number): Promise<Report> {
  const outDir = await fsp.mkdtemp(path.join(os.tmpdir(), "la-cal-"));
  const child = spawn("node", [path.join(REPO, fixtureDir, "server.js")], { stdio: "ignore", env: { ...process.env } });
  try {
    await waitForHttp(port);
    await runAudit(port, path.join(REPO, fixtureDir), path.join(REPO, fixtureDir, "launchaudit-hints.json"), outDir);
    return await latestReport(outDir);
  } finally {
    child.kill();
    await fsp.rm(outDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  console.log("Calibration benchmark — precision/recall vs ground truth\n");
  // The fixture servers bind hardcoded ports (buggy-shop :4400, shop-fixed :4401).
  const buggy = await audit("fixtures/buggy-shop", 4400);
  const fixed = await audit("fixtures/shop-fixed", 4401);

  const cal = computeCalibration({
    buggyCaught: [...new Set(confirmed(buggy).map((f) => f.category ?? "?"))],
    expected: EXPECTED,
    cleanFalsePositives: confirmed(fixed).map((f) => `${f.category}/${f.title}`),
  });

  console.log(renderCalibrationTable(cal));
  const gate = gateCalibration(cal);
  console.log("");
  if (!gate.pass) {
    console.error(`CALIBRATION FAILED:\n - ${gate.violations.join("\n - ")}`);
    process.exit(1);
  }
  console.log("CALIBRATION PASSED — recall 100%, precision 100% (0 false positives).");
}

main().catch((e) => { console.error("calibration crashed:", e instanceof Error ? e.message : e); process.exit(1); });
