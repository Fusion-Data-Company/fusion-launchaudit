/**
 * Small fixed-window rate limiter for the public API handlers.
 *
 * Scope and honesty: the counter lives in the memory of one serverless
 * instance. Vercel may run several instances, so the real ceiling is
 * `limit x instances`, not `limit`. That is still enough to stop one client
 * from turning /api/grade into a free scanner-as-a-service against third
 * party hosts, which is the abuse this exists to blunt. A shared store
 * (Postgres or KV) would make it exact; it is not needed for the sales page.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 5000;

export type RateLimitResult = { ok: true; remaining: number } | { ok: false; retryAfterSec: number };

export function consumeAttempt(opts: { scope: string; key: string; limit: number; windowMs: number; now?: number }): RateLimitResult {
  const now = opts.now ?? Date.now();
  const id = `${opts.scope}:${opts.key}`;
  let b = buckets.get(id);
  if (!b || b.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) sweep(now);
    b = { count: 0, resetAt: now + opts.windowMs };
    buckets.set(id, b);
  }
  b.count += 1;
  if (b.count > opts.limit) return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  return { ok: true, remaining: opts.limit - b.count };
}

function sweep(now: number) {
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  if (buckets.size >= MAX_KEYS) buckets.clear();
}

/** First hop of x-forwarded-for, else x-real-ip, else "unknown". Vercel sets both. */
export function clientIp(headers: Record<string, string | string[] | undefined> | undefined): string {
  const h = headers ?? {};
  const pick = (name: string) => {
    const v = h[name] ?? h[name.toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
  };
  const xff = pick("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim() || "unknown";
  return pick("x-real-ip")?.trim() || "unknown";
}

/** Test hook. */
export function _resetRateLimits() { buckets.clear(); }
