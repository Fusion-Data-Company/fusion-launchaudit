import campaignPayload from "../public/campaign.json" with { type: "json" };

export default function handler(_request, response) {
  response.status(200).json(campaignPayload);
}
