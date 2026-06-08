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
import { crawlRuntime } from "./crawler.ts";
import { executeCards, registerArtifact } from "./execute-core.ts";
import { humanize, renderReport, type ReportCard } from "./render-report.ts";
import { probeRuntime, scanRepo } from "./repo-scanner.ts";

const args = process.argv.slice(2);
const arg = (n: string) => { const i = args.indexOf(`--${n}`); return i !== -1 ? args[i + 1] : undefined; };

const PLATFORM_URL = (process.env.LAUNCHAUDIT_API_URL ?? "").replace(/\/$/, "");
const OUT_DIR = arg("out") ?? "launchaudit-report";

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
    console.error(`FATAL: ${appUrl} is not reachable. Start the app/site and re-run.`);
    process.exit(1);
  }
  console.error(`      ${scan ? scan.repo_summary.framework + " · " : ""}${crawl.links.length} pages · ${crawl.form_count} forms · "${crawl.title}"`);

  console.error("[2/4] Building the checks…");
  const cards = generateTestCards(scan, crawl);
  const blocked = cards.filter((c) => c.status === "blocked");
  console.error(`      ${cards.length} checks (${blocked.length} need your input)`);

  console.error("[3/4] Running them in a real browser…");
  const executable = cards.filter((c) => c.status !== "blocked");
  const results = await executeCards(executable as never, { appUrl, artifactDir: path.join(OUT_DIR, "evidence") });

  const passed = results.filter((r) => r.status === "passed").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const executedDenom = passed + failed + blocked.length;
  const readiness = executedDenom === 0 ? 0 : Math.round((passed / executedDenom) * 100);

  const reportCards: ReportCard[] = [
    ...results.map((r) => ({ ...r.card, status: r.status, ...humanize({ category: r.card.category, title: r.card.title, status: r.status }) })),
    ...blocked.map((c) => ({ ...c, plainTitle: c.title, plainDetail: c.acceptanceCriteria })),
  ] as ReportCard[];

  const findings = results
    .filter((r) => r.status === "failed")
    .map((r) => ({ title: r.card.title, summary: `Failed: ${r.error}`.slice(0, 360), severity: r.card.risk }));

  console.error("[4/4] Writing your report…");
  const reportFile = await renderReport(
    { name, appUrl, readiness, passed, failed, blocked: blocked.length, cards: reportCards, findings, generatedAt: new Date().toISOString() },
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
        const runStamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const runResults = [], syncFindings = [], artifactRefs: string[] = [];
        for (const r of results) {
          const runId = `run_${runStamp}_${r.card.id}`;
          const ref = await registerArtifact(PLATFORM_URL, campaignId, runId, r.card.id, r.screenshotPath);
          if (ref) artifactRefs.push(ref);
          runResults.push({ run_id: runId, test_card_id: r.card.id, status: r.status, started_at: r.startedAt, ended_at: r.endedAt, artifact_refs: ref ? [ref] : [] });
          if (r.status === "failed") syncFindings.push({ id: `FD_${runStamp}_${r.card.id}`, test_card_id: r.card.id, type: "product_bug", severity: r.card.risk, title: `${r.card.title} — failed`, summary: `Failed at ${r.failedStep}: ${r.error}`.slice(0, 480), evidence_refs: ref ? [ref] : [] });
        }
        await fetch(`${PLATFORM_URL}/api/runner/sync`, {
          method: "POST", headers: { "content-type": "application/json" },
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
  console.error(`Readiness: ${readiness}/100  ·  ${passed} passed, ${failed} failed, ${blocked.length} need input`);
  console.error(`Report:  ${path.resolve(reportFile)}`);
  console.log(JSON.stringify({
    readiness, passed, failed, blocked: blocked.length, report: path.resolve(reportFile),
    findings: findings.map((f) => f.title),
    needs_input: blocked.map((c) => ({ id: c.id, title: c.title, why: c.acceptanceCriteria })),
  }, null, 2));
}

main().catch((e: unknown) => { console.error(e); process.exitCode = 1; });
