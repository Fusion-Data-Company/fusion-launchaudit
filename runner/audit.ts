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
import { generateTestCards } from "../src/lib/card-generator.ts";
import type { AuditHints } from "../src/lib/generators/types.ts";
import { captureAuth } from "./capture-auth.ts";
import fsp from "node:fs/promises";
import { blobConfigured, runnerAuthHeaders, safeName, uploadEvidence } from "./blob-store.ts";
import { crawlRuntime } from "./crawler.ts";
import { executeCards, executeNoBrowserCards, isNoBrowser, registerArtifact, type CardResult } from "./execute-core.ts";
import { humanize, renderReport, type ReportCard } from "./render-report.ts";
import { sealVerdict, type RawResult } from "./verdict.ts";
import { runWatchdog } from "./watchdog.ts";
import { resultToRaw } from "./verify.ts";
import { probeRuntime, scanRepo } from "./repo-scanner.ts";
import { classifyFailure, type Classification } from "./classify.ts";
import { detectPlatform, PLATFORM_LABEL, type Platform } from "../src/lib/platform/detect.ts";
import { buildFixPrompt } from "../src/lib/report/fixes.ts";

const args = process.argv.slice(2);
const arg = (n: string) => { const i = args.indexOf(`--${n}`); return i !== -1 ? args[i + 1] : undefined; };

