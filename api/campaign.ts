import campaignPayload from "../public/campaign.json" with { type: "json" };
import { ensureCampaignReady, loadCampaignBundle } from "../src/lib/campaign-store.ts";
import { getSqlClient } from "../src/lib/db.ts";

type VercelRequest = {
  method?: string;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

const SEEDED_PERSISTENCE = {
  mode: "seeded",
  detail: "POSTGRES_URL is not configured; serving build-time seeded campaign data.",
};

export default async function handler(_request: VercelRequest, response: VercelResponse) {
  const sql = await getSqlClient();

  if (!sql) {
    response.status(200).json({ ...campaignPayload, persistence: SEEDED_PERSISTENCE });
    return;
  }

  try {
    await ensureCampaignReady(sql);
    const bundle = await loadCampaignBundle(sql);

    if (!bundle) {
      response.status(200).json({
        ...campaignPayload,
        persistence: { mode: "seeded", detail: "Postgres reachable but campaign row missing; serving seeded data." },
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
