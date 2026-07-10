/**
 * LaunchAudit — standalone audit. Runs entirely on the customer's machine,
 * inside their own Claude Code, on their own subscription. No API key, no
 * hosted backend required.
 *
 *   node --experimental-strip-types runner/audit.ts \
 *     --name "My Site" --app-url https://mysite.com [--repo .]
 *
 * Writes a self-contained HTML report you can open or hand to a client.
 * If LAUNCHAUDIT_API_URL is set, it ALSO syncs to the web command center —
 * but that is optional. The core product needs nothing hosted.
 */
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateTestCards } from "../src/lib/card-generator.ts";
import type { AuditHints } from "../src/lib/generators/types.ts";
import { captureAuth } from "./capture-auth.ts";
import fsp from "node:fs/promises";
import { blobConfigured, runnerAuthHeaders, safeName, uploadEvidence } from "./blob-store.ts";
import { crawlRuntime, mergeDiscovered } from "./crawler.ts";
import { executeCards, executeNoBrowserCards, isNoBrowser, registerArtifact, type CardResult } from "./execute-core.ts";
import { humanize, renderReport, renderClientReport, launchGate, type ReportCard } from "./render-report.ts";
import { renderSarif } from "./sarif.ts";
import { buildAttestation } from "./attestation.ts";
import { buildFixPlan } from "../src/lib/report/fix-plan.ts";
import { parseOpenApi, parseHar, endpointsToHints } from "../src/lib/spec-ingest.ts";
import { loadPolicy, evaluatePolicy } from "./policy.ts";
import { readBaseline, writeBaseline, diffFindings, evaluateDiffGate } from "./diff.ts";
import { loadRulePacksFromDir } from "../src/lib/rulepack.ts";
import fs from "node:fs";
import { sourceHasAuthGuard } from "./repo-scanner.ts";
import { buildGuardIndex, sourceConfirmsMissingGuard, cardPath } from "../src/lib/report/greybox.ts";
import type { CardResult } from "./execute-core.ts";
import { renderDashboard } from "./render-dashboard.ts";
import { spawn } from "node:child_process";
import { sealVerdict, type RawResult } from "./verdict.ts";
import { runWatchdog } from "./watchdog.ts";
import { resultToRaw } from "./verify.ts";
import { probeRuntime, scanRepo } from "./repo-scanner.ts";
import { classifyFailure, type Classification } from "./classify.ts";
import { detectPlatform, PLATFORM_LABEL, type Platform } from "../src/lib/platform/detect.ts";
import { buildFixPrompt } from "../src/lib/report/fixes.ts";
import { buildRepro, parseStep } from "../src/lib/report/repro.ts";

const args = process.argv.slice(2);
const arg = (n: string) => { const i = args.indexOf(`--${n}`); return i !== -1 ? args[i + 1] : undefined; };

const PLATFORM_URL = (process.env.LAUNCHAUDIT_API_URL ?? "http://localhost:3010").replace(/\/$/, "");
const OUT_DIR = arg("out") ?? "launchaudit-report";

/**
 * Collect evidence links per card. Local relative paths always work (the
 * report lives in OUT_DIR, evidence in OUT_DIR/evidence). When
 * BLOB_READ_WRITE_TOKEN is present (.env.local or env), binaries are ALSO
 * uploaded to Vercel Blob (private) and the report links the presigned URL.
 */
async function collectEvidence(results: CardResult[], campaignName: string, runStamp: string) {
  const useBlob = blobConfigured();
  const blobDir = `launchaudit/${safeName(campaignName)}/${runStamp}`;
  if (useBlob) console.error(`      evidence → Vercel Blob under ${blobDir}/`);
  const byCard = new Map<string, Array<{ label: string; href: string }>>();
  let uploaded = 0;
  for (const r of results) {
    const files: Array<[string, string]> = [["screenshot", r.screenshotPath], ["trace", r.tracePath]];
    const links: Array<{ label: string; href: string }> = [];
    for (const [label, filePath] of files) {
      if (!filePath || !(await fsp.stat(filePath).catch(() => null))) continue;
      let href = path.relative(path.resolve(OUT_DIR), path.resolve(filePath));
      if (useBlob) {
        const blob = await uploadEvidence(filePath, blobDir);
        if (blob) {
          uploaded += 1;
          if (blob.reportUrl) href = blob.reportUrl;
        }
      }
      links.push({ label, href });
    }
    if (links.length) byCard.set(r.card.id, links);
  }
  if (useBlob) console.error(`      uploaded ${uploaded} evidence file(s) to Blob`);
  return byCard;
}


