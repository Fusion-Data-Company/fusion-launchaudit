import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { campaign, findings, repairTasks, stages, testCards } from "../src/lib/campaign-data.ts";
import { competitiveScorecard } from "../src/lib/competitive-data.ts";
import { flagshipFeatures, healEvents, trafficInsights } from "../src/lib/flagship-features.ts";
import { modelProviderSlots, modelRoutes, modelTaskContracts } from "../src/lib/model-routing.ts";
import { runnerTools } from "../src/lib/mcp-runner-contract.ts";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const payload = {
  campaign,
  stages,
  test_cards: testCards,
  findings,
  repair_tasks: repairTasks,
  runner_tools: runnerTools,
  competitive_scorecard: competitiveScorecard,
  flagship_features: flagshipFeatures,
  traffic_insights: trafficInsights,
  heal_events: healEvents,
  model_provider_slots: modelProviderSlots,
  model_routes: modelRoutes,
  model_task_contracts: modelTaskContracts,
};

await fs.writeFile(path.join(rootDir, "public/campaign.json"), `${JSON.stringify(payload, null, 2)}\n`);
