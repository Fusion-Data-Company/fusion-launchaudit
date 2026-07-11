/**
 * Elite-wedge proof — the moment you SEE it work. Runs the REAL generator → executor →
 * classify path against the realistic `fixtures/vuln-saas` app and proves LaunchAudit
 * catches the MODERN bug classes the happy-path AI and most scanners miss: cross-user data
 * breach (BOLA), secret-field exposure, privilege escalation, function-level authz,
 * coupon double-spend (TOCTOU), AI prompt injection, and a malicious dependency.
 *
 * Deterministic (direct session cookies, no browser login) so it proves end-to-end here AND
 * in CI. Exits non-zero if any planted bug is missed.
 *
 * Run:  npm run proof:elite
 */
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { generateObjectAuthz } from "../src/lib/generators/object-authz.ts";
import { generateDataExposure } from "../src/lib/generators/data-exposure.ts";
import { generateMassAssignment } from "../src/lib/generators/mass-assignment.ts";
import { generateMutationAuthz } from "../src/lib/generators/mutation-authz.ts";
import { generateRaceCondition } from "../src/lib/generators/race-condition.ts";
import { generateAiRedteam } from "../src/lib/generators/ai-redteam.ts";
import { generateSupplyChain } from "../src/lib/generators/supply-chain.ts";
import { generateTwoIdentity } from "../src/lib/generators/two-identity.ts";
import { Counter, type AuditHints } from "../src/lib/generators/types.ts";
import { executeNoBrowserCards } from "../src/lib/../../runner/execute-core.ts";
import { classifyFailure } from "../src/lib/../../runner/classify.ts";
import type { RepoScan } from "../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../runner/crawler.ts";

const REPO = process.cwd();
const FIXTURE = path.join(REPO, "fixtures", "vuln-saas");
const PORT = 4700;
const APP = `http://127.0.0.1:${PORT}`;

function waitForHttp(port: number, timeoutMs = 12000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get({ host: "127.0.0.1", port, path: "/", timeout: 2000 }, (r) => { r.resume(); resolve(); });
      req.on("error", () => (Date.now() > deadline ? reject(new Error(`vuln-saas :${port} never came up`)) : setTimeout(tick, 200)));
      req.on("timeout", () => { req.destroy(); Date.now() > deadline ? reject(new Error("timeout")) : setTimeout(tick, 200); });
    };
    tick();
  });
}

// Hints with DIRECT session cookies (deterministic; the app trusts session=<user>).
const hints: AuditHints = {
  loginPath: "/login",
  roles: { admin: { cookie: "session=admin" }, user: { cookie: "session=bob" } },
  protectedRoutes: ["/admin", "/api/orders/2"],
  protectedApis: [{ path: "/api/orders/2", method: "GET" }, { path: "/api/admin/delete-user", method: "POST" }],
  postEndpoints: [{ path: "/api/profile" }, { path: "/api/coupon/redeem" }, { path: "/api/admin/delete-user" }],
  writeApis: [{ path: "/api/profile", method: "POST" }, { path: "/api/coupon/redeem", method: "POST" }, { path: "/api/admin/delete-user", method: "POST" }],
  aiEndpoints: [{ path: "/api/chat", promptField: "message", replyPath: "reply", cookie: "session=bob" }],
};

const scan = { detail: { repo_path: FIXTURE, routes: [] } } as unknown as RepoScan;
const crawl = {} as RuntimeCrawl;

// Each planted bug → the generator that must catch it, and the categories that prove the catch.
const CASES: Array<{ label: string; gen: () => ReturnType<typeof generateObjectAuthz>; catch_: string[] }> = [
  { label: "Cross-user data breach (BOLA/IDOR): Bob reads Alice's order by id", gen: () => generateObjectAuthz(scan, crawl, hints, new Counter()), catch_: ["object_authz"] },
  { label: "Excessive data exposure: passwordHash / ssn / card_number in the API response", gen: () => generateDataExposure(scan, crawl, hints, new Counter()), catch_: ["data_exposure"] },
  { label: "Privilege escalation via mass-assignment (role:admin accepted)", gen: () => generateMassAssignment(scan, crawl, hints, new Counter()), catch_: ["mass_assignment"] },
  { label: "Broken function-level authz: a normal user deletes users", gen: () => generateMutationAuthz(scan, crawl, hints, new Counter()), catch_: ["mutation_authz"] },
  { label: "Coupon double-spend (TOCTOU race): 8/8 concurrent redeems succeed", gen: () => generateRaceCondition(scan, crawl, hints, new Counter()), catch_: ["race_condition"] },
  { label: "AI prompt injection + unsafe output on /api/chat", gen: () => generateAiRedteam(scan, crawl, hints, new Counter()), catch_: ["ai_security"] },
  { label: "Malicious dependency: postinstall curl|sh + a typosquat", gen: () => generateSupplyChain(scan, crawl, hints, new Counter()), catch_: ["supply_chain"] },
  { label: "Broken privilege gradient: /admin served to a normal user", gen: () => generateTwoIdentity(scan, crawl, hints, new Counter()), catch_: ["privilege_gradient"] },
];

async function main() {
  console.log("Elite-wedge proof — catching the MODERN bugs the happy path misses\n");
  const child = spawn("node", [path.join(FIXTURE, "server.js")], { stdio: "ignore", env: { ...process.env } });
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "la-elite-"));
  const missed: string[] = [];
  try {
    await waitForHttp(PORT);
    for (const c of CASES) {
      const cards = c.gen().filter((card) => card.status !== "blocked");
      if (cards.length === 0) { missed.push(`${c.label} — generator produced no runnable card`); console.log(`  ✗ ${c.label}`); continue; }
      const results = await executeNoBrowserCards(cards as never, { appUrl: APP, artifactDir: outDir });
      const caughtCats = new Set<string>();
      for (const r of results) {
        if (r.status !== "failed") continue;
        const cls = classifyFailure(r, { appUrl: APP, devStubAuth: false });
        // A catch = a confirmed bug OR an honest needs_verification signal (race/AI are probabilistic).
        if (cls.type === "product_bug" || cls.type === "needs_verification") caughtCats.add(r.card.category);
      }
      const ok = c.catch_.every((cat) => caughtCats.has(cat));
      console.log(`  ${ok ? "✓ CAUGHT" : "✗ MISSED"}  ${c.label}`);
      if (!ok) missed.push(c.label);
    }
  } finally {
    child.kill();
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  console.log("");
  if (missed.length) {
    console.error(`ELITE PROOF FAILED — ${missed.length} planted bug(s) not caught:\n - ${missed.join("\n - ")}`);
    process.exit(1);
  }
  console.log(`ELITE PROOF PASSED — all ${CASES.length} modern bug classes caught on a realistic app.`);
  console.log("This is the difference: your AI says ship it; this logs in as a stranger, reads another");
  console.log("customer's data, double-spends the coupon, and jailbreaks the AI — with proof for each.");
}

main().catch((e) => { console.error("elite proof crashed:", e instanceof Error ? e.message : e); process.exit(1); });
