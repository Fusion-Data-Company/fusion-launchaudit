import campaignPayload from "../../public/campaign.json" with { type: "json" };

const runtimeReadiness = campaignPayload.storage_readiness.map((item) => {
  const missingEnv = item.requiredEnv.filter((name) => !process.env[name]);

  return {
    ...item,
    status: missingEnv.length === 0 ? "configured" : item.status,
    missingEnv,
  };
});

export default function handler(_request, response) {
  response.status(200).json({
    storage_readiness: runtimeReadiness,
    database_tables: campaignPayload.database_tables,
    blob_artifacts: campaignPayload.blob_artifacts,
  });
}
