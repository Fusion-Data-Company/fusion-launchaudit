/**
 * Mutation harness — proves the detectors actually CATCH bugs (coverage is a vanity
 * metric; kill-rate is the real one). It takes the CLEAN fixture (fixtures/shop-fixed,
 * which scores 100/100) and re-introduces ONE defect at a time, each targeting a
 * specific detector, then runs the full audit and checks that detector fired.
 *
 * A mutation that SURVIVES (its detector didn't catch the re-introduced bug) fails the
 * build — that's a hole in the suite, and it names exactly which detector to fix.
 *
 * Run:  node --experimental-strip-types scripts/mutation-test.ts
 */
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const REPO = process.cwd();
const AUDIT = path.join(REPO, "runner", "audit.ts");
const CLEAN = path.join(REPO, "fixtures", "shop-fixed");

type Mutation = {
  id: string;
  detector: string;
  /** The mutation is KILLED if a finding in ANY of these categories appears. */
  expect: string[];
  /** Edit the copied fixture dir in place (throws if the target text is absent — a stale mutation must fail loud). */
  apply: (dir: string) => void;
};

function mustReplace(src: string, find: string, replace: string): string {
  if (!src.includes(find)) throw new Error(`mutation target not found (fixture drifted): ${find.slice(0, 60)}…`);
  return src.replace(find, replace);
}
function editServer(dir: string, fn: (src: string) => string) {
  const p = path.join(dir, "server.js");
  fs.writeFileSync(p, fn(fs.readFileSync(p, "utf8")));
}

const MUTATIONS: Mutation[] = [
  {
    id: "rbac-direct-url", detector: "admin-rbac (anon block on /admin/users/:id)", expect: ["roles_permissions", "object_authz"],
    apply: (dir) => editServer(dir, (s) => mustReplace(s,
      `    // FIX #1 (RBAC direct-URL): require an admin session; else 302 -> /login.\n    const session = getSession(req);\n    if (session !== 'admin') {\n      res.writeHead(302, { Location: '/login', ...securityHeaders() });\n      return res.end();\n    }\n`,
      `    // [MUTATION] RBAC guard removed — anyone can read the user detail.\n`)),
  },
  {
    id: "unguarded-admin-api", detector: "admin-rbac (anon block on POST /api/admin/delete-user)", expect: ["roles_permissions", "mutation_authz", "write_authz"],
    apply: (dir) => editServer(dir, (s) => mustReplace(s,
      `    // FIX #2 (unguarded admin API): require an admin session; else 401 JSON.\n    const session = getSession(req);\n    if (session !== 'admin') {\n      return sendJson(res, 401, { error: 'Unauthorized: admin session required.' });\n    }\n`,
      `    // [MUTATION] admin API auth removed — anyone can call it.\n`)),
  },
  {
    id: "orders-500-on-bad-input", detector: "backend (malformed input → clean 4xx, not 5xx)", expect: ["api_contract", "core_workflow", "integration_side_effects", "injection"],
    apply: (dir) => editServer(dir, (s) => mustReplace(s,
      `    // FIX #3 (validation): validate qty is a finite number; else clean 400 JSON.\n    const qty = payload.qty;\n    if (typeof qty !== 'number' || !Number.isFinite(qty)) {\n      return sendJson(res, 400, { error: 'Invalid request: "qty" must be a number.' });\n    }\n    const unitPrice = PRODUCTS[0].price;\n    const lineTotal = Number((qty * unitPrice).toFixed(2));\n`,
      `    // [MUTATION] validation removed — qty.toFixed throws on bad input -> 500 + stack.\n    const qty = payload.qty;\n    const unitPrice = PRODUCTS[0].price;\n    const lineTotal = Number(qty.toFixed(2)) * unitPrice;\n`)),
  },
  {
    id: "missing-security-header", detector: "middleware/security (X-Frame-Options present)", expect: ["security_headers", "integration_side_effects"],
    apply: (dir) => editServer(dir, (s) => mustReplace(s, `    'X-Frame-Options': 'DENY',\n`, ``)),
  },
  {
    id: "mobile-overflow", detector: "frontend (no horizontal overflow at 390px)", expect: ["responsive_visual"],
    apply: (dir) => editServer(dir, (s) => mustReplace(s,
      `    <h2>Featured inventory</h2>`,
      `    <pre>MUTATION_WIDE_${"0123456789".repeat(40)}</pre>\n    <h2>Featured inventory</h2>`)),
  },
  {
    id: "permissive-csp", detector: "security (CSP not permissive — no unsafe-inline)", expect: ["security_headers"],
    apply: (dir) => editServer(dir, (s) => mustReplace(s,
      `"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'self'; frame-ancestors 'none'; object-src 'none'"`,
      `"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; base-uri 'self'"`)),
  },
  {
    id: "missing-meta-description", detector: "seo (meta description present)", expect: ["seo"],
    apply: (dir) => editServer(dir, (s) => mustReplace(s, `  <meta name="description" content="\${description}">\n`, ``)),
  },
  {
    id: "gitignore-missing-env", detector: "secrets-scan (.gitignore covers .env)", expect: ["secret_exposure"],
    apply: (dir) => fs.rmSync(path.join(dir, ".gitignore"), { force: true }),
  },
];

