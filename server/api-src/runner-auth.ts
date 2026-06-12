/**
 * Shared runner-write authentication for the state-changing API handlers
 * (/api/runner/sync and /api/storage/register-artifact).
 *
 * Contract:
 *   - The shared secret is RUNNER_SYNC_SECRET (declared requiredEnv in
 *     src/lib/storage-contract.ts). The caller (the local runner) sends it as
 *     `authorization: Bearer <secret>` or `x-runner-secret: <secret>`.
 *   - PRODUCTION (VERCEL_ENV === "production"): fail closed. If the env secret
 *     is unset the endpoint is unconfigured and rejects every write (503), so a
 *     misconfigured deploy can never silently accept anonymous writes. When the
 *     secret IS set, a caller must present a matching one or get 401.
 *   - LOCAL DEV (VERCEL_ENV !== "production"): if no secret is configured in the
 *     environment, writes are allowed (so `npm run dev` + `npm run runner:sync`
 *     keep working with zero setup). If a secret IS configured locally, it is
 *     enforced exactly like production.
 *   - Comparison is constant-time (crypto.timingSafeEqual) to avoid leaking the
 *     secret through response timing.
 */
import crypto from "node:crypto";

type AuthHeaders = Record<string, string | string[] | undefined>;

export type RunnerAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

function headerValue(headers: AuthHeaders, name: string): string | undefined {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

/** Extract the presented secret from either accepted header. */
function presentedSecret(headers: AuthHeaders): string | undefined {
  const bearer = headerValue(headers, "authorization");
  if (bearer && /^Bearer\s+/i.test(bearer)) {
    return bearer.replace(/^Bearer\s+/i, "").trim();
  }
  const direct = headerValue(headers, "x-runner-secret");
  if (direct) return direct.trim();
  return undefined;
}

/** Constant-time string equality that never short-circuits on length. */
function timingSafeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  // timingSafeEqual throws on length mismatch; hash both sides to a fixed
  // length first so a wrong-length guess can't be distinguished by timing.
  const aHash = crypto.createHash("sha256").update(aBuf).digest();
  const bHash = crypto.createHash("sha256").update(bBuf).digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

/**
 * Authorize a runner write request. Returns { ok: true } when the write may
 * proceed, or { ok: false, status, error } with the rejection to send.
 */
export function authorizeRunnerWrite(headers: AuthHeaders | undefined): RunnerAuthResult {
  const configured = (process.env.RUNNER_SYNC_SECRET ?? "").trim();
  const isProduction = process.env.VERCEL_ENV === "production";
  const presented = presentedSecret(headers ?? {});

  if (!configured) {
    if (isProduction) {
      // Fail closed: a production deploy with no secret must not accept writes.
      return {
        ok: false,
        status: 503,
        error: "Runner write endpoint is not configured (RUNNER_SYNC_SECRET unset). Writes are rejected.",
      };
    }
    // Local dev with no secret: open path so the runner works with no setup.
    return { ok: true };
  }

  if (!presented) {
    return {
      ok: false,
      status: 401,
      error: "Missing runner credential. Send the shared secret as 'authorization: Bearer <secret>' or 'x-runner-secret: <secret>'.",
    };
  }

  if (!timingSafeEqual(presented, configured)) {
    return { ok: false, status: 401, error: "Invalid runner credential." };
  }

  return { ok: true };
}
