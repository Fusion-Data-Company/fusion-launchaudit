import os from "node:os";
import { campaign, testCards } from "../src/lib/campaign-data.ts";
import type { RunnerSyncPayload } from "../src/lib/mcp-runner-contract.ts";
import { probeRuntime, scanRepo } from "./repo-scanner.ts";

const syncUrl = process.env.LAUNCH_AUDIT_SYNC_URL ?? "http://127.0.0.1:3010/api/runner/sync";

function readRepoArg(): string | null {
  const flagIndex = process.argv.indexOf("--repo");
  if (flagIndex !== -1 && process.argv[flagIndex + 1]) {
    return process.argv[flagIndex + 1];
  }
  return process.env.LAUNCH_AUDIT_REPO ?? null;
}

function seededPayload(): RunnerSyncPayload {
  return {
    campaign_id: campaign.id,
    runner_host: campaign.runner.host,
    build_sha: "local-dev",
    scan_mode: "seeded_simulation",
    repo_summary: {
      framework: "Next.js / TypeScript",
      package_manager: "npm",
      scripts: ["npm run dev", "npm run lint", "npm run build"],
      route_count: 9,
      api_route_count: 3,
      env_keys_present: ["NEXT_PUBLIC_APP_URL"],
      env_keys_missing: ["STRIPE_WEBHOOK_SECRET", "RESEND_API_KEY"],
    },
    runtime_summary: {
      app_url: campaign.appUrl,
      reachable: true,
      console_errors: 0,
      failed_requests: 1,
      auth_state: "captured",
    },
    test_cards: testCards.map(({ id, title, category, status, risk }) => ({
      id,
      title,
      category,
      status,
      risk,
    })),
    artifact_refs: [
      "trace://TC-118/direct-url.zip",
      "screenshot://TC-118/admin-detail.png",
      "screenshot://TC-142/mobile-overflow.png",
      "env-map://campaign/cmp_launch_001",
    ],
  };
}

async function livePayload(repoPath: string): Promise<RunnerSyncPayload> {
  const scan = await scanRepo(repoPath);
  const appUrl = process.env.LAUNCH_AUDIT_APP_URL ?? campaign.appUrl;
  const runtime = await probeRuntime(appUrl);

  return {
    campaign_id: campaign.id,
    runner_host: os.hostname(),
    build_sha: process.env.LAUNCH_AUDIT_BUILD_SHA ?? "unknown",
    scan_mode: "live_scan",
    scan_detail: scan.detail,
    repo_summary: scan.repo_summary,
    runtime_summary: runtime,
    test_cards: testCards.map(({ id, title, category, risk }) => ({
      id,
      title,
      category,
      // Live scan has not executed anything yet; Playwright execution is the next layer.
      status: "ready" as const,
      risk,
    })),
    artifact_refs: [`repo-scan://${campaign.id}/${encodeURIComponent(scan.detail.repo_path)}`],
  };
}

async function main() {
  const repoPath = readRepoArg();
  const payload = repoPath ? await livePayload(repoPath) : seededPayload();

  if (process.argv.includes("--print")) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const response = await fetch(syncUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  console.log(JSON.stringify(result, null, 2));

  if (!response.ok) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
