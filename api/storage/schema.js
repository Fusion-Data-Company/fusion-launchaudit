import campaignPayload from "../../public/campaign.json" with { type: "json" };

export default function handler(request, response) {
  if (request.method && request.method !== "GET") {
    response.status(405).json({ error: "Method Not Allowed", allow: "GET" });
    return;
  }
  response.status(200).json({
    schema_sql: campaignPayload.storage_schema_sql,
    tables: campaignPayload.database_tables,
  });
}
