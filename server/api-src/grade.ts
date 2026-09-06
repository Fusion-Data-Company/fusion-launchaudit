/**
 * /api/grade — free, instant, URL-only black-box readiness grade.
 * Thin HTTP wrapper around the shared engine in src/lib/instant-grade.ts
 * (the same engine grades paid orders in stripe-webhook.ts).
 */
import { parseTargetUrl, runInstantGrade } from "../../src/lib/instant-grade.ts";

type VercelRequest = { method?: string; headers?: Record<string, string | string[] | undefined>; body?: { url?: string } };
type VercelResponse = { status: (code: number) => VercelResponse; json: (body: unknown) => void };

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "POST") { response.status(405).json({ error: "POST a JSON body { url }." }); return; }
  const parsed = parseTargetUrl(request.body?.url);
  if (!parsed.ok) { response.status(400).json({ error: parsed.error }); return; }
  const result = await runInstantGrade(parsed.url);
  if (!result.ok) { response.status(result.status).json({ error: result.error }); return; }
  response.status(200).json(result);
}
