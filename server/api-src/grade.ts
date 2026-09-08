/**
 * /api/grade — free, instant, URL-only black-box readiness grade.
 * Thin HTTP wrapper around the shared engine in src/lib/instant-grade.ts
 * (the same engine grades paid orders in stripe-webhook.ts).
 */
import { parseTargetUrl, runInstantGrade } from "../../src/lib/instant-grade.ts";
import { clientIp, consumeAttempt } from "../../src/lib/rate-limit.ts";

type VercelRequest = { method?: string; headers?: Record<string, string | string[] | undefined>; body?: { url?: string } };
type VercelResponse = { status: (code: number) => VercelResponse; json: (body: unknown) => void };

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "POST") { response.status(405).json({ error: "POST a JSON body { url }." }); return; }
  // The free grader probes third-party hosts on the visitor's say-so. Cap it per IP so
  // nobody turns it into a scanner they point at other people's sites all day.
  const rl = consumeAttempt({ scope: "grade", key: clientIp(request.headers), limit: 10, windowMs: 10 * 60_000 });
  if (!rl.ok) { response.status(429).json({ error: `Too many scans from this address. Try again in ${rl.retryAfterSec}s, or run the audit free in your own agent.` }); return; }
  const parsed = parseTargetUrl(request.body?.url);
  if (!parsed.ok) { response.status(400).json({ error: parsed.error }); return; }
  const result = await runInstantGrade(parsed.url);
  if (!result.ok) { response.status(result.status).json({ error: result.error }); return; }
  response.status(200).json(result);
}
