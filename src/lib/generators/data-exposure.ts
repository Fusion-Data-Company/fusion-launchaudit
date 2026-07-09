import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * Sensitive-property / excessive-data exposure — the READ side of the property-level
 * authorization story (OWASP API3:2023 Broken Object Property Level Authorization +
 * API6/legacy "Excessive Data Exposure", CWE-213/CWE-359). mass-assignment covers the
 * WRITE side (privileged fields must not be accepted); this covers the READ side: a
 * JSON response reaching a low-privilege identity must NEVER carry credential/secret/PII
 * properties (passwordHash, ssn, apiKey, …). Non-destructive: GET-only.
 *
 * We assert against the NEVER-EXPOSE set only — properties that have no legitimate reason
 * to appear in any client response — so a hit is a confirmed leak, not a judgement call.
 * Requires an authenticated low-privilege session (user); without it → BLOCKED, honest.
 */

// Property NAMES (as they appear quoted in JSON) that must never reach a client.
// Case-insensitive; matched as the response-body token `"key"`.
const NEVER_EXPOSE = [
  '"password"', '"passwordhash"', '"password_hash"', '"passwd"',
  '"ssn"', '"socialsecurity"', '"social_security"',
  '"secret"', '"clientsecret"', '"client_secret"',
  '"apikey"', '"api_key"', '"privatekey"', '"private_key"',
  '"creditcard"', '"credit_card"', '"card_number"', '"cardnumber"', '"cvv"', '"cvc"',
  '"sessionsecret"', '"refreshtoken"', '"refresh_token"',
];

const ID_SEG = /\/\d+(\/|$)/;

export function generateDataExposure(scan: RepoScan | null, _crawl: RuntimeCrawl, hints: AuditHints, c: Counter): GeneratedCard[] {
  const cards: GeneratedCard[] = [];
  const userCookie = hints.roles?.user?.cookie;

  // Candidate JSON endpoints: privileged/protected APIs + id-bearing API/object routes.
  const candidates = new Set<string>();
  for (const a of hints.protectedApis ?? []) if (!a.method || a.method === "GET") candidates.add(a.path);
  for (const a of hints.protectedRoutes ?? []) if (ID_SEG.test(a)) candidates.add(a);
  for (const r of scan?.detail?.routes ?? []) if (r.kind === "api" && r.methods.includes("GET")) candidates.add(r.url_path);
  if (candidates.size === 0) return cards;

  if (!userCookie) {
    cards.push({
      id: c.next("TC-EXPO"), title: "Sensitive-property exposure needs a captured user session", category: "data_exposure", status: "blocked", risk: "high",
      goal: "Prove a low-privilege user's API responses never carry credential/secret/PII properties.",
      steps: ["Provide user_creds + login_path in the hints file", "Re-run"],
      expectedEvidence: ["http_transcript"], dataNeeds: ["a non-admin test account"],
      acceptanceCriteria: "BLOCKED: no user role captured — response property exposure can't be confirmed without an authenticated low-privilege session. (OWASP API3:2023 / CWE-213)", exec: [],
    });
    return cards;
  }

  for (const path of [...candidates].slice(0, 12)) {
    cards.push({
      id: c.next("TC-EXPO"), title: `No sensitive properties in response: ${path}`, category: "data_exposure", status: "ready", risk: "high",
      goal: "An authenticated normal user's JSON response must not include credential/secret/PII property names.",
      steps: [`GET ${path} as the normal 'user' role`, "Assert the JSON body carries no password/ssn/apiKey/card_number/… properties"],
      expectedEvidence: ["http_transcript"], dataNeeds: [],
      acceptanceCriteria: `As 'user', GET ${path} returns no NEVER-EXPOSE property (${NEVER_EXPOSE.length} checked). OWASP API3:2023 (BOPLA read) / API6 excessive data exposure / CWE-213.`,
      exec: [{ action: "http", method: "GET", path, cookie: userCookie, expectBodyExcludesCI: NEVER_EXPOSE }],
    });
  }
  return cards;
}
