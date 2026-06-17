import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * Object-level authorization (IDOR / BOLA) — WSTG-ATHZ-04, CWE-639. The wedge no
 * functional-QA tool covers: a low-privilege authenticated user must NOT be able
 * to read another owner's object by swapping the id. We probe id-bearing
 * protected endpoints AS the captured `user` role against a neighbouring id; a
 * 2xx serving another owner's object is a confirmed IDOR. Non-destructive:
 * read-only (GET) id swaps only — no writes.
 */
const ID_SEG = /\/\d+(\/|$)/; // a numeric id segment (buildHints samples :id/[id] -> 42)

export function generateObjectAuthz(scan: RepoScan | null, _crawl: RuntimeCrawl, hints: AuditHints, c: Counter): GeneratedCard[] {
  const cards: GeneratedCard[] = [];
  const userCookie = hints.roles?.user?.cookie;

  const candidates = new Set<string>();
  for (const r of hints.protectedRoutes ?? []) if (ID_SEG.test(r)) candidates.add(r);
  for (const a of hints.protectedApis ?? []) if (ID_SEG.test(a.path)) candidates.add(a.path);
  for (const r of scan?.detail?.routes ?? []) if (ID_SEG.test(r.url_path)) candidates.add(r.url_path);
  if (candidates.size === 0) return cards;

  if (!userCookie) {
    cards.push({
      id: c.next("TC-IDOR"), title: "Object-level authorization (IDOR) needs a captured user session", category: "object_authz", status: "blocked", risk: "critical",
      goal: "Prove a normal user cannot read another owner's object by swapping the id.",
      steps: ["Provide user_creds + login_path in the hints file", "Re-run"], expectedEvidence: ["http_transcript"], dataNeeds: ["a non-admin test account"],
      acceptanceCriteria: "BLOCKED: no user role captured — cross-user object access can't be proven without an authenticated low-privilege session. (WSTG-ATHZ-04 / CWE-639)", exec: [],
    });
    return cards;
  }

  for (const original of candidates) {
    // Swap the id segment to a neighbour the `user` should not own (id 1 — a different owner).
    const probe = original.replace(ID_SEG, (_m, tail) => `/1${tail}`);
    cards.push({
      id: c.next("TC-IDOR"), title: `No cross-user object access: ${probe}`, category: "object_authz", status: "ready", risk: "critical",
      goal: "An authenticated normal user requesting another owner's object id must be denied (401/403/404) — never served the other owner's data.",
      steps: [`GET ${probe} as the normal 'user' role`, "Expect 401/403/404 — NOT a 200 serving another owner's object"],
      expectedEvidence: ["http_transcript"], dataNeeds: [],
      acceptanceCriteria: `As 'user', GET ${probe} is denied (401/403/404), not a 2xx with another owner's object. WSTG-ATHZ-04 / CWE-639.`,
      exec: [{ action: "http", method: "GET", path: probe, cookie: userCookie, expectStatusOneOf: [401, 403, 404] }],
    });
  }
  return cards;
}
