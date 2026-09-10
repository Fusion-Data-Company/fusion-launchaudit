/** /api/contact — store platform questions + test-idea submissions in Neon. */
import { deliverSubmissions } from "../../src/lib/crm-delivery.ts";
import { getSqlClient } from "../../src/lib/db.ts";
import { clientIp, consumeAttempt } from "../../src/lib/rate-limit.ts";
type Req = { method?: string; headers?: Record<string, string | string[] | undefined>; body?: unknown };
type Res = { status: (n: number) => Res; json: (b: unknown) => void };
const CONTACT_TYPES = new Set(["question", "test", "feedback", "partnership"]);
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST a JSON body { email, message }." }); return; }
  const rl = consumeAttempt({ scope: "contact", key: clientIp(req.headers), limit: 10, windowMs: 10 * 60_000 });
  if (!rl.ok) { res.status(429).json({ error: `Too many messages from this address. Try again in ${rl.retryAfterSec}s.` }); return; }
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {};
  if ((body.name !== undefined && typeof body.name !== "string")
    || (body.email !== undefined && typeof body.email !== "string")
    || (body.message !== undefined && typeof body.message !== "string")
    || (body.type !== undefined && typeof body.type !== "string")) {
    res.status(400).json({ error: "name, email, message and type must be strings." }); return;
  }
  const name = (body.name as string | undefined)?.trim() ?? "";
  const email = (body.email as string | undefined)?.trim() ?? "";
  const message = (body.message as string | undefined)?.trim() ?? "";
  const type = (body.type as string | undefined) ?? "question";
  if (!email || !message) { res.status(400).json({ error: "email and message are required." }); return; }
  if (!EMAIL_RE.test(email)) { res.status(400).json({ error: "Enter a valid email." }); return; }
  if (!CONTACT_TYPES.has(type)) { res.status(400).json({ error: "Choose a valid message type." }); return; }
  if (message.length > 5000 || name.length > 200 || email.length > 320) { res.status(400).json({ error: "That's a bit long — trim it down." }); return; }
  const sql = await getSqlClient();
  if (!sql) { res.status(503).json({ error: "Submissions are temporarily unavailable." }); return; }
  try {
    // getSqlClient() returns a (text, params) executor — NOT a tagged template.
    await sql(
      `create table if not exists submissions (
         id text primary key, name text, email text not null, type text,
         message text not null, created_at timestamptz not null default now()
       )`,
    );
    const id = "sub_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    await sql(
      `insert into submissions (id, name, email, type, message) values ($1, $2, $3, $4, $5)`,
      [id, name || null, email, type, message],
    );
    await deliverSubmissions(sql, id).catch(() => {});
    res.status(200).json({ ok: true });
  } catch (e) { res.status(500).json({ error: e instanceof Error ? e.message : "Could not save your message." }); }
}