async function buildHints(appUrl: string, crawl: { links: Array<{ href: string }>; has_password_field: boolean }, hintsFile?: string): Promise<AuditHints> {
  const hints: AuditHints = { securityPaths: ["/"], protectedRoutes: [], protectedApis: [], postEndpoints: [], roles: {}, writeApis: [], elevenLabsAgents: [] };
  const origin = new URL(appUrl).origin;
  const sample = (route: string) => route.replace(/:(\w+)|\[(\w+)\]|\*/g, "42");

  // From an explicit hints file (what the dev's agent passes after reading the repo).
  if (hintsFile) {
    try {
      const raw = JSON.parse(await fsp.readFile(hintsFile, "utf8"));
      for (const r of raw.protected_routes ?? []) hints.protectedRoutes!.push(sample(r));
      for (const a of raw.protected_apis ?? []) hints.protectedApis!.push(typeof a === "string" ? { path: a, method: "POST" } : a);
      for (const e of raw.post_endpoints ?? []) hints.postEndpoints!.push(typeof e === "string" ? { path: e } : e);
      for (const w of raw.write_apis ?? []) hints.writeApis!.push(typeof w === "string" ? { path: w, method: "POST" } : w);
      if (raw.security_paths) hints.securityPaths = raw.security_paths;
      if (raw.login_path) hints.loginPath = raw.login_path;
      // ElevenLabs agents to audit (read-only). Accepts string IDs or {agentId,name,toolless,apiKeyEnv}.
      if (raw.elevenlabs_api_key_env) hints.elevenLabsApiKeyEnv = raw.elevenlabs_api_key_env;
      for (const a of raw.elevenlabs_agents ?? []) hints.elevenLabsAgents!.push(typeof a === "string" ? { agentId: a } : a);
      // Capture auth for provided roles (locally; creds never leave the machine).
      for (const [role, creds] of [["admin", raw.admin_creds], ["user", raw.user_creds]] as const) {
        if (creds?.username && creds?.password) {
          try {
            const cap = await captureAuth({ appUrl, loginPath: raw.login_path, username: creds.username, password: creds.password, role, outDir: ".launchaudit/auth" });
            hints.roles![role] = { cookie: cap.cookieHeader, storageState: cap.storageStatePath };
            console.error(`      captured ${role} session`);
          } catch (e) { console.error(`      (auth capture failed for ${role}: ${e instanceof Error ? e.message : "?"})`); }
        }
      }
      // A re-runnable login request for the cookie-security detector to inspect live Set-Cookie flags.
      const probeCreds = raw.user_creds ?? raw.admin_creds;
      if (raw.login_path && probeCreds?.username && probeCreds?.password) {
        hints.loginProbe = {
          path: raw.login_path,
          body: `username=${encodeURIComponent(probeCreds.username)}&password=${encodeURIComponent(probeCreds.password)}`,
          contentType: "application/x-www-form-urlencoded",
        };
      }
    } catch (e) { console.error(`      (hints file unreadable: ${e instanceof Error ? e.message : "?"})`); }
  }

  // From the live crawl: admin-looking links + login page.
  for (const l of crawl.links) {
    const pathOnly = l.href.startsWith(origin) ? l.href.slice(origin.length) : l.href;
    if (/\/admin(\/|$)/.test(pathOnly) && !hints.protectedRoutes!.includes(sample(pathOnly))) hints.protectedRoutes!.push(sample(pathOnly));
    if (/\/login(\/|$)/.test(pathOnly) && !hints.loginPath) hints.loginPath = pathOnly;
  }
  return hints;
}

/** An API path that, if it accepts an anonymous write, is a real authz finding. */
function isPrivilegedApiPath(p: string): boolean {
  return /(^|\/)(admin|internal|superadmin|manage|moderat)/i.test(p);
}

/**
 * Fold the API endpoints the crawl observed in live fetch/XHR traffic into hints:
 * mutating ones become malformed-input targets (backend) + privileged ones become
 * anonymous-write-rejection targets (the write-authz wedge). Deduped against what's
 * already there — client-only APIs (hardcoded in a React hook, in no route file) now
 * get probed instead of being invisible.
 */
function foldCrawlApisIntoHints(crawl: { api_routes?: Array<{ path: string; method: string }> }, hints: AuditHints, appUrl: string): void {
  const origin = new URL(appUrl).origin;
  const toPath = (p: string) => (p.startsWith("http") && p.startsWith(origin) ? p.slice(origin.length) : p);
  const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  hints.postEndpoints ??= [];
  hints.protectedApis ??= [];
  hints.writeApis ??= [];
  const postSeen = new Set(hints.postEndpoints.map((e) => e.path));
  const apiSeen = new Set(hints.protectedApis.map((a) => `${a.method ?? "POST"} ${a.path}`));
  const writeSeen = new Set(hints.writeApis.map((w) => `${w.method ?? "POST"} ${w.path}`));
  let added = 0;
  for (const r of crawl.api_routes ?? []) {
    const path = toPath(r.path);
    const method = r.method.toUpperCase();
    if (MUTATING.has(method)) {
      if (!postSeen.has(path)) { hints.postEndpoints.push({ path }); postSeen.add(path); added++; }
      if (isPrivilegedApiPath(path)) {
        const k = `${method} ${path}`;
        if (!writeSeen.has(k)) { hints.writeApis.push({ path, method }); writeSeen.add(k); }
      }
    }
    if (isPrivilegedApiPath(path)) {
      const k = `${method} ${path}`;
      if (!apiSeen.has(k)) { hints.protectedApis.push({ path, method }); apiSeen.add(k); }
    }
  }
  if (added) console.error(`      folded ${added} client-discovered API route(s) into the checks`);
}

