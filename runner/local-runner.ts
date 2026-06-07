import { campaign, testCards } from "../src/lib/campaign-data.ts";
import type { RunnerSyncPayload } from "../src/lib/mcp-runner-contract.ts";

const syncUrl = process.env.LAUNCH_AUDIT_SYNC_URL ?? "http://127.0.0.1:3010/api/runner/sync";

const payload: RunnerSyncPayload = {
  campaign_id: campaign.id,
  runner_host: campaign.runner.host,
  build_sha: "local-dev",
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

async function main() {
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
