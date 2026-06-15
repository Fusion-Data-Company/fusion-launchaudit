import campaignPayload from "../public/campaign.json" with { type: "json" };

export default function handler(request, response) {
  if (request.method && request.method !== "GET") {
    response.status(405).json({ error: "Method Not Allowed", allow: "GET" });
    return;
  }
  response.status(200).json({
    model_provider_slots: campaignPayload.model_provider_slots,
    model_routes: campaignPayload.model_routes,
    model_task_contracts: campaignPayload.model_task_contracts,
  });
}