/** Replace hardcoded "42" id samples in hint paths with a REAL id the crawl saw live. */
export function applyRealIds(hints: AuditHints, sampledIds: Record<string, string>): void {
  if (!Object.keys(sampledIds).length) return;
  const subst = (p: string): string => {
    const segs = p.split("/");
    for (let i = 1; i < segs.length; i++) {
      if (segs[i] === "42") {
        const key = segs[i - 1]?.toLowerCase();
        if (key && key in sampledIds) segs[i] = sampledIds[key];
      }
    }
    return segs.join("/");
  };
  hints.protectedRoutes = (hints.protectedRoutes ?? []).map(subst);
  for (const a of hints.protectedApis ?? []) a.path = subst(a.path);
  for (const e of hints.postEndpoints ?? []) e.path = subst(e.path);
  for (const w of hints.writeApis ?? []) w.path = subst(w.path);
}

/** Load the most recent prior report JSON from the output dir (for --reverify). */
async function loadPriorReport(outDir: string): Promise<{ findings: Array<{ id?: string; title: string; severity: string; category?: string }> } | null> {
  try {
    const files = (await fsp.readdir(outDir)).filter((f) => /^launch-audit-.*\.json$/.test(f)).sort();
    const latest = files[files.length - 1];
    if (!latest) return null;
    return JSON.parse(await fsp.readFile(path.join(outDir, latest), "utf8"));
  } catch { return null; }
}

