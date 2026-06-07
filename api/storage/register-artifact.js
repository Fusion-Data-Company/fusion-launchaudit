const requiredFields = ["campaign_id", "run_id", "test_card_id", "artifact_type", "filename", "sha256"];

function safeSegment(value) {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function artifactPath(body) {
  const campaignId = safeSegment(body.campaign_id);
  const runId = safeSegment(body.run_id);
  const testCardId = safeSegment(body.test_card_id);
  const filename = safeSegment(body.filename);

  return `campaigns/${campaignId}/runs/${runId}/${safeSegment(body.artifact_type)}/${testCardId}-${filename}`;
}

export default function handler(request, response) {
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

  response.status(200).json({
    accepted: true,
    campaign_id: body.campaign_id,
    run_id: body.run_id,
    artifact_ref: `blob://${artifactPath(body)}`,
    upload: {
      mode: process.env.BLOB_READ_WRITE_TOKEN ? "vercel_blob_ready" : "contract_only_missing_blob_token",
      path: artifactPath(body),
      access: "private",
    },
  });
}
