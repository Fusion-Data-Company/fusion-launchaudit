import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

const CORE_HEADERS = ["x-frame-options", "x-content-type-options", "content-security-policy"];

export function generateMiddleware(scan: RepoScan | null, crawl: RuntimeCrawl, hints: AuditHints, c: Counter): GeneratedCard[] {
  const cards: GeneratedCard[] = [];
  const paths = hints.securityPaths ?? ["/"];

  for (const p of paths) {
    cards.push({
      id: c.next("TC-MW"), title: `Security headers present on ${p}`, category: "integration_side_effects", status: "ready", risk: "high",
      goal: "Core security headers (clickjacking, MIME-sniffing, content policy) are set — middleware is doing its job.",
      steps: [`GET ${p}`, "Confirm X-Frame-Options, X-Content-Type-Options, Content-Security-Policy present"],
      expectedEvidence: ["network_log"], dataNeeds: [],
      acceptanceCriteria: `${p} response includes X-Frame-Options, X-Content-Type-Options, and Content-Security-Policy.`,
      exec: [{ action: "http", path: p, expectHeaderPresent: CORE_HEADERS }],
    });
  }

  if (crawl.app_url.startsWith("https://")) {
    cards.push({
      id: c.next("TC-MW"), title: "HSTS enabled on HTTPS", category: "integration_side_effects", status: "ready", risk: "medium",
      goal: "Strict-Transport-Security is set so browsers force HTTPS.",
      steps: ["GET home over HTTPS", "Confirm Strict-Transport-Security header"],
      expectedEvidence: ["network_log"], dataNeeds: [],
      acceptanceCriteria: "Home response includes Strict-Transport-Security.",
      exec: [{ action: "http", url: crawl.app_url, expectHeaderPresent: ["strict-transport-security"] }],
    });
  }

  return cards;
}
