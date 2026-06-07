import type { ArtifactRegistration } from "../../src/lib/campaign-store.ts";
import { ensureCampaignReady, registerArtifactRecord } from "../../src/lib/campaign-store.ts";
import { getSqlClient } from "../../src/lib/db.ts";

type VercelRequest = {
  method?: string;
  body?: Partial<ArtifactRegistration>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

const requiredFields = ["campaign_id", "run_id", "test_card_id", "artifact_type", "filename", "sha256"] as const;

function safeSegment(value: string) {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function artifactPath(body: ArtifactRegistration) {
  return `campaigns/${safeSegment(body.campaign_id)}/runs/${safeSegment(body.run_id)}/${safeSegment(body.artifact_type)}/${safeSegment(body.test_card_id)}-${safeSegment(body.filename)}`;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "POST") {
    response.status(405).json({ accepted: false, error: "Method not allowed." });
    return;
  }

  const body = request.body ?? {};
  const missing = requiredFields.filter((field) => !body[field]);

  if (missing.length > 0) {
    response.status(400).json({
      accepted: false,
      error: "Artifact registration payload is incomplete.",
      missing,
    });
    return;
  }

  const completeBody = body as ArtifactRegistration;
  const blobPath = artifactPath(completeBody);

  let persistence: Record<string, unknown> = {
    mode: "seeded",
    detail: "POSTGRES_URL is not configured; artifact contract validated but not durably stored.",
  };

  const sql = await getSqlClient();

  if (sql) {
    try {
      await ensureCampaignReady(sql);
      const result = await registerArtifactRecord(sql, completeBody, blobPath);
      persistence = { mode: "postgres", ...result };
    } catch (error) {
      persistence = {
        mode: "postgres",
        persisted: false,
        reason: error instanceof Error ? error.message : "Unknown persistence failure.",
      };
    }
  }

  response.status(200).json({
    accepted: true,
    campaign_id: completeBody.campaign_id,
    run_id: completeBody.run_id,
    artifact_ref: `blob://${blobPath}`,
    upload: {
      mode: process.env.BLOB_READ_WRITE_TOKEN ? "vercel_blob_ready" : "contract_only_missing_blob_token",
      path: blobPath,
      access: "private",
    },
    persistence,
  });
}
