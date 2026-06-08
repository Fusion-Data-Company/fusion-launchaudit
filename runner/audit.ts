/**
 * LaunchAudit — one-command audit. The product moment:
 *
 *   node --experimental-strip-types runner/audit.ts \
 *     --name "Client App" --app-url https://client.app [--repo /path/to/repo]
 *
 * scan repo -> crawl runtime -> generate executable cards -> create campaign
 * -> execute in a real browser -> sync results, findings, evidence -> print
 * the report location. Private code never leaves this machine.
 */
import os from "node:os";
import { generateTestCards } from "../src/lib/card-generator.ts";
import type { RunnerSyncPayload, SyncFinding, SyncRunResult, SyncTestCard } from "../src/lib/mcp-runner-contract.ts";
import { crawlRuntime } from "./crawler.ts";
import { executeCards, registerArtifact } from "./execute-core.ts";
import { probeRuntime, scanRepo } from "./repo-scanner.ts";

const args = process.argv.slice(2);
function arg(name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index !== -1 ? args[index + 1] : undefined;
}

const PLATFORM_URL = (process.env.LAUNCHAUDIT_API_URL ?? "http://127.0.0.1:3010").replace(/\/$/, "");

async function main() {
  const name = arg("name");
  const appUrl = arg("app-url");
  const repoPath = arg("repo");

  if (!name || !appUrl) {
    console.error('Usage: audit.ts --name "Campaign name" --app-url <url> [--repo <path>]');
    process.exit(1);
  }

  console.error(`\nLaunchAudit — full audit of ${appUrl}`);
  console.error(`Platform: ${PLATFORM_URL}\n`);

  console.error("[1/5] Scanning repo + crawling runtime…");
  const scan = repoPath ? await scanRepo(repoPath) : null;
  const crawl = await crawlRuntime(appUrl);
  if (!crawl.reachable) {
    console.error(`FATAL: ${appUrl} is not reachable. Start the app and re-run.`);
    process.exit(1);
  }
  console.error(`      ${scan ? scan.repo_summary.framework + " repo, " : ""}${crawl.links.length} routes discovered, ${crawl.form_count} forms, title "${crawl.title}"`);

  console.error("[2/5] Generating executable test cards…");
  const cards = generateTestCards(scan, crawl);
  const blocked = cards.filter((card) => card.status === "blocked");
  console.error(`      ${cards.length} cards (${blocked.length} honestly blocked)`);

  console.error("[3/5] Creating campaign on platform…");
  const createResponse = await fetch(`${PLATFORM_URL}/api/campaigns`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, app_url: appUrl, repo_path_hint: repoPath ?? null }),
  });
  const created = await createResponse.json();
  if (!createResponse.ok) {
    console.error(`FATAL: campaign creation failed (${createResponse.status}): ${JSON.stringify(created)}`);
    process.exit(1);
  }
  const campaignId: string = created.id;
  console.error(`      ${campaignId}`);

  console.error("[4/5] Executing in real browser…");
  const executable = cards.filter((card) => card.status !== "blocked");
  const results = await executeCards(executable as never, { appUrl, artifactDir: `runner-artifacts/${campaignId}` });

  const runStamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runResults: SyncRunResult[] = [];
  const findings: SyncFinding[] = [];
  const artifactRefs: string[] = [];

  for (const result of results) {
    const runId = `run_${runStamp}_${result.card.id}`;
    const artifactRef = await registerArtifact(PLATFORM_URL, campaignId, runId, result.card.id, result.screenshotPath);
    if (artifactRef) artifactRefs.push(artifactRef);
    runResults.push({
      run_id: runId,
      test_card_id: result.card.id,
      status: result.status,
      started_at: result.startedAt,
      ended_at: result.endedAt,
      artifact_refs: artifactRef ? [artifactRef] : [],
    });
    if (result.status === "failed") {
      findings.push({
        id: `FD_${runStamp}_${result.card.id}`,
        test_card_id: result.card.id,
        type: "product_bug",
        severity: result.card.risk as SyncFinding["severity"],
        title: `${result.card.title} — failed`,
        summary: `Failed at step ${result.failedStep}: ${result.error}`.slice(0, 480),
        evidence_refs: artifactRef ? [artifactRef] : [`file://${result.screenshotPath}`],
      });
    }
  }

  console.error("[5/5] Syncing results, findings, evidence…");
  const syncedCards: SyncTestCard[] = [
    ...results.map(({ card, status }) => ({ ...card, status }) as SyncTestCard),
    ...blocked.map((card) => card as SyncTestCard),
  ];

  const payload: RunnerSyncPayload = {
    campaign_id: campaignId,
    runner_host: os.hostname(),
    build_sha: "audit-cli",
    scan_mode: "live_scan",
    scan_detail: { ...(scan?.detail ?? {}), crawl } as Record<string, unknown>,
    repo_summary: scan?.repo_summary ?? {
      framework: `external target (${crawl.title || appUrl})`,
      package_manager: "n/a",
      scripts: [],
      route_count: crawl.links.length,
      api_route_count: 0,
      env_keys_present: [],
      env_keys_missing: [],
    },
    runtime_summary: await probeRuntime(appUrl),
    test_cards: syncedCards,
    run_results: runResults,
    findings,
    artifact_refs: artifactRefs,
  };

  const syncResponse = await fetch(`${PLATFORM_URL}/api/runner/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const sync = await syncResponse.json();

  const passed = results.filter((result) => result.status === "passed").length;
  console.error(`\n==== AUDIT COMPLETE ====`);
  console.error(`Executed: ${passed}/${results.length} passed | Blocked (declared): ${blocked.length} | Findings: ${findings.length}`);
  console.error(`Readiness: ${sync.persistence?.readiness ?? "n/a"}/100 (computed)`);
  console.error(`Command center: ${PLATFORM_URL}/#/campaigns (campaign ${campaignId})`);
  console.error(`Report: ${PLATFORM_URL}/report.html?campaign=${campaignId}`);
  console.log(JSON.stringify({ campaign_id: campaignId, passed, executed: results.length, blocked: blocked.length, findings: findings.length, readiness: sync.persistence?.readiness }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