async function main() {
  const name = arg("name");
  const appUrl = arg("app-url");
  const repoPath = arg("repo");

  if (!name || !appUrl) {
    console.error('Usage: audit.ts --name "Campaign name" --app-url <url> [--repo <path>]');
    process.exit(1);
  }

  console.error(`\nLaunchAudit — auditing ${appUrl}`);
  console.error(PLATFORM_URL ? `Syncing to: ${PLATFORM_URL}\n` : `Running standalone (no backend, no API key)\n`);

  // Open the live hub the moment the scan starts: boot it if needed, create the
  // campaign now so the UI has a row to track, open it in the browser, and stream
  // phase progress as we work. All best-effort — the audit still completes headless.
  const PHASES = 4;
  let campaignId: string | null = null;
  let openedAtStart = false;
  const noOpen = process.argv.includes("--no-open") || process.env.LAUNCHAUDIT_NO_OPEN === "1";
  if (PLATFORM_URL) {
    const hubUp = await ensureHub(PLATFORM_URL);
    if (hubUp) {
      campaignId = await createRunningCampaign(PLATFORM_URL, name, appUrl, repoPath);
      if (campaignId) {
        const liveUrl = `${PLATFORM_URL}/?campaign=${encodeURIComponent(campaignId)}#/campaigns`;
        if (!noOpen) { openInBrowser(liveUrl); openedAtStart = true; }
        await postProgress(PLATFORM_URL, campaignId, { status: "running", phase: "Reading the site + repo", done: 0, total: PHASES, note: appUrl });
        console.error(`      live hub: ${liveUrl}`);
      }
    }
  }

  console.error("[1/4] Reading the site + repo…");
  const scan = repoPath ? await scanRepo(repoPath) : null;
  let crawl = await crawlRuntime(appUrl);
  if (!crawl.reachable) {
    console.error(`FATAL: ${appUrl} could not be audited — ${crawl.unreachable_reason ?? "the site is not reachable"}.`);
    process.exit(1);
  }
  console.error(`      ${scan ? scan.repo_summary.framework + " · " : ""}${crawl.links.length} pages (crawled ${crawl.pages_crawled ?? 1}, depth ${crawl.max_depth_reached ?? 0}) · ${crawl.api_routes?.length ?? 0} API routes seen · ${crawl.form_count} forms · "${crawl.title}"`);

  if (campaignId) await postProgress(PLATFORM_URL, campaignId, { status: "running", phase: "Building the checks", done: 1, total: PHASES });
  console.error("[2/4] Building the checks…");
  const hints = await buildHints(appUrl, crawl, arg("hints"));

  // Second, AUTHENTICATED crawl pass: buildHints captured a login session when
  // creds were provided, so re-crawl behind the login wall (admin preferred) and
  // merge the surface it reaches. Best-effort — a failure never blocks the audit.
  const authState = hints.roles?.admin?.storageState ?? hints.roles?.user?.storageState;
  if (authState) {
    try {
      const authedCrawl = await crawlRuntime(appUrl, { storageStatePath: authState });
      if (authedCrawl.reachable) {
        const before = crawl.links.length;
        crawl = mergeDiscovered(crawl, authedCrawl);
        console.error(`      authenticated crawl: +${crawl.links.length - before} pages behind login`);
      }
    } catch (e) { console.error(`      (authenticated crawl skipped: ${e instanceof Error ? e.message : "?"})`); }
  }

  // Fold an OpenAPI spec / HAR recording into hints so the authz wedge runs against EVERY
  // parameterized endpoint, not just hand-listed ones. --openapi <file> and/or --har <file>.
  for (const [flag, kind] of [["--openapi", "openapi"], ["--har", "har"]] as const) {
    const i = process.argv.indexOf(flag);
    if (i < 0) continue;
    try {
      const doc = JSON.parse(fs.readFileSync(process.argv[i + 1], "utf8"));
      const endpoints = kind === "openapi" ? parseOpenApi(doc) : parseHar(doc, new URL(appUrl).host);
      const add = endpointsToHints(endpoints);
      hints.protectedApis = [...(hints.protectedApis ?? []), ...add.protectedApis];
      hints.writeApis = [...(hints.writeApis ?? []), ...add.writeApis];
      hints.postEndpoints = [...(hints.postEndpoints ?? []), ...add.postEndpoints];
      console.error(`      ingested ${endpoints.length} endpoints from ${kind} (${add.protectedApis.length} id-bearing, ${add.writeApis.length} write)`);
    } catch (e) { console.error(`      (${kind} ingest skipped: ${e instanceof Error ? e.message : "?"})`); }
  }

  // Fold the API routes the crawl observed in live fetch/XHR traffic into hints so
  // backend / injection / write-authz probe endpoints that exist only in client code.
  foldCrawlApisIntoHints(crawl, hints, appUrl);
  // Replace hardcoded "42" id samples with REAL ids the crawl saw live, so dynamic
  // routes (/products/[id]) resolve to something that actually exists.
  applyRealIds(hints, crawl.sampled_ids ?? {});

  const override = arg("platform") as Platform | undefined;
  const platform = override && PLATFORM_LABEL[override]
    ? { platform: override, confidence: "high" as const, signals: [`overridden via --platform ${override}`], runnerUp: undefined }
    : detectPlatform(scan, crawl, hints);
  console.error(`      platform: ${PLATFORM_LABEL[platform.platform]} (${platform.confidence} confidence) — ${platform.signals.slice(0, 2).join("; ") || "default"}`);
  // Extensible rule packs: load org-authored *.rulepack.json from --rules <dir> (default
  // .launchaudit/rules under the repo). Malformed packs are skipped with a printed reason.
  const rulesIdx = process.argv.indexOf("--rules");
  const rulesDir = rulesIdx >= 0 ? process.argv[rulesIdx + 1] : (repoPath ? path.join(repoPath, ".launchaudit", "rules") : undefined);
  const { packs: rulePacks, skipped: skippedPacks } = rulesDir ? loadRulePacksFromDir(rulesDir) : { packs: [], skipped: [] };
  for (const s of skippedPacks) console.error(`      (rule pack skipped: ${s.file} — ${s.reason})`);
  if (rulePacks.length) console.error(`      loaded ${rulePacks.length} rule pack(s): ${rulePacks.map((p) => p.name).join(", ")}`);
  const cards = generateTestCards(scan, crawl, hints, platform.platform, rulePacks);

  // "Prove it's fixed" re-run: re-check ONLY the checks that failed/needed verification
  // in the most recent report, and show before -> after.
  const reverify = process.argv.includes("--reverify");
  const prior = reverify ? await loadPriorReport(OUT_DIR) : null;
  const priorFindings = prior?.findings ?? [];
  const priorIds = new Set(priorFindings.map((f) => f.id).filter(Boolean) as string[]);
  if (reverify) console.error(`      re-verify mode: re-checking ${priorIds.size} prior finding(s) from the last report`);
  const blocked = cards.filter((c) => c.status === "blocked");
  console.error(`      ${cards.length} checks (${blocked.length} need your input)`);

  console.error("[3/4] Running them in a real browser…");
  const executable = cards.filter((c) => c.status !== "blocked" && (!reverify || priorIds.has(c.id)));
  if (campaignId) await postProgress(PLATFORM_URL, campaignId, { status: "running", phase: "Running checks in a real browser", done: 2, total: PHASES, note: `${executable.length} checks` });
  const auditOpts = { appUrl, artifactDir: path.join(OUT_DIR, "evidence") };
  const results = await executeCards(executable as never, auditOpts);

  // Truth-protocol watchdog (the spine): independently re-run every PASSED
  // no-browser check (security/authz/http/seo/content — deterministic) and
  // downgrade any pass it cannot reproduce-with-evidence to needs_verification.
  // Browser passes are verified by the executor's 3-attempt retry instead
  // (re-launching a browser per pass here would double the run for no gain).
  const byId = new Map((executable as never[]).map((c) => [(c as { id: string }).id, c]));
  const passedNoBrowser = results.filter((r) => r.status === "passed" && isNoBrowser(r.card));
  const reexec = async (id: string): Promise<RawResult> => {
    const [fresh] = await executeNoBrowserCards([byId.get(id)] as never, auditOpts);
    return resultToRaw(fresh);
  };
  // pass^k: re-run each no-browser pass K times; a pass counts only if it holds EVERY
  // time (default 3; override with --consistency N or LAUNCHAUDIT_CONSISTENCY_K).
  const consistencyK = Math.max(1, Number(arg("consistency") ?? process.env.LAUNCHAUDIT_CONSISTENCY_K ?? 3) || 3);
  const wd = passedNoBrowser.length
    ? await runWatchdog(passedNoBrowser.map((r) => sealVerdict(resultToRaw(r))), reexec, { k: consistencyK })
    : null;
  const downgradedIds = new Set((wd?.downgraded ?? []).map((d) => d.checkId));
  const wdReasonById = new Map((wd?.verdicts ?? []).map((v) => [v.checkId, v.reason]));
  // An intermittent AUTHORIZATION pass ("held 2/3 re-runs") is a real defect, not a
  // maybe — the guard doesn't consistently hold. Flag it loud (a bug the Gate fails on).
  const WEDGE = new Set(["roles_permissions", "object_authz", "mutation_authz", "write_authz", "write_authz_unverified", "mass_assignment", "auth"]);
  const intermittentWedgeIds = new Set((wd?.intermittent ?? []).filter((i) => WEDGE.has(i.category)).map((i) => i.checkId));
  const intermittentById = new Map((wd?.intermittent ?? []).map((i) => [i.checkId, i]));
  if (wd) console.error(`      watchdog: re-verified ${wd.verifiedPasses}/${wd.checkedPasses} no-browser passes ${wd.k}×${downgradedIds.size ? `, downgraded ${downgradedIds.size}` : ""}${wd.intermittent.length ? `, ${wd.intermittent.length} INTERMITTENT` : ""}`);

  // Detect a stubbed/bypassed-auth environment so RBAC exposure isn't over-claimed as a vuln.
  const DEV_BYPASS_ENV = ["DEV_ORG_ID", "SUPERADMIN_DEV", "AUTH_BYPASS", "SKIP_AUTH", "NEXT_PUBLIC_DEV"];
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(appUrl);
  const devStubAuth = isLocal && (scan?.repo_summary.env_keys_present ?? []).some((k) => DEV_BYPASS_ENV.includes(k));
  if (devStubAuth) console.error("      note: auth looks stubbed here (local + dev-bypass key) — RBAC exposures flagged 'needs verification', not vulnerabilities");

  // Grey-box: index whether each route's handler source has a server-side auth guard, so
  // classify can mark a runtime authz finding "defense-verified" when source agrees. Reads
  // each route file once (bounded), best-effort — a file we can't read is simply omitted.
  const guardIndex = scan?.detail?.repo_path
    ? buildGuardIndex(scan.detail.routes ?? [], (file) => {
        try { return sourceHasAuthGuard(fs.readFileSync(path.join(scan.detail.repo_path, file), "utf8")); } catch { return undefined; }
      })
    : [];
  const sourceMissingGuard = (r: CardResult) => {
    const p = cardPath(r.card);
    return p ? sourceConfirmsMissingGuard(p, guardIndex) : null;
  };

  const watchdogReason = "Watchdog could not independently reproduce this pass (the re-run came back non-pass or without evidence) — re-verify before trusting it.";
  const classified = results.map((r) => {
    if (r.status === "failed") return { r, cls: classifyFailure(r, { appUrl, devStubAuth, sourceMissingGuard }) };
    if (intermittentWedgeIds.has(r.card.id)) {
      const i = intermittentById.get(r.card.id)!;
      return { r, cls: { type: "product_bug", confidence: "high", reason: `intermittent authorization — this access-control check held only ${i.passes}/${i.runs} independent re-runs. A guard that passes some of the time and fails the rest is worse than one that's always open: it hides from a single test. Treat it as a race/ordering bug in the authorization path and make it deterministic.` } as Classification };
    }
    if (downgradedIds.has(r.card.id)) return { r, cls: { type: "needs_verification", confidence: "low", reason: wdReasonById.get(r.card.id) ?? watchdogReason } as Classification };
    return { r, cls: null as Classification | null };
  });
  const clsById = new Map(classified.filter((x) => x.cls).map((x) => [x.r.card.id, x.cls!]));

  // Honest readiness: a no-browser pass the watchdog couldn't reproduce no longer counts as passed.
  const passed = results.filter((r) => r.status === "passed" && !downgradedIds.has(r.card.id)).length;
  const flaky = results.filter((r) => r.flaky).length;
  // product_bug = a real defect in the app. test_bug = OUR tooling failed (OSV/network) —
  // that is not evidence about the app, so it must NOT lower the app's readiness. It is
  // surfaced as a separate "tooling" note and excluded from the denominator entirely.
  const productBugs = classified.filter((x) => x.cls && x.cls.type === "product_bug");
  const testBugs = classified.filter((x) => x.cls && x.cls.type === "test_bug");
  const needsVerify = classified.filter((x) => x.cls && x.cls.type === "needs_verification");
  const failed = productBugs.length;
  const needAttention = blocked.length + needsVerify.length;
  // Readiness answers "of the checks we could actually RUN, what fraction is launch-ready."
  //  - passed / failed / needs_verification all RAN (needs_verification is an unresolved
  //    question you must answer to be ready, so it stays in the denominator).
  //  - blocked is EXCLUDED: a check we couldn't run for lack of input/https/lockfile is
  //    not evidence the app is unready — it's incomplete COVERAGE, surfaced separately.
  //    (Blocked wedge checks are called out by the Launch Gate so this can't be gamed.)
  const executedDenom = passed + failed + needsVerify.length;
  const readiness = executedDenom === 0 ? 0 : Math.round((passed / executedDenom) * 100);

  // One run stamp shared by evidence blob paths and (optional) platform sync run IDs.
  const runStamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const evidenceByCard = await collectEvidence(results, name, runStamp);

  const reportCards: ReportCard[] = [
    ...results.map((r) => {
      const cls = clsById.get(r.card.id);
      const status = r.flaky ? "passed" : cls?.type === "needs_verification" ? "needs_verification" : r.status;
      return { ...r.card, status, evidence: evidenceByCard.get(r.card.id), ...humanize({ category: r.card.category, title: r.card.title, status }) };
    }),
    ...blocked.map((c) => ({ ...c, status: "blocked", plainTitle: c.title, plainDetail: c.acceptanceCriteria })),
  ] as ReportCard[];

  // Findings carry the classification + a plain reason. Product bugs first, then
  // needs-verification, then tooling notes (test_bugs) last — the tooling notes are
  // OUR problems (an OSV/network hiccup), not the app's, and never affect readiness.
  const findings = [...productBugs, ...needsVerify, ...testBugs].map(({ r, cls }) => {
    const severity = cls!.type === "needs_verification" ? "needs verification" : cls!.type === "test_bug" ? "tooling" : r.card.risk;
    const summary = `${cls!.reason}${r.error ? ` [${r.error.slice(0, 160)}]` : ""}`.slice(0, 400);
    // Reproducible evidence: the exact runnable step + a redacted response slice +
    // any saved trace/screenshot. Falls back to the card's first exec step when the
    // failure wasn't tied to a specific step (so a repro is never empty).
    const step = parseStep(r.failedStep) ?? (r.card.exec?.[0] as Record<string, unknown> | undefined);
    const repro = buildRepro({ appUrl, step, httpEvidence: r.httpEvidence, tracePath: r.tracePath, screenshotPath: r.screenshotPath });
    return {
      id: r.card.id, title: r.card.title, category: r.card.category, summary, severity, repro,
      fixPrompt: buildFixPrompt({ id: r.card.id, title: r.card.title, category: r.card.category, severity, summary }),
    };
  });

  if (campaignId) await postProgress(PLATFORM_URL, campaignId, { status: "running", phase: "Scoring + writing reports", done: 3, total: PHASES, readiness });
  console.error("[4/4] Writing your reports…");
  const reportData = { name, appUrl, readiness, passed, failed, blocked: needAttention, cards: reportCards, findings, generatedAt: new Date().toISOString() };
  const reportFile = await renderReport(reportData, OUT_DIR);
  const clientFile = await renderClientReport(reportData, OUT_DIR);
  const dashboardFile = await renderDashboard(reportData, OUT_DIR);
  // SARIF 2.1.0 — always emit alongside the HTML so CI (GitHub code-scanning) and
  // any SARIF viewer can consume the findings. Pure serializer, no network.
  const sarifFile = path.join(OUT_DIR, "launchaudit.sarif");
  await fsp.writeFile(sarifFile, renderSarif(reportData), "utf8");
  // Tamper-evident audit attestation (in-toto shape). HMAC-signed when
  // LAUNCHAUDIT_ATTEST_KEY is set, otherwise hash-anchored + marked unsigned.
  const attestFile = path.join(OUT_DIR, "launchaudit.attestation.json");
  const attestation = buildAttestation(reportData, launchGate(reportData), process.env.LAUNCHAUDIT_ATTEST_KEY);
  await fsp.writeFile(attestFile, JSON.stringify(attestation, null, 2), "utf8");

  // Optional: sync to hosted command center if configured.
  let hubSynced = false;
  if (PLATFORM_URL) {
    try {
      // Reuse the campaign created when the scan started; only create here if the
      // hub came up late (so a sync still lands somewhere durable).
      if (!campaignId) {
        const created = await fetch(`${PLATFORM_URL}/api/campaigns`, {
          method: "POST", headers: { "content-type": "application/json", ...runnerAuthHeaders() },
          body: JSON.stringify({ name, app_url: appUrl, repo_path_hint: repoPath ?? null }),
        }).then((r) => r.json());
        campaignId = created.id ?? null;
      }
      if (campaignId) {
        const runResults = [], syncFindings = [], artifactRefs: string[] = [];
        for (const r of results) {
          const runId = `run_${runStamp}_${r.card.id}`;
          const refs: string[] = [];
          const shotRef = await registerArtifact(PLATFORM_URL, campaignId, runId, r.card.id, r.screenshotPath, "screenshot");
          if (shotRef) refs.push(shotRef);
          const traceRef = await registerArtifact(PLATFORM_URL, campaignId, runId, r.card.id, r.tracePath, "trace");
          if (traceRef) refs.push(traceRef);
          artifactRefs.push(...refs);
          runResults.push({ run_id: runId, test_card_id: r.card.id, status: r.status, started_at: r.startedAt, ended_at: r.endedAt, artifact_refs: refs });
          if (r.status === "failed") syncFindings.push({ id: `FD_${runStamp}_${r.card.id}`, test_card_id: r.card.id, type: "product_bug", severity: r.card.risk, title: `${r.card.title} — failed`, summary: `Failed at ${r.failedStep}: ${r.error}`.slice(0, 480), evidence_refs: refs });
        }
        await fetch(`${PLATFORM_URL}/api/runner/sync`, {
          method: "POST", headers: { "content-type": "application/json", ...runnerAuthHeaders() },
          body: JSON.stringify({ campaign_id: campaignId, runner_host: os.hostname(), build_sha: "audit-cli", scan_mode: "live_scan",
            scan_detail: { ...(scan?.detail ?? {}), crawl }, repo_summary: scan?.repo_summary ?? { framework: crawl.title || appUrl, package_manager: "n/a", scripts: [], route_count: crawl.links.length, api_route_count: 0, env_keys_present: [], env_keys_missing: [] },
            runtime_summary: await probeRuntime(appUrl), test_cards: [...results.map((r) => ({ ...r.card, status: r.status })), ...blocked], run_results: runResults, findings: syncFindings, artifact_refs: artifactRefs }),
        });
        console.error(`      synced → ${PLATFORM_URL}/#/campaigns`);
        hubSynced = true;
      }
    } catch (e) {
      console.error(`      (sync skipped: ${e instanceof Error ? e.message : "unreachable"})`);
    }
  }
  // Flip the live tracker to done so the dashboard stops polling and shows the
  // final, persisted result (real readiness from the run we just finished).
  if (campaignId && PLATFORM_URL) {
    await postProgress(PLATFORM_URL, campaignId, { status: "report_ready", phase: "Done", done: PHASES, total: PHASES, readiness });
  }

  const newFailingIds = new Set([...productBugs, ...needsVerify].map((x) => x.r.card.id));
  const reranIds = new Set(results.map((r) => r.card.id));
  const beforeAfter = reverify
    ? priorFindings.map((f) => ({
        id: f.id, title: f.title, before: f.severity,
        after: !f.id || !reranIds.has(f.id) ? "not re-run" : newFailingIds.has(f.id) ? "still failing" : "now passing",
      }))
    : [];
  if (reverify) {
    console.error(`\n==== PROVE IT'S FIXED: before -> after ====`);
    for (const b of beforeAfter) {
      const mark = b.after === "now passing" ? "✓" : b.after === "still failing" ? "✕" : "·";
      console.error(`  ${mark} ${b.title}: ${b.before} -> ${b.after}`);
    }
    const fixed = beforeAfter.filter((b) => b.after === "now passing").length;
    console.error(`  ${fixed}/${beforeAfter.length} prior findings now pass.`);
  }

  console.error(`\n==== DONE ====`);
  console.error(
    `Readiness: ${readiness}/100  ·  ${passed} passed${flaky ? ` (${flaky} flaky-recovered)` : ""}, ${failed} to fix, ${needsVerify.length} need verification, ${blocked.length} need input`,
  );
  const dashboardPath = path.resolve(dashboardFile);
  const openTarget = campaignId ? `${PLATFORM_URL}/?campaign=${encodeURIComponent(campaignId)}#/campaigns` : hubSynced ? `${PLATFORM_URL}/#/campaigns` : dashboardPath;
  console.error(`\n\u{1F4CA} Your dashboard (opening in your browser):\n   ${hubSynced ? PLATFORM_URL + " (your live hub — tracks every run)" : "file://" + dashboardPath}`);
  console.error(`   Builder report: ${path.resolve(reportFile)}  \u00B7  Client one-pager: ${path.resolve(clientFile)}`);
  // The live tab opened when the scan started and has been polling; only open now
  // if we didn't (standalone run, or the hub never came up).
  if (!noOpen && !openedAtStart) openInBrowser(openTarget);
  console.log(JSON.stringify({
    platform: { kind: platform.platform, label: PLATFORM_LABEL[platform.platform], confidence: platform.confidence, signals: platform.signals },
    readiness, passed, flaky, to_fix: failed, needs_verification: needsVerify.length, needs_input: blocked.length,
    launch_gate: launchGate(reportData),
    // The self-healing loop's executable spine: ordered per-blocker {fix, repro, verify}
    // the host coding agent applies and proves, looping until the gate passes.
    fix_plan: buildFixPlan(reportData.findings as Parameters<typeof buildFixPlan>[0]),
    dashboard: path.resolve(dashboardFile),
    report: path.resolve(reportFile),
    client_report: path.resolve(clientFile),
    sarif: path.resolve(sarifFile),
    attestation: path.resolve(attestFile),
    ...(reverify ? { reverify: true, before_after: beforeAfter } : {}),
    product_bugs: productBugs.map((x) => ({ id: x.r.card.id, title: x.r.card.title, confidence: x.cls!.confidence, why: x.cls!.reason })),
    needs_verification_items: needsVerify.map((x) => ({ id: x.r.card.id, title: x.r.card.title, why: x.cls!.reason })),
    needs_input_items: blocked.map((c) => ({ id: c.id, title: c.title, why: c.acceptanceCriteria })),
  }, null, 2));

  // CI gate: with --fail-on-gate (or LAUNCHAUDIT_FAIL_ON_GATE=1), exit non-zero when
  // the Launch Gate fails so a GitHub Action / any CI step blocks the merge. Honest by
  // construction — the gate only fails on confirmed security/authz bugs or sub-threshold
  // readiness (see launchGate), never on needs-verification.
  // Continuous regression mode: --baseline <path> diffs this run against a stored
  // snapshot; --fail-on-new gates on NEWLY introduced confirmed bugs only. The baseline
  // is (re)written at the end so the next run compares against this one.
  const baseIdx = process.argv.indexOf("--baseline");
  const baselinePath = baseIdx >= 0 ? process.argv[baseIdx + 1] : undefined;
  if (baselinePath) {
    const prior = readBaseline(baselinePath);
    if (prior) {
      const d = diffFindings(prior, reportData);
      const dg = evaluateDiffGate(d);
      console.error(`\n🔁 Regression vs baseline: ${dg.reason}`);
      for (const nf of d.newFindings) console.error(`   + NEW ${nf.severity}: ${nf.title}`);
      if (!dg.pass && (process.argv.includes("--fail-on-new") || process.env.LAUNCHAUDIT_FAIL_ON_NEW === "1")) {
        process.exitCode = 1;
      }
    } else {
      console.error(`\n🔁 No baseline at ${baselinePath} yet — writing this run as the baseline.`);
    }
    writeBaseline(baselinePath, reportData);
  }

  const failOnGate = process.argv.includes("--fail-on-gate") || process.env.LAUNCHAUDIT_FAIL_ON_GATE === "1";
  if (failOnGate) {
    const gate = launchGate(reportData);
    // Layer the enforced budget policy (launchaudit.config.json or --config) on top
    // of the wedge gate. The build fails if EITHER the wedge gate fails OR a declared
    // budget is breached — both are honest (confirmed bugs / readiness floor only).
    const cfgArgIdx = process.argv.indexOf("--config");
    const cfgPath = cfgArgIdx >= 0 ? process.argv[cfgArgIdx + 1] : undefined;
    const { policy, source } = loadPolicy(cfgPath, repoPath ?? process.cwd());
    const budget = evaluatePolicy(reportData, policy, source);
    const pass = gate.pass && budget.pass;
    if (!pass) {
      if (!gate.pass) console.error(`\n❌ Launch Gate FAILED: ${gate.reason}`);
      for (const v of budget.violations) console.error(`❌ Budget violation (${source}): ${v}`);
      process.exitCode = 1;
    } else {
      console.error(`\n✅ Launch Gate PASSED: ${gate.reason}${source !== "default" ? ` · budget ok (${source})` : ""}`);
    }
  }
}

