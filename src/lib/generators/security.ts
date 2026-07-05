import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * Deep security surface beyond TestSprite's reach: header *quality* (not just
 * presence), tech-banner leakage, and publicly-served secret/VCS files. All
 * checks are anonymous GETs — no creds, no state change.
 */

// Files that must never be downloadable. Markers prove a real leak (vs a 404 page).
const SECRET_FILES: Array<{ path: string; markers: string[] }> = [
  { path: "/.env", markers: ["_KEY=", "_SECRET", "SECRET=", "PASSWORD=", "postgres://", "mongodb://", "redis://", "sk_live_", "BEGIN PRIVATE KEY", "BEGIN RSA"] },
  { path: "/.env.local", markers: ["_KEY=", "_SECRET", "SECRET=", "PASSWORD=", "postgres://", "sk_live_", "BEGIN PRIVATE KEY"] },
  { path: "/.env.production", markers: ["_KEY=", "_SECRET", "SECRET=", "PASSWORD=", "postgres://", "sk_live_", "BEGIN PRIVATE KEY"] },
  { path: "/.git/config", markers: ["[core]", "[remote ", "url = "] },
  { path: "/.git/HEAD", markers: ["ref: refs/"] },
];

export function generateSecurity(_scan: RepoScan | null, _crawl: RuntimeCrawl, hints: AuditHints, c: Counter): GeneratedCard[] {
  const cards: GeneratedCard[] = [];
  const paths = hints.securityPaths ?? ["/"];

  for (const p of paths) {
    cards.push({
      id: c.next("TC-SEC"), title: `Hardening headers carry safe values: ${p}`, category: "security_headers", status: "ready", risk: "high",
      goal: "Beyond presence — protective headers must carry safe values, and no banner should leak the stack.",
      steps: [`GET ${p}`, "Referrer-Policy + Permissions-Policy present", "X-Content-Type-Options = nosniff", "X-Frame-Options = DENY/SAMEORIGIN", "no X-Powered-By banner"],
      expectedEvidence: ["network_log"], dataNeeds: [],
      acceptanceCriteria: `${p} sets Referrer-Policy and Permissions-Policy; X-Content-Type-Options is "nosniff"; X-Frame-Options is DENY or SAMEORIGIN; no X-Powered-By header.`,
      exec: [{
        action: "http", path: p,
        expectHeaderPresent: ["referrer-policy", "permissions-policy"],
        expectHeaderValueOneOf: { "x-content-type-options": ["nosniff"], "x-frame-options": ["deny", "sameorigin"] },
        expectHeaderAbsent: ["x-powered-by"],
      }],
    });

    // Defense-in-depth (Content-Security-Policy). Absence or an unsafe-inline/
    // unsafe-eval directive is a real XSS-mitigation gap on a public app — but
    // context-dependent (an internal tool/static page may not need it), so a
    // failure here is classified needs_verification, never an over-claimed bug.
    cards.push({
      id: c.next("TC-SEC"), title: `Content-Security-Policy present and not permissive: ${p}`, category: "security_headers", status: "ready", risk: "medium",
      goal: "A CSP is the strongest in-browser XSS mitigation; if present it should not weaken itself with 'unsafe-inline'/'unsafe-eval'.",
      steps: [`GET ${p}`, "Content-Security-Policy header present", "CSP does not contain 'unsafe-inline' or 'unsafe-eval'"],
      expectedEvidence: ["network_log"], dataNeeds: [],
      acceptanceCriteria: `${p} sets a Content-Security-Policy that does not use 'unsafe-inline' or 'unsafe-eval'.`,
      exec: [{
        action: "http", path: p,
        expectHeaderRecommended: ["content-security-policy"],
        expectHeaderExcludesTokens: { "content-security-policy": ["unsafe-inline", "unsafe-eval"] },
      }],
    });

    // Cross-Origin-Opener-Policy (XS-Leak / tabnabbing isolation). Recommended,
    // not universal → also needs_verification on absence.
    cards.push({
      id: c.next("TC-SEC"), title: `Cross-Origin-Opener-Policy isolates the browsing context: ${p}`, category: "security_headers", status: "ready", risk: "low",
      goal: "Cross-Origin-Opener-Policy severs the opener relationship, mitigating cross-window (XS-Leak / tabnabbing) attacks.",
      steps: [`GET ${p}`, "Cross-Origin-Opener-Policy header present (same-origin or same-origin-allow-popups)"],
      expectedEvidence: ["network_log"], dataNeeds: [],
      acceptanceCriteria: `${p} sets a Cross-Origin-Opener-Policy header.`,
      exec: [{ action: "http", path: p, expectHeaderRecommended: ["cross-origin-opener-policy"] }],
    });
  }

  for (const f of SECRET_FILES) {
    cards.push({
      id: c.next("TC-SEC"), title: `Secret/VCS file not publicly served: ${f.path}`, category: "secrets_exposure", status: "ready", risk: "critical",
      goal: "Config, secret, and version-control files must never be downloadable by the public.",
      steps: [`GET ${f.path}`, "Confirm the response is not the real secret/config content"],
      expectedEvidence: ["network_log"], dataNeeds: [],
      acceptanceCriteria: `GET ${f.path} does not return real secret or VCS content.`,
      exec: [{ action: "http", path: f.path, expectBodyExcludes: f.markers }],
    });
  }

  return cards;
}
