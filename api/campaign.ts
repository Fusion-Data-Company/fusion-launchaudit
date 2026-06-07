import { competitiveScorecard } from "../src/lib/competitive-data";
import { campaign, findings, repairTasks, stages, testCards } from "../src/lib/campaign-data";
import { runnerTools } from "../src/lib/mcp-runner-contract";

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

export default function handler(_request: unknown, response: VercelResponse) {
  response.status(200).json({
    campaign,
    stages,
    test_cards: testCards,
    findings,
    repair_tasks: repairTasks,
    runner_tools: runnerTools,
    competitive_scorecard: competitiveScorecard,
  });
}
