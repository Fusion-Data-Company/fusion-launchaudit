import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * Mass-assignment / privilege escalation — OWASP API3 (BOPLA), CWE-915. Sending
 * privileged fields (role:"admin", isAdmin:true) to a normal object-update
 * endpoint must be ignored, never persisted/echoed. We only target endpoints
 * that look like object updates (user/account/profile/member/settings) to keep
 * the probe meaningful and non-destructive (privileged fields are inert junk; we
 * assert they are not reflected back as accepted).
 */
const MUTATING = new Set(["POST", "PUT", "PATCH"]);
const OBJECT_UPDATE = /(user|account|profile|member|settings|me|role)/i;
const PRIV_FIELDS = { role: "admin", isAdmin: true, is_admin: true, admin: true, launchaudit_probe: true };
const PRIV_ECHO = ['"role":"admin"', '"isadmin":true', '"is_admin":true', '"admin":true'];

export function generateMassAssignment(scan: RepoScan | null, _crawl: RuntimeCrawl, hints: AuditHints, c: Counter): GeneratedCard[] {
  const cards: GeneratedCard[] = [];
  const userCookie = hints.roles?.user?.cookie;

  const targets = new Map<string, { path: string; method: string }>();
  const add = (path: string, method?: string) => {
    const m = (method ?? "POST").toUpperCase();
    if (MUTATING.has(m) && OBJECT_UPDATE.test(path)) targets.set(`${m} ${path}`, { path, method: m });
  };
  for (const e of hints.postEndpoints ?? []) add(e.path, "POST");
  for (const w of hints.writeApis ?? []) add(w.path, (w as { method?: string }).method);
  for (const r of scan?.detail?.routes ?? []) if (r.kind === "api") for (const m of r.methods) add(r.url_path, m);

  if (targets.size === 0) {
    cards.push({
      id: c.next("TC-MASS"), title: "Mass-assignment probe found no object-update endpoint", category: "mass_assignment", status: "blocked", risk: "high",
      goal: "Confirm privileged fields (role/isAdmin) sent to an object-update endpoint are ignored.",
      steps: ["Point the audit at an app exposing a user/profile/account update endpoint", "Re-run"], expectedEvidence: ["http_transcript"], dataNeeds: ["an object-update endpoint"],
      acceptanceCriteria: "BLOCKED: no user/profile/account-style update endpoint discovered to probe for mass-assignment. (CWE-915)", exec: [],
    });
    return cards;
  }

  for (const { path, method } of targets.values()) {
    cards.push({
      id: c.next("TC-MASS"), title: `Privileged fields ignored on ${method}: ${path}`, category: "mass_assignment", status: "ready", risk: "high",
      goal: "An update endpoint must allowlist writable fields. Sending role:\"admin\"/isAdmin:true must NOT be accepted or echoed back as persisted.",
      steps: [`${method} ${path} with role:"admin", isAdmin:true${userCookie ? " as the normal 'user' role" : " (no auth)"}`, "Assert the response does not echo the privileged fields as accepted"],
      expectedEvidence: ["http_transcript"], dataNeeds: [],
      acceptanceCriteria: `${method} ${path} does not accept/echo privileged fields (role/isAdmin). OWASP API3 / CWE-915.`,
      exec: [{ action: "http", method, path, ...(userCookie ? { cookie: userCookie } : {}), body: PRIV_FIELDS, expectBodyExcludesCI: PRIV_ECHO }],
    });
  }
  return cards;
}
