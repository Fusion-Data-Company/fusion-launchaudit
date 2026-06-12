import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard, type WriteApi } from "./types.ts";

/**
 * Write-authz / IDOR surface — the #1 market white space. RBAC checks prove
 * anonymous callers can't READ admin pages; this proves they can't WRITE.
 *
 * An unauthenticated POST/PUT/PATCH/DELETE that persists state must be REJECTED
 * with 401/403 — not 400 (bad shape is not authorization), not 200 (open write),
 * not 500. A malformed-but-rejected-for-shape endpoint is exactly how an open
 * write hides: it 400s on junk while happily accepting a well-formed anonymous
 * write. We send a minimal well-formed-ish body and require an auth rejection.
 */
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function generateWriteAuthz(scan: RepoScan | null, _crawl: RuntimeCrawl, hints: AuditHints, c: Counter): GeneratedCard[] {
  const cards: GeneratedCard[] = [];

  // Explicit list from hints (what the dev's agent declares as must-be-authed writes).
  const declared: WriteApi[] = [...(hints.writeApis ?? [])];

  // Plus any scan-discovered route flagged privileged AND mutating — these are
  // supposed to be guarded, so an anonymous write must be rejected.
  const seen = new Set(declared.map((w) => `${(w.method ?? "POST").toUpperCase()} ${w.path}`));
  for (const r of scan?.detail?.routes ?? []) {
    if (r.kind !== "api" || !r.privileged) continue;
    const methods = (r.methods.length ? r.methods : ["POST"]).filter((m) => MUTATING.has(m.toUpperCase()));
    for (const method of methods) {
      const key = `${method.toUpperCase()} ${r.url_path}`;
      if (!seen.has(key)) { declared.push({ path: r.url_path, method }); seen.add(key); }
    }
  }

  for (const w of declared) {
    const method = (w.method ?? "POST").toUpperCase();
    // A minimal body so the server can't reject purely on "no body"; the point
    // is to reach the auth gate, not pass schema validation.
    const body = w.body ?? { launchaudit_probe: true };
    cards.push({
      id: c.next("TC-WA"), title: `Anonymous ${method} rejected: ${w.path}`, category: "write_authz", status: "ready", risk: "critical",
      goal: "A state-changing write from an unauthenticated caller must be rejected by the server (401/403), not merely shape-validated.",
      steps: [`${method} ${w.path} with no auth`, "Expect 401 or 403", "A 200/201 means the write is OPEN; a 400/500 means auth is not the gate"],
      expectedEvidence: ["network_log"], dataNeeds: [],
      acceptanceCriteria: `Anonymous ${method} ${w.path} returns 401 or 403.`,
      exec: [{ action: "http", method, path: w.path, body, expectStatusOneOf: [401, 403] }],
    });
  }

  return cards;
}
