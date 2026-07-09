/**
 * `launchaudit init` — scaffold a hints file from a repo scan so the authorization
 * wedge fires with zero hand-authoring. Discovers protected pages, privileged APIs,
 * and state-changing endpoints, and lays down two role slots (admin + user) for the
 * two-identity probe. The single biggest adoption unlock: most users never write a
 * hints file, so the best checks never run.
 *
 * Credentials are NEVER written by this scaffold — it leaves empty slots the dev fills
 * locally; creds stay on the machine (captured at audit time into a storageState).
 */
import fs from "node:fs";
import path from "node:path";
import { scanRepo, type RepoScan, type ScannedRoute } from "./repo-scanner.ts";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type HintsScaffold = {
  security_paths: string[];
  login_path?: string;
  protected_routes: string[];
  protected_apis: Array<{ path: string; method: string }>;
  post_endpoints: Array<{ path: string }>;
  write_apis: Array<{ path: string; method: string }>;
  admin_creds: { username: string; password: string; login_path?: string };
  user_creds: { username: string; password: string; login_path?: string };
  _note: string;
};

/** Build a hints scaffold from a repo scan — pure + deterministic, so it's testable. */
export function buildHintsScaffold(scan: RepoScan): HintsScaffold {
  const routes: ScannedRoute[] = scan.detail?.routes ?? [];
  const pages = routes.filter((r) => r.kind === "page");
  const apis = routes.filter((r) => r.kind === "api");

  const loginRoute = pages.find((r) => /\/(login|sign-?in|auth)(\/|$)/i.test(r.url_path));
  const protectedRoutes = uniq(pages.filter((r) => r.privileged).map((r) => r.url_path));

  const protectedApis = dedupePM(
    apis.filter((r) => r.privileged).flatMap((r) => (r.methods.length ? r.methods : ["GET"]).map((m) => ({ path: r.url_path, method: m }))),
  );

  // State-changing endpoints — the write-authz / mutation surface. POST-only list feeds
  // the CSRF/write probes; the fuller write_apis carries the actual method.
  const writeApis = dedupePM(
    apis.flatMap((r) => r.methods.filter((m) => WRITE_METHODS.has(m)).map((m) => ({ path: r.url_path, method: m }))),
  );
  const postEndpoints = uniq(writeApis.filter((w) => w.method === "POST").map((w) => w.path)).map((p) => ({ path: p }));

  return {
    security_paths: ["/"],
    login_path: loginRoute?.url_path,
    protected_routes: protectedRoutes,
    protected_apis: protectedApis,
    post_endpoints: postEndpoints,
    write_apis: writeApis,
    admin_creds: { username: "", password: "", login_path: loginRoute?.url_path },
    user_creds: { username: "", password: "", login_path: loginRoute?.url_path },
    _note: "Fill admin_creds + user_creds with two REAL logins to unlock the authorization wedge (BOLA/BFLA/privilege-gradient). Creds stay local; they are captured into a storageState at audit time and never leave your machine.",
  };
}

function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}
function dedupePM(xs: Array<{ path: string; method: string }>): Array<{ path: string; method: string }> {
  const seen = new Set<string>();
  const out: Array<{ path: string; method: string }> = [];
  for (const x of xs) {
    const k = `${x.method} ${x.path}`;
    if (!seen.has(k)) { seen.add(k); out.push(x); }
  }
  return out;
}

/** CLI: scan a repo and write the scaffold. Non-destructive unless --force. */
export async function runInit(argv: string[]): Promise<number> {
  const repoIdx = argv.indexOf("--repo");
  const repoPath = repoIdx >= 0 ? argv[repoIdx + 1] : ".";
  const outIdx = argv.indexOf("--out");
  const outPath = outIdx >= 0 ? argv[outIdx + 1] : path.join(".launchaudit", "hints.json");
  const force = argv.includes("--force");

  if (fs.existsSync(outPath) && !force) {
    console.error(`✋ ${outPath} already exists. Re-run with --force to overwrite.`);
    return 1;
  }
  console.error(`🔍 Scanning ${path.resolve(repoPath)} for routes…`);
  const scan = await scanRepo(repoPath);
  const scaffold = buildHintsScaffold(scan);
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(scaffold, null, 2), "utf8");

  console.error(`✅ Wrote ${outPath}`);
  console.error(`   protected routes: ${scaffold.protected_routes.length} · privileged APIs: ${scaffold.protected_apis.length} · write endpoints: ${scaffold.write_apis.length}`);
  console.error(scaffold.login_path ? `   login detected at ${scaffold.login_path}` : `   no /login route detected — set login_path manually if you have one.`);
  console.error(`   ➜ Fill admin_creds + user_creds with two real logins, then run: launchaudit --app-url <url> --repo ${repoPath} --hints ${outPath}`);
  return 0;
}

// Direct-run entrypoint (node runner/init.ts …).
if (import.meta.url === `file://${process.argv[1]}`) {
  runInit(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
