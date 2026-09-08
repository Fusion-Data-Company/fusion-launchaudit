import { ensureCampaignReady, loadCampaignBundle } from "../../src/lib/campaign-store.ts";
import { campaign as seededCampaignData, categoryLabels as _cl, findings as seededFindingsData, repairTasks as seededRepairTasksData, stages as seededStages, testCards as seededTestCardsData } from "../../src/lib/campaign-data.ts";
import { competitiveScorecard } from "../../src/lib/competitive-data.ts";
import { flagshipFeatures, healEvents, trafficInsights } from "../../src/lib/flagship-features.ts";
import { modelProviderSlots, modelRoutes, modelTaskContracts } from "../../src/lib/model-routing.ts";
import { runnerTools } from "../../src/lib/mcp-runner-contract.ts";
import { blobArtifacts, databaseTables, storageReadiness, storageSchemaSql } from "../../src/lib/storage-contract.ts";

const campaignPayload = {
  campaign: seededCampaignData,
  stages: seededStages,
  test_cards: seededTestCardsData,
  findings: seededFindingsData,
  repair_tasks: seededRepairTasksData,
  runner_tools: runnerTools,
  competitive_scorecard: competitiveScorecard,
  flagship_features: flagshipFeatures,
  traffic_insights: trafficInsights,
  heal_events: healEvents,
  model_provider_slots: modelProviderSlots,
  model_routes: modelRoutes,
  model_task_contracts: modelTaskContracts,
  storage_readiness: storageReadiness,
  database_tables: databaseTables,
  blob_artifacts: blobArtifacts,
  storage_schema_sql: storageSchemaSql,
};

import { getSqlClient } from "../../src/lib/db.ts";
import { authorizeRunnerWrite } from "./runner-auth.ts";

type VercelRequest = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[]>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

const SEEDED_PERSISTENCE = {
  mode: "seeded",
  detail: "POSTGRES_URL is not configured; serving build-time seeded campaign data.",
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method && request.method !== "GET") {
    response.status(405).json({ error: "Method Not Allowed", allow: "GET" });
    return;
  }
  const sql = await getSqlClient();
  const rawId = request.query?.id;
  const campaignId = typeof rawId === "string" && rawId.trim() ? rawId.trim() : undefined;

  if (!sql) {
    response.status(200).json({ ...campaignPayload, persistence: SEEDED_PERSISTENCE });
    return;
  }
  // Live campaign data is operator-only in production. Anonymous visitors get the seeded
  // sample bundle, flagged as such, plus `locked: true` so the dashboard can ask for the key.
  if (process.env.VERCEL_ENV === "production" && !authorizeRunnerWrite(request.headers).ok) {
    response.status(200).json({
      ...campaignPayload,
      locked: true,
      persistence: { mode: "seeded", detail: "Live campaigns need the operator key. Showing the built-in sample." },
    });
    return;
  }

  try {
    await ensureCampaignReady(sql);
    const bundle = await loadCampaignBundle(sql, campaignId);

    if (!bundle) {
      response.status(campaignId ? 404 : 200).json({
        ...campaignPayload,
        persistence: { mode: "seeded", detail: campaignId ? `Campaign ${campaignId} not found.` : "Postgres reachable but campaign row missing; serving seeded data." },
      });
      return;
    }

    response.status(200).json({
      ...campaignPayload,
      campaign: bundle.campaign,
      test_cards: bundle.testCards,
      findings: bundle.findings,
      repair_tasks: bundle.repairTasks,
      persistence: bundle.persistence,
      run_stats: bundle.runStats,
    });
  } catch (error) {
    response.status(200).json({
      ...campaignPayload,
      persistence: {
        mode: "seeded",
        detail: `Postgres unavailable (${error instanceof Error ? error.message : "unknown error"}); serving seeded fallback.`,
      },
    });
  }
}
