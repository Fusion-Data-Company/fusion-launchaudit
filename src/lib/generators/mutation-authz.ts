import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * Function-level authorization on mutations (denied-mutation-state-change) —
 * OWASP API5 BFLA, CWE-285. A normal authenticated user attempting a privileged
 * mutation must be rejected with 401/403 BEFORE any write — the denial itself
 * proves no state change, so this is non-destructive by construction. UI-hiding
 * is not a pass: we call the endpoint directly with the user's session.
 */
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function generateMutationAuthz(scan: RepoScan | null, _crawl: RuntimeCrawl, hints: AuditHints, c: Counter): GeneratedCard[] {
  const cards: GeneratedCard[] = [];
  const userCookie = hints.roles?.user?.cookie;

  const targets = new Map<string, { path: string; method: string }>();
  const add = (path: string, method?: string) => {
    const m = (method ?? "POST").toUpperCase();
    if (MUTATING.has(m)) targets.set(`${m} ${path}`, { path, method: m });
  };
  for (const a of hints.protectedApis ?? []) add(a.path, a.method);
  for (const w of hints.writeApis ?? []) add(w.path, (w as { method?: string }).method);
  for (const r of scan?.detail?.routes ?? []) if (r.kind === "api" && r.privileged) for (const m of r.methods) add(r.url_path, m);
  if (targets.size === 0) return cards;

  if (!userCookie) {
    cards.push({
      id: c.next("TC-MUTZ"), title: "Privileged-mutation authorization needs a captured user session", category: "mutation_authz", status: "blocked", risk: "critical",
      goal: "Prove a normal user cannot perform a privileged mutation.",
      steps: ["Provide user_creds + login_path in the hints file", "Re-run"], expectedEvidence: ["http_transcript"], dataNeeds: ["a non-admin test account"],
      acceptanceCriteria: "BLOCKED: no user role captured — function-level authorization on mutations can't be proven without a low-privilege session. (CWE-285)", exec: [],
    });
    return cards;
  }

  for (const { path, method } of targets.values()) {
    cards.push({
      id: c.next("TC-MUTZ"), title: `Normal user denied privileged ${method}: ${path}`, category: "mutation_authz", status: "ready", risk: "critical",
      goal: "A privileged state-changing call by a normal authenticated user must be rejected server-side (401/403) before any write — the rejection is what proves no state change.",
      steps: [`${method} ${path} as the normal 'user' role with a minimal body`, "Expect 401 or 403 — a 2xx means a normal user can perform a privileged mutation"],
      expectedEvidence: ["http_transcript"], dataNeeds: [],
      acceptanceCriteria: `As 'user', ${method} ${path} returns 401/403 (denied before any write). OWASP API5 / CWE-285.`,
      exec: [{ action: "http", method, path, cookie: userCookie, body: { launchaudit_probe: true }, expectStatusOneOf: [401, 403] }],
    });
  }
  return cards;
}