function waitForHttp(port: number, timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get({ host: "127.0.0.1", port, path: "/", timeout: 2000 }, (res) => { res.resume(); resolve(); });
      req.on("error", () => (Date.now() > deadline ? reject(new Error(`mutant on :${port} never came up`)) : setTimeout(tick, 250)));
      req.on("timeout", () => { req.destroy(); Date.now() > deadline ? reject(new Error(`mutant :${port} timeout`)) : setTimeout(tick, 250); });
    };
    tick();
  });
}

function runAudit(port: number, repo: string, out: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [
      "--experimental-strip-types", AUDIT, "--name", "mutation", "--app-url", `http://127.0.0.1:${port}`,
      "--repo", repo, "--hints", path.join(repo, "launchaudit-hints.json"), "--out", out, "--no-open",
    ], { stdio: ["ignore", "ignore", "ignore"], env: { ...process.env, LAUNCHAUDIT_NO_OPEN: "1", LAUNCHAUDIT_API_URL: "", BLOB_READ_WRITE_TOKEN: "" } });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`audit exited ${code}`))));
    child.on("error", reject);
  });
}

async function copyDir(src: string, dest: string) {
  await fsp.cp(src, dest, { recursive: true });
}

async function latestFindings(outDir: string): Promise<Array<{ category?: string; title: string; severity: string }>> {
  const files = (await fsp.readdir(outDir)).filter((f) => /^launch-audit-.*\.json$/.test(f)).sort();
  const j = JSON.parse(await fsp.readFile(path.join(outDir, files[files.length - 1]), "utf8"));
  return j.findings ?? [];
}

async function runMutation(m: Mutation, port: number): Promise<{ killed: boolean; hit?: string }> {
  const work = await fsp.mkdtemp(path.join(os.tmpdir(), "la-mut-"));
  const dir = path.join(work, "app");
  await copyDir(CLEAN, dir);
  editServer(dir, (s) => mustReplace(s, `const PORT = 4401;`, `const PORT = ${port};`));
  m.apply(dir);
  const child = spawn("node", [path.join(dir, "server.js")], { stdio: "ignore", env: { ...process.env } });
  const out = path.join(work, "out");
  await fsp.mkdir(out, { recursive: true });
  try {
    await waitForHttp(port);
    await runAudit(port, dir, out);
    const findings = await latestFindings(out);
    const hit = findings.find((f) => f.category && m.expect.includes(f.category));
    return { killed: Boolean(hit), hit: hit ? `${hit.category}/${hit.title}` : undefined };
  } finally {
    child.kill();
    await fsp.rm(work, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  console.log(`Mutation harness — re-breaking the clean fixture, ${MUTATIONS.length} mutations\n`);
  let killed = 0;
  const survivors: string[] = [];
  for (let i = 0; i < MUTATIONS.length; i++) {
    const m = MUTATIONS[i];
    process.stdout.write(`  ${m.id} (${m.detector}) … `);
    try {
      const r = await runMutation(m, 4600 + i);
      if (r.killed) { killed++; console.log(`KILLED  [${r.hit}]`); }
      else { survivors.push(m.id); console.log(`SURVIVED  ← detector did not catch it`); }
    } catch (e) {
      survivors.push(m.id);
      console.log(`ERROR (${e instanceof Error ? e.message : e})`);
    }
  }
  const rate = Math.round((killed / MUTATIONS.length) * 100);
  console.log(`\nKill rate: ${killed}/${MUTATIONS.length} (${rate}%)`);
  if (survivors.length) {
    console.error(`MUTATION TEST FAILED — survivors: ${survivors.join(", ")}`);
    process.exit(1);
  }
  console.log("MUTATION TEST PASSED — every planted mutation was caught by its detector.");
}

main().catch((e) => { console.error("mutation harness crashed:", e instanceof Error ? e.message : e); process.exit(1); });
