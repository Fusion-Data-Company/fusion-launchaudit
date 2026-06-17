import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * Session-cookie hardening — CWE-1004 (missing HttpOnly), CWE-614 (missing
 * Secure), plus SameSite for CSRF defense. We re-run the login probe and inspect
 * the LIVE Set-Cookie attributes (not a guess). Requires a login probe
 * (user_creds + login_path in hints); otherwise honestly blocked.
 */
export function generateCookieSecurity(_scan: RepoScan | null, _crawl: RuntimeCrawl, hints: AuditHints, c: Counter): GeneratedCard[] {
  const probe = hints.loginProbe;
  if (!probe) {
    return [{
      id: c.next("TC-COOKIE"), title: "Session-cookie flags need a login probe", category: "cookie_security", status: "blocked", risk: "high",
      goal: "Verify the session cookie carries HttpOnly, Secure, and SameSite.",
      steps: ["Provide user_creds + login_path in the hints file so a login can be triggered", "Re-run"], expectedEvidence: ["http_transcript"], dataNeeds: ["test credentials + login path"],
      acceptanceCriteria: "BLOCKED: no login probe available to trigger and inspect a real Set-Cookie. (CWE-1004 / CWE-614)", exec: [],
    }];
  }
  return [{
    id: c.next("TC-COOKIE"), title: "Session cookie carries HttpOnly, Secure, and SameSite", category: "cookie_security", status: "ready", risk: "high",
    goal: "Without HttpOnly the session cookie is JS-readable (XSS theft); without Secure it can leak over http; without SameSite it is exposed to CSRF.",
    steps: [`POST ${probe.path} (login) to obtain a session cookie`, "Inspect Set-Cookie for HttpOnly, Secure, and SameSite"],
    expectedEvidence: ["http_transcript"], dataNeeds: [],
    acceptanceCriteria: "The session Set-Cookie includes HttpOnly, Secure, and SameSite. CWE-1004 / CWE-614.",
    exec: [{ action: "http", method: "POST", path: probe.path, headers: { "content-type": probe.contentType }, body: probe.body, expectCookieFlags: ["HttpOnly", "Secure", "SameSite"] }],
  }];
}
