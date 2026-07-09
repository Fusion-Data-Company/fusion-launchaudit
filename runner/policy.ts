/**
 * Enforced budgets / assertions — the Lighthouse-CI "budget.json" move, on our
 * findings. A team declares thresholds in launchaudit.config.json; the gate fails
 * the build when policy is breached. Turns the 0–100 score into enforceable policy.
 *
 * Honest by construction: budgets count only CONFIRMED product bugs (the same
 * severities the Launch Gate treats as real) — never needs-verification / needs-input
 * / blocked / tooling. A stricter budget can tighten the gate; it can never invent a
 * failure out of an unresolved question.
 */
import fs from "node:fs";
import path from "node:path";
import type { ReportData } from "./render-report.ts";

export type Policy = {
  /** Minimum readiness (0–100) to pass. */
  readinessMin?: number;
  /** Max confirmed product bugs across all categories. */
  maxProductBugs?: number;
  /** Per-category caps on confirmed product bugs, e.g. { seo: 2, accessibility: 0 }. */
  maxByCategory?: Record<string, number>;
  /** Categories where ANY confirmed bug fails the build (severity-agnostic hard stops). */
  failOnAnyIn?: string[];
};

export type PolicyResult = { pass: boolean; violations: string[]; source: string };

// The default policy is intentionally permissive — it defers to the Launch Gate's
// wedge logic and only enforces a readiness floor. Teams opt into stricter budgets.
export function defaultPolicy(): Policy {
  return { readinessMin: 80 };
}

// A finding is a CONFIRMED product bug (counts against a budget) when its severity is
// not one of the honest non-bug buckets. Kept in lockstep with launchGate's confirmed().
export function isConfirmedBug(severity: string): boolean {
  const s = severity.toLowerCase();
  return s !== "needs verification" && s !== "needs input" && s !== "blocked" && s !== "tooling";
}

/**
 * Load a policy from an explicit path or the conventional launchaudit.config.json in
 * the given base dir (default cwd). Missing file → default policy (never throws for
 * absence). A present-but-malformed file throws — a broken budget must be loud, not
 * silently ignored.
 */
export function loadPolicy(explicitPath?: string, baseDir: string = process.cwd()): { policy: Policy; source: string } {
  const candidate = explicitPath ? path.resolve(explicitPath) : path.join(baseDir, "launchaudit.config.json");
  if (!fs.existsSync(candidate)) return { policy: defaultPolicy(), source: "default" };
  const raw = fs.readFileSync(candidate, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`launchaudit policy at ${candidate} is not valid JSON: ${(e as Error).message}`);
  }
  return { policy: normalizePolicy(parsed, candidate), source: candidate };
}

// Validate + coerce untrusted config into a Policy. Rejects wrong-typed fields loudly.
export function normalizePolicy(input: unknown, source = "<inline>"): Policy {
  if (input == null || typeof input !== "object") throw new Error(`launchaudit policy at ${source} must be a JSON object`);
  const o = input as Record<string, unknown>;
  const p: Policy = {};
  if (o.readinessMin !== undefined) {
    if (typeof o.readinessMin !== "number" || o.readinessMin < 0 || o.readinessMin > 100) throw new Error(`readinessMin must be a number 0–100 (${source})`);
    p.readinessMin = o.readinessMin;
  }
  if (o.maxProductBugs !== undefined) {
    if (typeof o.maxProductBugs !== "number" || o.maxProductBugs < 0) throw new Error(`maxProductBugs must be a number ≥ 0 (${source})`);
    p.maxProductBugs = o.maxProductBugs;
  }
  if (o.maxByCategory !== undefined) {
    if (typeof o.maxByCategory !== "object" || o.maxByCategory === null) throw new Error(`maxByCategory must be an object (${source})`);
    const m: Record<string, number> = {};
    for (const [k, v] of Object.entries(o.maxByCategory as Record<string, unknown>)) {
      if (typeof v !== "number" || v < 0) throw new Error(`maxByCategory.${k} must be a number ≥ 0 (${source})`);
      m[k] = v;
    }
    p.maxByCategory = m;
  }
  if (o.failOnAnyIn !== undefined) {
    if (!Array.isArray(o.failOnAnyIn) || o.failOnAnyIn.some((x) => typeof x !== "string")) throw new Error(`failOnAnyIn must be an array of category strings (${source})`);
    p.failOnAnyIn = o.failOnAnyIn as string[];
  }
  return p;
}

/** Evaluate a report against a policy. Returns pass + a list of human-readable violations. */
export function evaluatePolicy(data: ReportData, policy: Policy, source = "default"): PolicyResult {
  const violations: string[] = [];
  const bugs = data.findings.filter((f) => isConfirmedBug(f.severity));

  if (policy.readinessMin !== undefined && data.readiness < policy.readinessMin) {
    violations.push(`readiness ${data.readiness} is below the required minimum of ${policy.readinessMin}`);
  }
  if (policy.maxProductBugs !== undefined && bugs.length > policy.maxProductBugs) {
    violations.push(`${bugs.length} confirmed product bugs exceed the budget of ${policy.maxProductBugs}`);
  }
  if (policy.maxByCategory) {
    for (const [cat, cap] of Object.entries(policy.maxByCategory)) {
      const n = bugs.filter((b) => b.category === cat).length;
      if (n > cap) violations.push(`category "${cat}" has ${n} confirmed bugs, over its budget of ${cap}`);
    }
  }
  if (policy.failOnAnyIn) {
    for (const cat of policy.failOnAnyIn) {
      const n = bugs.filter((b) => b.category === cat).length;
      if (n > 0) violations.push(`category "${cat}" is a hard-stop and has ${n} confirmed bug${n === 1 ? "" : "s"}`);
    }
  }
  return { pass: violations.length === 0, violations, source };
}
