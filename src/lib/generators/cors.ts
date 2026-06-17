import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * CORS misconfiguration — CWE-942. Reflecting an arbitrary Origin in
 * Access-Control-Allow-Origin together with Access-Control-Allow-Credentials:
 * true lets ANY site make authenticated cross-origin requests and read the
 * response. We send a hostile Origin and assert it isn't reflected with creds.
 * Always runnable — no auth needed.
 */
const PROBE_ORIGIN = "https://launchaudit-cors-probe.example";

export function generateCors(scan: RepoScan | null, _crawl: RuntimeCrawl, hints: AuditHints, c: Counter): GeneratedCard[] {
  const paths = new Set<string>(["/"]);
  for (const a of hints.protectedApis ?? []) paths.add(a.path);
  for (const e of hints.postEndpoints ?? []) paths.add(e.path);
  for (const r of scan?.detail?.routes ?? []) if (r.kind === "api") paths.add(r.url_path);

  return [...paths].slice(0, 8).map((p) => ({
    id: c.next("TC-CORS"), title: `CORS does not reflect a hostile Origin with credentials: ${p}`, category: "cors", status: "ready", risk: "high",
    goal: "An arbitrary Origin must not be echoed in Access-Control-Allow-Origin together with Access-Control-Allow-Credentials: true.",
    steps: [`GET ${p} with Origin: ${PROBE_ORIGIN}`, "Assert the probe Origin is NOT reflected back with credentials enabled"],
    expectedEvidence: ["http_transcript"], dataNeeds: [],
    acceptanceCriteria: `${p} does not reflect an arbitrary Origin with Access-Control-Allow-Credentials: true. CWE-942.`,
    exec: [{ action: "http", method: "GET", path: p, corsProbeOrigin: PROBE_ORIGIN }],
  }));
}
