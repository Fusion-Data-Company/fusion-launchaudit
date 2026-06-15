import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard, type WriteApi } from "./types.ts";

/**
 * Write-authz / IDOR surface — the #1 market white space. RBAC checks prove
 * anonymous callers can't READ admin pages; this proves they can't WRITE.
 *
 * Two tiers, separated by how confident we are the route is meant to be guarded:
 *
 *  1. PRIVILEGED writes (category "write_authz"). Declared in hints (the dev's
 *     agent says "this must be authed") or a scan route on an admin/superadmin/
 *     internal surface. An anonymous POST/PUT/PATCH/DELETE here MUST be rejected
 *     with 401/403 — not 200 (open write), not 400/500 (auth is not the gate).
 *     A 2xx is a confirmed product_bug; a non-auth rejection is needs_verification.
 *
 *  2. UNKNOWN-INTENT writes (category "write_authz_unverified"). Every other
 *     scan-discovered mutating API route. We can't tell from the repo whether
 *     it's meant to be public (a contact form, a public webhook) or locked down,
 *     so we do NOT demand a 401 — we only flag when an anonymous, well-formed
 *     write is ACCEPTED (2xx), and that is reported as needs_verification, never
 *     a confirmed bug. A human confirms the endpoint is intentionally public.
 *
 * A malformed-but-rejected-for-shape endpoint is exactly how an open write
 * hides: it 400s on junk while happily accepting a well-formed anonymous write.
 * We send a minimal well-formed-ish body to reach the auth gate, not pass schema.
 */
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const WRITE_ACCEPTED = [200, 201, 202, 204];

export function generateWriteAuthz(scan: RepoScan | null, _crawl: RuntimeCrawl, hints: AuditHints, c: Counter): GeneratedCard[] {
  const cards: GeneratedCard[] = [];

  // Tier 1 seed: explicit hint-declared writes (the dev's agent says these must be authed).
  const privileged: WriteApi[] = [...(hints.writeApis ?? [])];
  const seen = new Set(privileged.map((w) => `${(w.method ?? "POST").toUpperCase()} ${w.path}`));
  // Tier 2: every other scan-discovered mutating API route — access intent unknown.
  const unknown: Array<{ path: string; method: string }> = [];

  for (const r of scan?.detail?.routes ?? []) {
    if (r.kind !== "api") continue;
    const methods = (r.methods.length ? r.methods : ["POST"]).filter((m) => MUTATING.has(m.toUpperCase()));
    for (const m of methods) {
      const method = m.toUpperCase();
      const key = `${method} ${r.url_path}`;
      if (seen.has(key)) continue; // already a declared/privileged write
      seen.add(key);
      if (r.privileged) privileged.push({ path: r.url_path, method });
      else unknown.push({ path: r.url_path, method });
    }
  }

  // Tier 1 cards: anonymous write MUST be auth-rejected (401/403).
  for (const w of privileged) {
    const method = (w.method ?? "POST").toUpperCase();
    // A minimal body so the server can't reject purely on "no body"; the point
    // is to reach the auth gate, not pass schema validation.
    const body = w.body ?? { launchaudit_probe: true };
    cards.push({
      id: c.next("TC-WA"), title: `Anonymous ${method} rejected: ${w.path}`, category: "write_authz", status: "ready", risk: "critical",
      goal: "A state-changing write from an unauthenticated caller on a privileged surface must be rejected by the server (401/403), not merely shape-validated.",
      steps: [`${method} ${w.path} with no auth`, "Expect 401 or 403", "A 200/201 means the write is OPEN; a 400/500 means auth is not the gate"],
      expectedEvidence: ["network_log"], dataNeeds: [],
      acceptanceCriteria: `Anonymous ${method} ${w.path} returns 401 or 403.`,
      exec: [{ action: "http", method, path: w.path, body, expectStatusOneOf: [401, 403] }],
    });
  }

  // Tier 2 cards: flag ONLY if an anonymous well-formed write is ACCEPTED (2xx) → needs_verification.
  for (const w of unknown) {
    const method = w.method;
    cards.push({
      id: c.next("TC-WA"), title: `Anonymous ${method} not silently accepted: ${w.path}`, category: "write_authz_unverified", status: "ready", risk: "high",
      goal: "A write API whose access intent isn't declared should not silently accept an unauthenticated, well-formed write. If it does, a human must confirm the endpoint is intentionally public.",
      steps: [`${method} ${w.path} with no auth and a minimal body`, "A 401/403/400/405 means the write did not persist anonymously — fine", "A 2xx means an anonymous caller changed state — confirm this endpoint is meant to be public"],
      expectedEvidence: ["network_log"], dataNeeds: [],
      acceptanceCriteria: `Anonymous ${method} ${w.path} is not accepted (no 2xx) without auth; if accepted, verify it is intentionally public.`,
      exec: [{ action: "http", method, path: w.path, body: { launchaudit_probe: true }, expectStatusNot: WRITE_ACCEPTED }],
    });
  }

  return cards;
}
