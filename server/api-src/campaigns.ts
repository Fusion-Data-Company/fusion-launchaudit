import { createCampaign, ensureCampaignReady, listCampaigns } from "../../src/lib/campaign-store.ts";
import { getSqlClient } from "../../src/lib/db.ts";
import { authorizeRunnerWrite } from "./runner-auth.ts";

type VercelRequest = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: { name?: string; app_url?: string; repo_path_hint?: string };
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const sql = await getSqlClient();

  if (!sql) {
    response.status(503).json({
      error: "Campaign management requires Postgres.",
      hint: "Set POSTGRES_URL in the deployment environment; seeded demo mode cannot create campaigns.",
      persistence: { mode: "seeded" },
    });
    return;
  }

  try {
    await ensureCampaignReady(sql);

    if (request.method === "GET") {
      response.status(200).json({ campaigns: await listCampaigns(sql), persistence: { mode: "postgres" } });
      return;
    }

    if (request.method === "POST") {
      // Campaign creation is a privileged write. Gate it with the same operator
      // secret as the runner-sync endpoints (open in local dev, enforced in prod)
      // so a deployed dashboard can't be written to by anonymous callers.
      const auth = authorizeRunnerWrite(request.headers);
      if (!auth.ok) {
        response.status(auth.status).json({ error: auth.error });
        return;
      }
      const { name, app_url, repo_path_hint } = request.body ?? {};
      if (!name || !app_url) {
        response.status(400).json({ error: "name and app_url are required." });
        return;
      }
      try {
        new URL(app_url);
      } catch {
        response.status(400).json({ error: `app_url is not a valid URL: ${app_url}` });
        return;
      }
      const created = await createCampaign(sql, { name, appUrl: app_url, repoPathHint: repo_path_hint });
      response.status(201).json({ id: created.id, persistence: { mode: "postgres" } });
      return;
    }

    response.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : "Unknown failure." });
  }
}
