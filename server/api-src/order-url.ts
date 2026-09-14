/**
 * /api/order-url: POST { session_id, url, authorized } from the success page when the
 * buyer paid before naming the site. Sets target_url on the awaiting_url row and queues
 * the audit; the page's next /api/order-status poll runs it. One shot: a row that is
 * already queued or delivered is not changed.
 */
import { getSqlClient } from "../../src/lib/db.ts";
import { parseTargetUrl } from "../../src/lib/instant-grade.ts";
import { clientIp, consumeAttempt } from "../../src/lib/rate-limit.ts";
import { ensurePaidAuditsTable, getPaidAuditBySession, publicOrderStatus, setPaidAuditUrl } from "../../src/lib/paid-audits.ts";

type Req = { method?: string; headers?: Record<string, string | string[] | undefined>; body?: { session_id?: string; url?: string; authorized?: boolean } };
type Res = { status: (n: number) => Res; setHeader?: (k: string, v: string) => void; json: (b: unknown) => void };

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST a JSON body { session_id, url, authorized }." }); return; }
  const rl = consumeAttempt({ scope: "order-url", key: clientIp(req.headers), limit: 12, windowMs: 10 * 60_000 });
  if (!rl.ok) { res.status(429).json({ error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` }); return; }
  res.setHeader?.("cache-control", "no-store");
  const sid = (req.body?.session_id ?? "").trim();
  if (!/^cs_[A-Za-z0-9_]{8,200}$/.test(sid)) { res.status(400).json({ error: "Provide a valid session_id." }); return; }
  if (req.body?.authorized !== true) { res.status(400).json({ error: "Confirm that you own this site or are authorised to test it." }); return; }
  const parsed = parseTargetUrl(req.body?.url);
  if (!parsed.ok) { res.status(400).json({ error: parsed.error }); return; }
  const url = parsed.url.origin + (parsed.url.pathname === "/" ? "" : parsed.url.pathname);

  const sql = await getSqlClient();
  if (!sql) { res.status(503).json({ error: "Orders are temporarily unavailable." }); return; }
  try {
    await ensurePaidAuditsTable(sql);
    const row = await getPaidAuditBySession(sql, sid);
    if (!row) { res.status(404).json({ error: "We have not received the payment for this order yet. Wait a few seconds and try again." }); return; }
    if (row.status !== "awaiting_url") { res.status(409).json({ error: `This order already has a site (${row.target_url}) and cannot be changed here.`, ...publicOrderStatus(row) }); return; }
    const updated = await setPaidAuditUrl(sql, sid, url);
    res.status(200).json({ ok: true, ...publicOrderStatus(updated ?? row) });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not save the site URL." });
  }
}