const PLATFORM_URL = (process.env.LAUNCHAUDIT_API_URL ?? "").replace(/\/$/, "");
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

  console.error("[1/4] Reading the site + repo…");
  const scan = repoPath ? await scanRepo(repoPath) : null;
  const crawl = await crawlRuntime(appUrl);
  if (!crawl.reachable) {
    console.error(`FATAL: ${appUrl} could not be audited — ${crawl.unreachable_reason ?? "the site is not reachable"}.`);
    process.exit(1);
  }
  console.error(`      ${scan ? scan.repo_summary.framework + " · " : ""}${crawl.links.length} pages · ${crawl.form_count} forms · "${crawl.title}"`);

  console.error("[2/4] Building the checks…");
  const hints = await buildHints(appUrl, crawl, arg("hints"));
  const override = arg("platform") as Platform | undefined;
  const platform = override && PLATFORM_LABEL[override]
    ? { platform: override, confidence: "high" as const, signals: [`overridden via --platform ${override}`], runnerUp: undefined }
    : detectPlatform(scan, crawl, hints);
  console.error(`      platform: ${PLATFORM_LABEL[platform.platform]} (${platform.confidence} confidence) — ${platform.signals.slice(0, 2).join("; ") || "default"}`);
  const cards = generateTestCards(scan, crawl, hints, platform.platform);
  const blocked = cards.filter((c) => c.status === "blocked");
  console.error(`      ${cards.length} checks (${blocked.length} need your input)`);

  console.error("[3/4] Running them in a real browser…");
  const executable = cards.filter((c) => c.status !== "blocked");
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
  const wd = passedNoBrowser.length
    ? await runWatchdog(passedNoBrowser.map((r) => sealVerdict(resultToRaw(r))), reexec)
    : null;
  const downgradedIds = new Set((wd?.downgraded ?? []).map((d) => d.checkId));
  if (wd) console.error(`      watchdog: re-verified ${wd.verifiedPasses}/${wd.checkedPasses} no-browser passes${downgradedIds.size ? `, downgraded ${downgradedIds.size} unreproducible` : ""}`);

  // Detect a stubbed/bypassed-auth environment so RBAC exposure isn't over-claimed as a vuln.
  const DEV_BYPASS_ENV = ["DEV_ORG_ID", "SUPERADMIN_DEV", "AUTH_BYPASS", "SKIP_AUTH", "NEXT_PUBLIC_DEV"];
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(appUrl);
  const devStubAuth = isLocal && (scan?.repo_summary.env_keys_present ?? []).some((k) => DEV_BYPASS_ENV.includes(k));
  if (devStubAuth) console.error("      note: auth looks stubbed here (local + dev-bypass key) — RBAC exposures flagged 'needs verification', not vulnerabilities");

  const watchdogReason = "Watchdog could not independently reproduce this pass (the re-run came back non-pass or without evidence) — re-verify before trusting it.";
  const classified = results.map((r) => {
    if (r.status === "failed") return { r, cls: classifyFailure(r, { appUrl, devStubAuth }) };
    if (downgradedIds.has(r.card.id)) return { r, cls: { type: "needs_verification", confidence: "low", reason: watchdogReason } as Classification };
    return { r, cls: null as Classification | null };
  });
  const clsById = new Map(classified.filter((x) => x.cls).map((x) => [x.r.card.id, x.cls!]));

  // Honest readiness: a no-browser pass the watchdog couldn't reproduce no longer counts as passed.
  const passed = results.filter((r) => r.status === "passed" && !downgradedIds.has(r.card.id)).length;
  const flaky = results.filter((r) => r.flaky).length;
  const productBugs = classified.filter((x) => x.cls && (x.cls.type === "product_bug" || x.cls.type === "test_bug"));
  const needsVerify = classified.filter((x) => x.cls && x.cls.type === "needs_verification");
  const failed = productBugs.length;
  const needAttention = blocked.length + needsVerify.length;
  const executedDenom = passed + failed + needAttention;
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

  // Findings carry the classification + a plain reason. Product bugs first, then needs-verification.
  const findings = [...productBugs, ...needsVerify].map(({ r, cls }) => {
    const severity = cls!.type === "needs_verification" ? "needs verification" : cls!.type === "product_bug" ? r.card.risk : cls!.type;
    const summary = `${cls!.reason}${r.error ? ` [${r.error.slice(0, 160)}]` : ""}`.slice(0, 400);
    return {
      id: r.card.id, title: r.card.title, category: r.card.category, summary, severity,
      fixPrompt: buildFixPrompt({ id: r.card.id, title: r.card.title, category: r.card.category, severity, summary }),
    };
  });

  console.error("[4/4] Writing your report…");
  const reportFile = await renderReport(
    { name, appUrl, readiness, passed, failed, blocked: needAttention, cards: reportCards, findings, generatedAt: new Date().toISOString() },
    OUT_DIR,
  );

  // Optional: sync to hosted command center if configured.
  if (PLATFORM_URL) {
    try {
      const created = await fetch(`${PLATFORM_URL}/api/campaigns`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, app_url: appUrl, repo_path_hint: repoPath ?? null }),
      }).then((r) => r.json());
      const campaignId = created.id;
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
      }
    } catch (e) {
      console.error(`      (sync skipped: ${e instanceof Error ? e.message : "unreachable"})`);
    }
  }

  console.error(`\n==== DONE ====`);
  console.error(
    `Readiness: ${readiness}/100  ·  ${passed} passed${flaky ? ` (${flaky} flaky-recovered)` : ""}, ${failed} to fix, ${needsVerify.length} need verification, ${blocked.length} need input`,
  );
  console.error(`Report:  ${path.resolve(reportFile)}`);
  console.log(JSON.stringify({
    platform: { kind: platform.platform, label: PLATFORM_LABEL[platform.platform], confidence: platform.confidence, signals: platform.signals },
    readiness, passed, flaky, to_fix: failed, needs_verification: needsVerify.length, needs_input: blocked.length,
    report: path.resolve(reportFile),
    product_bugs: productBugs.map((x) => ({ id: x.r.card.id, title: x.r.card.title, confidence: x.cls!.confidence, why: x.cls!.reason })),
    needs_verification_items: needsVerify.map((x) => ({ id: x.r.card.id, title: x.r.card.title, why: x.cls!.reason })),
    needs_input_items: blocked.map((c) => ({ id: c.id, title: c.title, why: c.acceptanceCriteria })),
  }, null, 2));
}

main().catch((e: unknown) => { console.error(e); process.exitCode = 1; });
