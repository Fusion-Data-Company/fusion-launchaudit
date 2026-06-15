/**
 * Failure classifier — the trust wedge over TestSprite. A failed check is not
 * automatically a product bug. We label every failure as one of:
 *   product_bug | test_bug | flaky | needs_verification | needs_input
 * with a confidence and a plain reason, using deterministic signals only.
 *
 * Honesty rules baked in (Truth Protocol):
 *  - RBAC exposure found against a stubbed/bypassed-auth environment is
 *    needs_verification, NOT a confirmed vuln.
 *  - Front-end timing flakes are caught by retry in the runner and never reach
 *    here as failures; a failure that survived retries is treated as stable.
 */
import type { CardResult } from "./execute-core.ts";

export type FindingType = "product_bug" | "test_bug" | "flaky" | "needs_verification" | "needs_input";
export type Classification = { type: FindingType; confidence: "high" | "medium" | "low"; reason: string };
export type ClassifyContext = { appUrl: string; devStubAuth: boolean };

const has = (s: string | undefined, frag: string) => (s ?? "").toLowerCase().includes(frag.toLowerCase());

export function classifyFailure(result: CardResult, ctx: ClassifyContext): Classification {
  const err = result.error ?? "";
  const cat = result.card.category;
  const isRbac = cat === "roles_permissions";
  const isExposure = has(err, "blocked") || has(err, "exposed");

  // Write-authz, unknown-intent surface: an anonymous well-formed write was
  // ACCEPTED (the only way this card fails). We can't tell from the repo if the
  // route is meant to be public, so a human confirms — never a claimed bug.
  if (cat === "write_authz_unverified") {
    return {
      type: "needs_verification",
      confidence: "medium",
      reason:
        "an unauthenticated, well-formed write was accepted on an API route whose access intent isn't declared — confirm whether this endpoint is intentionally public (e.g. a contact form or public webhook) or is missing server-side write authorization",
    };
  }
  // Write-authz, privileged surface: the anonymous write was not rejected with
  // 401/403. Distinguish an accepted write (confirmed hole) from a shape/method
  // rejection (auth not provably the gate → verify, don't over-claim).
  if (cat === "write_authz") {
    const got = Number((err.match(/got (\d{3})/) ?? [])[1] ?? 0);
    const accepted = got >= 200 && got < 300;
    if (accepted && ctx.devStubAuth) {
      return { type: "needs_verification", confidence: "high", reason: "auth is stubbed/bypassed in this environment, so an accepted anonymous write here does not prove a production hole — re-run against an environment with real auth active" };
    }
    if (accepted) {
      return { type: "product_bug", confidence: "high", reason: "an unauthenticated, well-formed write was ACCEPTED (2xx) on a privileged surface — server-side write authorization is missing (open write)" };
    }
    if (got >= 500) {
      return { type: "product_bug", confidence: "high", reason: "an unauthenticated write triggered a 5xx on a privileged surface — the auth gate is missing and the handler crashed on the input" };
    }
    return { type: "needs_verification", confidence: "medium", reason: `the privileged write was rejected with a ${got || "non-2xx"} (shape/method), not a 401/403 — confirm the auth gate rejects a well-formed anonymous write, not just a malformed one` };
  }

  // Privileged surface reachable, but auth is stubbed here → cannot conclude a real hole.
  if (isRbac && isExposure && ctx.devStubAuth) {
    return {
      type: "needs_verification",
      confidence: "high",
      reason:
        "auth is stubbed/bypassed in this environment (local dev with a dev-bypass key), so anonymous access here does not prove a production hole — re-run against an environment with real auth active",
    };
  }
  // Privileged surface reachable with real auth in play → the high-value finding.
  if (isRbac && isExposure) {
    return {
      type: "product_bug",
      confidence: "high",
      reason: "a privileged surface answered an unauthenticated request — server-side authorization is missing, not just UI-hidden",
    };
  }
  // Server 5xx where a clean 4xx was expected → unhandled exception path.
  if (/status 5\d\d/i.test(err) || has(err, "5xx")) {
    return { type: "product_bug", confidence: "high", reason: "the server threw a 5xx instead of a clean 4xx — an unhandled exception path (DoS / info-leak risk)" };
  }
  // Secret / VCS / stack-trace leak in a response body.
  if (has(err, "leaks")) {
    return { type: "product_bug", confidence: "high", reason: "the response exposed sensitive content (secret, version-control data, or a stack trace)" };
  }
  // Hardening header missing / weak / leaking.
  if (has(err, "missing required header") || has(err, "expected one of") || has(err, "should not be exposed")) {
    return { type: "product_bug", confidence: "medium", reason: "a hardening header is missing, set to a weak value, or leaking the stack" };
  }
  // Front-end expectation that survived retries (timing flakes are filtered out upstream).
  if (cat === "core_workflow" || cat === "responsive_visual" || cat === "console_network") {
    return { type: "product_bug", confidence: "medium", reason: "a user-facing expectation failed on every attempt — not a one-off flake" };
  }
  return { type: "product_bug", confidence: "medium", reason: result.error ?? "check failed" };
}
