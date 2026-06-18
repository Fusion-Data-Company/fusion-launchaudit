/** /api/contact — store platform questions + test-idea submissions in Neon. */
import { getSqlClient } from "../../src/lib/db.ts";
type Req = { method?: string; body?: { name?: string; email?: string; message?: string; type?: string } };
type Res = { status: (n: number) => Res; json: (b: unknown) => void };
export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST a JSON body { email, message }." }); return; }
  const { name, email, message, type } = req.body ?? {};
  if (!email || !message) { res.status(400).json({ error: "email and message are required." }); return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { res.status(400).json({ error: "Enter a valid email." }); return; }
  if (message.length > 5000 || (name && name.length > 200) || email.length > 320) { res.status(400).json({ error: "That's a bit long — trim it down." }); return; }
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
      [id, name || null, email, type || "question", message],
    );
    res.status(200).json({ ok: true });
  } catch (e) { res.status(500).json({ error: e instanceof Error ? e.message : "Could not save your message." }); }
}
