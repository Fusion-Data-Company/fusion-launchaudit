import type { RunnerSyncPayload } from "../../../src/lib/mcp-runner-contract.ts";
import { ensureCampaignReady, recordRunnerSync } from "../../../src/lib/campaign-store.ts";
import { getSqlClient } from "../../../src/lib/db.ts";

type VercelRequest = {
  method?: string;
  body?: Partial<RunnerSyncPayload>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

function hasRequiredSyncShape(body: Partial<RunnerSyncPayload>): body is RunnerSyncPayload {
  return Boolean(
    body.campaign_id &&
      body.runner_host &&
      body.repo_summary?.framework &&
      body.runtime_summary?.app_url &&
      Array.isArray(body.test_cards) &&
      Array.isArray(body.artifact_refs),
  );
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "POST") {
    response.status(405).json({ accepted: false, error: "Method not allowed." });
    return;
  }

  const body = request.body ?? {};

  if (!hasRequiredSyncShape(body)) {
    response.status(400).json({
      accepted: false,
      error:
        "Runner sync payload must include campaign_id, runner_host, repo_summary, runtime_summary, test_cards, and artifact_refs.",
    });
    return;
  }

  let persistence: Record<string, unknown> = {
    mode: "seeded",
    detail: "POSTGRES_URL is not configured; sync accepted but not durably stored.",
  };

  const sql = await getSqlClient();

  if (sql) {
    try {
      await ensureCampaignReady(sql);
      const result = await recordRunnerSync(sql, body);
      persistence = {
        mode: "postgres",
        session_id: result.sessionId,
        cards_updated: result.cardsUpdated,
        cards_unknown: result.cardsUnknown,
      };
    } catch (error) {
      persistence = {
        mode: "postgres",
        error: error instanceof Error ? error.message : "Unknown persistence failure.",
      };
    }
  }

  response.status(200).json({
    accepted: true,
    campaign_id: body.campaign_id,
    synced_at: new Date().toISOString(),
    scan_mode: body.scan_mode ?? "seeded_simulation",
    normalized: {
      framework: body.repo_summary.framework,
      app_url: body.runtime_summary.app_url,
      cards_received: body.test_cards.length,
      artifacts_received: body.artifact_refs.length,
    },
    persistence,
  });
}
