import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * Race-condition / TOCTOU detector — the double-spend class standard DAST scanners miss.
 * Fires concurrent identical requests at endpoints whose name implies a single-use or
 * quota-limited action (coupon, redeem, claim, vote, transfer, withdraw, gift, promo…) and
 * flags when more than one succeeds with no rate-limit/lock. Requires a captured user
 * session (an authenticated action) so it stays meaningful; without one → BLOCKED, honest.
 * Read-mostly: only endpoints that already appear as write/post targets, matched to the
 * limited-action keyword set so we don't hammer arbitrary APIs.
 * Source: OWASP race conditions, OWASP API6:2023 (sensitive business flows).
 */

// Endpoint-name signatures of an action that is typically one-time or quota-limited.
const LIMITED_ACTION = /(coupon|promo|redeem|voucher|gift|claim|vote|like|transfer|withdraw|topup|top-up|checkout|purchase|apply|enroll|reserve|book|invite)/i;

export function generateRaceCondition(scan: RepoScan | null, _crawl: RuntimeCrawl, hints: AuditHints, c: Counter): GeneratedCard[] {
  const userCookie = hints.roles?.user?.cookie;

  const candidates = new Set<string>();
  for (const w of hints.writeApis ?? []) if (LIMITED_ACTION.test(w.path)) candidates.add(w.path);
  for (const e of hints.postEndpoints ?? []) if (LIMITED_ACTION.test(e.path)) candidates.add(e.path);
  for (const r of scan?.detail?.routes ?? []) if (r.kind === "api" && LIMITED_ACTION.test(r.url_path) && r.methods.some((m) => m !== "GET")) candidates.add(r.url_path);
  if (candidates.size === 0) return [];

  if (!userCookie) {
    return [{
      id: c.next("TC-RACE"), title: "Race-condition (TOCTOU) probe needs a captured user session", category: "race_condition", status: "blocked", risk: "high",
      goal: "Prove a single-use/quota-limited action can't be double-spent via concurrent requests.",
      steps: ["Provide user_creds + login_path in the hints file", "Re-run"],
      expectedEvidence: ["http_transcript"], dataNeeds: ["a non-admin test account"],
      acceptanceCriteria: "BLOCKED: no user session — a limited-action race can't be exercised without an authenticated caller. (OWASP race conditions / API6)", exec: [],
    }];
  }

  const cards: GeneratedCard[] = [];
  for (const path of [...candidates].slice(0, 6)) {
    cards.push({
      id: c.next("TC-RACE"), title: `No TOCTOU double-spend: ${path}`, category: "race_condition", status: "ready", risk: "high",
      goal: "A single-use/limited action must serialize concurrent requests — at most one may succeed.",
      steps: [`Fire 8 identical ${path} requests concurrently as the 'user' role`, "Expect at most one success, or a 429/lock — never all-succeed"],
      expectedEvidence: ["http_transcript"], dataNeeds: [],
      acceptanceCriteria: `Concurrent identical requests to ${path} do not all succeed (a lock/limit/unique-constraint serializes them). OWASP race conditions / API6.`,
      exec: [{ action: "race_probe", path, method: "POST", cookie: userCookie, concurrency: 8 }],
    });
  }
  return cards;
}
