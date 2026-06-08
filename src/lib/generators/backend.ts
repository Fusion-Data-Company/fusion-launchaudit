import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

const STACK_FRAGMENTS = ["    at ", ".js:", ".ts:", "TypeError", "ReferenceError", "    at Object", "node:internal"];

export function generateBackend(scan: RepoScan | null, crawl: RuntimeCrawl, hints: AuditHints, c: Counter): GeneratedCard[] {
  const cards: GeneratedCard[] = [];
  const base = crawl.app_url;

  // Malformed input must not 500 or leak a stack trace.
  for (const ep of hints.postEndpoints ?? []) {
    cards.push({
      id: c.next("TC-BE"), title: `Malformed input handled cleanly: POST ${ep.path}`, category: "api_contract", status: "ready", risk: "high",
      goal: "A bad request body returns a clean 4xx error, never a 500 with a stack trace.",
      steps: [`POST ${ep.path} with an empty/invalid body`, "Confirm not 500 and no stack trace leaked"],
      expectedEvidence: ["network_log"], dataNeeds: [],
      acceptanceCriteria: `POST ${ep.path} with bad input returns 4xx (not 5xx) and the body contains no stack trace.`,
      exec: [{ action: "http", method: "POST", path: ep.path, body: {}, expectStatusNot: [500, 502, 503], expectBodyExcludes: STACK_FRAGMENTS }],
    });
  }

  // Known good API endpoints reachable.
  const apiLinks = crawl.links.filter((l) => l.href.includes("/api/"));
  for (const l of apiLinks.slice(0, 4)) {
    cards.push({
      id: c.next("TC-BE"), title: `API endpoint responds: ${new URL(l.href).pathname}`, category: "api_contract", status: "ready", risk: "medium",
      goal: "A referenced API endpoint responds without a server error.",
      steps: [`GET ${l.href}`], expectedEvidence: ["network_log"], dataNeeds: [],
      acceptanceCriteria: `${l.href} returns non-5xx.`,
      exec: [{ action: "http", url: l.href, expectStatusNot: [500, 502, 503] }],
    });
  }

  return cards;
}
