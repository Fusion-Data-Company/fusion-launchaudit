/**
 * /api/order-status?session_id=cs_… — polled by /order/success.
 * Returns { status, grade, report_url } for a paid audit. 'pending' means the
 * Stripe webhook hasn't landed yet (keep polling).
 */
import { getSqlClient } from "../../src/lib/db.ts";
import { ensurePaidAuditsTable, getPaidAuditBySession, publicOrderStatus } from "../../src/lib/paid-audits.ts";

type Req = { method?: string; query?: Record<string, string | string[] | undefined>; url?: string };
type Res = { status: (n: number) => Res; setHeader?: (k: string, v: string) => void; json: (b: unknown) => void };

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET") { res.status(405).json({ error: "GET ?session_id=" }); return; }
  let sid = req.query?.session_id;
  if (Array.isArray(sid)) sid = sid[0];
  if (!sid && req.url) sid = new URL(req.url, "http://x").searchParams.get("session_id") ?? undefined;
  if (!sid || !/^cs_[A-Za-z0-9_]{8,200}$/.test(sid)) { res.status(400).json({ error: "Provide a valid session_id." }); return; }
  res.setHeader?.("cache-control", "no-store");

  const sql = await getSqlClient();
  if (!sql) { res.status(503).json({ error: "Order status is temporarily unavailable." }); return; }
  try {
    await ensurePaidAuditsTable(sql);
    const row = await getPaidAuditBySession(sql, sid);
    if (!row) { res.status(200).json({ ok: true, status: "pending", grade: null, report_url: null }); return; }
    res.status(200).json({ ok: true, ...publicOrderStatus(row) });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not load order." });
  }
}