const HUB_OPEN_TIMEOUT_MS = 15000;

/** True once the hub process answers (any HTTP status means it's up). */
async function hubReachable(url: string): Promise<boolean> {
  try {
    await fetch(`${url}/api/campaigns`, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}

/**
 * Boot the local hub (the PGlite dashboard) if it isn't already running, so a
 * scan can stream live progress into the UI the moment it starts. Best-effort:
 * if it can't come up, the audit still completes headless and writes its files.
 */
async function ensureHub(url: string): Promise<boolean> {
  if (await hubReachable(url)) return true;
  try {
    const dashboard = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "server", "dashboard.ts");
    const child = spawn(process.execPath, ["--experimental-strip-types", dashboard], {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, LAUNCHAUDIT_OPEN: "0" }, // we open the campaign URL ourselves
    });
    child.on("error", () => {});
    child.unref();
  } catch {
    return false;
  }
  const deadline = Date.now() + HUB_OPEN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (await hubReachable(url)) return true;
  }
  return false;
}

/** Create the campaign up front so the dashboard has a live row to track. */
async function createRunningCampaign(url: string, name: string, appUrl: string, repoPath?: string): Promise<string | null> {
  try {
    const created = await fetch(`${url}/api/campaigns`, {
      method: "POST",
      headers: { "content-type": "application/json", ...runnerAuthHeaders() },
      body: JSON.stringify({ name, app_url: appUrl, repo_path_hint: repoPath ?? null }),
    }).then((r) => r.json());
    return created.id ?? null;
  } catch {
    return null;
  }
}

/** Best-effort live-progress ping. Never throws — progress is a nicety, not a gate. */
async function postProgress(url: string, campaignId: string, fields: { status?: string; phase: string; done: number; total: number; note?: string; readiness?: number }): Promise<void> {
  try {
    await fetch(`${url}/api/runner/progress`, {
      method: "POST",
      headers: { "content-type": "application/json", ...runnerAuthHeaders() },
      body: JSON.stringify({ campaign_id: campaignId, ...fields }),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    /* progress is best-effort */
  }
}

function openInBrowser(target: string): void {
  try {
    const plat = process.platform;
    const cmd = plat === "darwin" ? "open" : plat === "win32" ? "cmd" : "xdg-open";
    const args = plat === "win32" ? ["/c", "start", "", target] : [target];
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
  } catch {
    /* headless / no display — the printed file:// path is the fallback */
  }
}

main().catch((e: unknown) => { console.error(e); process.exitCode = 1; });
