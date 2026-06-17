import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * Transport security — HSTS + http->https redirect. Catalog 07 (OWASP Secure
 * Headers / Mozilla TLS guidance). HSTS (Strict-Transport-Security) tells
 * browsers to refuse http; the site should also redirect http->https. These only
 * mean something for an https deployment — on an http/localhost target they are
 * declared blocked, never failed (honest).
 */
function isHttps(url: string): boolean { return /^https:\/\//i.test(url); }
function isLocal(url: string): boolean { return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?/i.test(url); }

export function generateTlsHsts(_scan: RepoScan | null, crawl: RuntimeCrawl, _hints: AuditHints, c: Counter): GeneratedCard[] {
  const url = crawl.app_url ?? "";

  if (!isHttps(url) || isLocal(url)) {
    return [{
      id: c.next("TC-TLS"), title: "TLS/HSTS checks apply to an https deployment", category: "tls_hsts", status: "blocked", risk: "medium",
      goal: "Confirm HSTS is present and http redirects to https.",
      steps: ["Audit the deployed https URL (not an http/localhost target)"], expectedEvidence: ["http_transcript"], dataNeeds: ["the production https URL"],
      acceptanceCriteria: `BLOCKED: target is ${url || "unset"} — HSTS and http->https redirect are only meaningful for an https deployment.`, exec: [],
    }];
  }

  const httpUrl = url.replace(/^https:/i, "http:");
  return [
    {
      id: c.next("TC-TLS"), title: "HSTS (Strict-Transport-Security) is present", category: "tls_hsts", status: "ready", risk: "medium",
      goal: "Without HSTS, a browser will still try http first and can be downgraded/MITM'd before the redirect.",
      steps: ["GET / over https", "Expect a Strict-Transport-Security response header"], expectedEvidence: ["http_transcript"], dataNeeds: [],
      acceptanceCriteria: "Response carries Strict-Transport-Security. OWASP Secure Headers / Mozilla TLS.",
      exec: [{ action: "http", method: "GET", path: "/", expectHeaderPresent: ["strict-transport-security"] }],
    },
    {
      id: c.next("TC-TLS"), title: "http redirects to https", category: "tls_hsts", status: "ready", risk: "medium",
      goal: "Plain http must not serve content — it must redirect to https so credentials/cookies never travel in cleartext.",
      steps: [`GET ${httpUrl}/`, "Expect a 301/308 redirect whose Location is https"], expectedEvidence: ["http_transcript"], dataNeeds: [],
      acceptanceCriteria: "http requests 301/308-redirect to https.",
      exec: [{ action: "http", method: "GET", url: `${httpUrl}/`, expectStatusOneOf: [301, 307, 308], expectHeaderValueOneOf: { location: ["https://"] } }],
    },
  ];
}
