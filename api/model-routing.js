import campaignPayload from "../public/campaign.json" with { type: "json" };

export default function handler(_request, response) {
  response.status(200).json({
    model_provider_slots: campaignPayload.model_provider_slots,
    model_routes: campaignPayload.model_routes,
    model_task_contracts: campaignPayload.model_task_contracts,
  });
}
