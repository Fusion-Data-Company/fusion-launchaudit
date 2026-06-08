/**
 * DB layer verification against an in-process Postgres (PGlite).
 * Proves: migration applies, seed is idempotent, campaign bundle round-trips,
 * runner sync persists, artifact registration persists.
 * Production uses @neondatabase/serverless; both run the exact same SQL.
 */
import { PGlite } from "@electric-sql/pglite";
import { campaign as seededCampaign, testCards as seededTestCards } from "../src/lib/campaign-data.ts";
import {
  createCampaign,
  ensureSchema,
  listCampaigns,
  loadCampaignBundle,
  recordRunnerSync,
  registerArtifactRecord,
  seedCampaignData,
} from "../src/lib/campaign-store.ts";
import type { SqlClient } from "../src/lib/db.ts";
import type { RunnerSyncPayload } from "../src/lib/mcp-runner-contract.ts";

let failures = 0;

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`PASS  ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  const pg = new PGlite();
  const sql: SqlClient = async (text, params = []) => {
    const result = await pg.query(text, params as never[]);
    return result.rows as Record<string, unknown>[];
  };

  // 1. Migration applies
  await ensureSchema(sql);
  const tables = await sql(
    `select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
  );
  const tableNames = tables.map((row) => String(row.table_name));
  for (const expected of ["projects", "campaigns", "runner_sessions", "test_cards", "runs", "artifacts", "findings", "repair_tasks", "model_tasks"]) {
    check(`schema: table ${expected} exists`, tableNames.includes(expected));
  }

  // 2. Migration is idempotent
  await ensureSchema(sql);
  check("schema: re-applying migration is idempotent", true);

  // 3. Seed + read back
  await seedCampaignData(sql);
  const bundle = await loadCampaignBundle(sql);
  check("seed: campaign bundle loads", bundle !== null);
  check("seed: campaign id round-trips", bundle?.campaign.id === seededCampaign.id);
  check(
    `seed: all ${seededTestCards.length} test cards round-trip`,
    bundle?.testCards.length === seededTestCards.length,
    `got ${bundle?.testCards.length}`,
  );
  check("seed: findings round-trip", (bundle?.findings.length ?? 0) > 0);
  check("seed: repair tasks round-trip", (bundle?.repairTasks.length ?? 0) > 0);
  const firstCard = bundle?.testCards.find((card) => card.id === seededTestCards[0].id);
  check(
    "seed: jsonb arrays round-trip intact",
    JSON.stringify(firstCard?.steps) === JSON.stringify(seededTestCards[0].steps),
  );

  // 4. Seed is idempotent
  await seedCampaignData(sql);
  const bundleAfterReseed = await loadCampaignBundle(sql);
  check(
    "seed: re-seeding does not duplicate cards",
    bundleAfterReseed?.testCards.length === seededTestCards.length,
  );

  // 5. Runner sync persists
  const syncPayload: RunnerSyncPayload = {
    campaign_id: seededCampaign.id,
    runner_host: "verify-host.local",
    build_sha: "verify-sha",
    scan_mode: "live_scan",
    repo_summary: {
      framework: "Next.js / TypeScript",
      package_manager: "npm",
      scripts: ["npm run dev"],
      route_count: 4,
      api_route_count: 2,
      env_keys_present: ["DATABASE_URL"],
      env_keys_missing: ["STRIPE_KEY"],
    },
    runtime_summary: {
      app_url: "http://localhost:3000",
      reachable: true,
      console_errors: 0,
      failed_requests: 0,
      auth_state: "missing",
    },
    test_cards: [
      { id: seededTestCards[0].id, title: seededTestCards[0].title, category: seededTestCards[0].category, status: "running", risk: seededTestCards[0].risk },
      { id: "TC-NEW-100", title: "brand new real card", category: "api_contract", status: "passed", risk: "high", goal: "prove inserts work", steps: ["step one"], expectedEvidence: ["screenshot"], acceptanceCriteria: "insert succeeds" },
    ],
    findings: [
      { id: "FD-NEW-1", test_card_id: "TC-NEW-100", type: "product_bug", severity: "high", title: "real finding", summary: "synced from runner", evidence_refs: ["screenshot://x"] },
    ],
    run_results: [
      { run_id: "run_sync_1", test_card_id: "TC-NEW-100", status: "passed", started_at: new Date().toISOString(), ended_at: new Date().toISOString(), artifact_refs: [] },
    ],
    artifact_refs: ["repo-scan://verify"],
  };

  const syncResult = await recordRunnerSync(sql, syncPayload);
  check("sync: known card status updated", syncResult.cardsUpdated === 1, `updated ${syncResult.cardsUpdated}`);
  check("sync: NEW card inserted (loop closes)", syncResult.cardsInserted === 1, `inserted ${syncResult.cardsInserted}`);
  check("sync: readiness computed from real statuses", typeof syncResult.readiness === "number");

  const bundleAfterSync = await loadCampaignBundle(sql);
  const updatedCard = bundleAfterSync?.testCards.find((card) => card.id === seededTestCards[0].id);
  check("sync: status change survives reload", updatedCard?.status === "running", `got ${updatedCard?.status}`);
  const newCard = bundleAfterSync?.testCards.find((card) => card.id === "TC-NEW-100");
  check("sync: inserted card loads with full fields", newCard?.goal === "prove inserts work");
  check("sync: synced finding loads", bundleAfterSync?.findings.some((f) => f.id === "FD-NEW-1") === true);
  const runRowsAfterSync = await sql(`select id from runs where id = 'run_sync_1'`);
  check("sync: run result recorded", runRowsAfterSync.length === 1);
  check("sync: runner session recorded", bundleAfterSync?.campaign.runner.host === "verify-host.local");
  check("sync: last sync timestamp set", bundleAfterSync?.campaign.runner.lastSync !== "never");

  // 6. Artifact registration persists
  const artifactResult = await registerArtifactRecord(
    sql,
    {
      campaign_id: seededCampaign.id,
      run_id: "run_verify_001",
      test_card_id: seededTestCards[0].id,
      artifact_type: "screenshot",
      filename: "proof.png",
      sha256: "abc123def456abc123def456",
    },
    "campaigns/cmp_launch_001/runs/run_verify_001/screenshot/proof.png",
  );
  check("artifact: registration persisted", artifactResult.persisted === true);

  const artifactRows = await sql(`select id, run_id, blob_path from artifacts`);
  check("artifact: row exists with blob path", artifactRows.length === 1 && String(artifactRows[0].blob_path).includes("proof.png"));
  const runRows = await sql(`select id, status from runs where id = $1`, ["run_verify_001"]);
  check("artifact: run row auto-created", runRows.length === 1);

  // 7. Artifact for unknown test card fails loudly, not silently
  const badArtifact = await registerArtifactRecord(
    sql,
    {
      campaign_id: seededCampaign.id,
      run_id: "run_verify_002",
      test_card_id: "TC-DOES-NOT-EXIST",
      artifact_type: "trace",
      filename: "trace.zip",
      sha256: "feedfacefeedface",
    },
    "campaigns/x/runs/run_verify_002/trace/trace.zip",
  );
  check("artifact: unknown test card rejected with reason", badArtifact.persisted === false && "reason" in badArtifact);

  // 8. Multi-campaign: create, list, exec round-trip, auto repair packet
  const created = await createCampaign(sql, { name: "Verify Co Launch", appUrl: "https://verify.example.com", repoPathHint: "/tmp/verify" });
  check("campaign: created with generated id", created.id.startsWith("cmp_verify-co-launch"));
  const list = await listCampaigns(sql);
  check("campaign: listed alongside seeded", list.length === 2 && list.some((c) => c.id === created.id));

  await recordRunnerSync(sql, {
    campaign_id: created.id,
    runner_host: "verify-host",
    repo_summary: { framework: "Next.js", package_manager: "npm", scripts: [], route_count: 1, api_route_count: 0, env_keys_present: [], env_keys_missing: [] },
    runtime_summary: { app_url: "https://verify.example.com", reachable: true, console_errors: 0, failed_requests: 0, auth_state: "missing" },
    scan_detail: { route_files_sampled: ["app/page.tsx", "app/api/route.ts"] },
    test_cards: [
      { id: "TC-V-1", title: "exec card", category: "core_workflow", status: "failed", risk: "high", goal: "g", steps: ["open", "check"], expectedEvidence: ["screenshot"], acceptanceCriteria: "passes", exec: [{ action: "goto", url: "https://verify.example.com" }] } as never,
    ],
    findings: [
      { id: "FD-V-1", test_card_id: "TC-V-1", type: "product_bug", severity: "high", title: "exec card — failed", summary: "broke", evidence_refs: ["blob://x"] },
    ],
    run_results: [
      { run_id: "run_v_1", test_card_id: "TC-V-1", status: "failed", started_at: new Date().toISOString(), ended_at: new Date().toISOString(), artifact_refs: [] },
    ],
    artifact_refs: [],
  });

  const newBundle = await loadCampaignBundle(sql, created.id);
  check("campaign: new campaign bundle loads with its own cards", newBundle?.testCards.length === 1);
  check("campaign: exec steps round-trip", Array.isArray((newBundle?.testCards[0] as { exec?: unknown[] })?.exec) && ((newBundle?.testCards[0] as { exec?: unknown[] }).exec?.length ?? 0) === 1);
  check("campaign: readiness computed for new campaign (0 passed / 1 failed)", newBundle?.campaign.readinessScore === 0);
  check("repair: auto-generated from product_bug finding", newBundle?.repairTasks.length === 1 && newBundle.repairTasks[0].likely_files.includes("app/page.tsx"));
  const seededBundle = await loadCampaignBundle(sql);
  check("isolation: seeded campaign untouched by new campaign", seededBundle?.testCards.every((c) => c.id !== "TC-V-1") === true);
  check("isolation: repair packets campaign-scoped", seededBundle?.repairTasks.every((r) => r.finding_id !== "FD-V-1") === true);

  await pg.close();

  console.log(failures === 0 ? "\nALL DB CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
