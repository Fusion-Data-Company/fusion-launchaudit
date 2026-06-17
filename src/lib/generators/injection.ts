import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * Injection canaries — WSTG-INPV, CWE-89 (SQLi) / CWE-79 (XSS) / SSTI. We send
 * NON-DESTRUCTIVE canary payloads and assert on response SHAPE, never on a
 * destructive side effect:
 *   - SQLi:  `' OR '1'='1`     -> no 500, no DB/engine error text leaked
 *   - XSS:   `<svg/onload=...>`-> the raw payload is not reflected unescaped
 *   - SSTI:  `${7*191}`        -> the eval result (1337) does not appear
 * A 500 on a canary is an unhandled input path; reflected/evaluated payloads are
 * the vulnerability itself. No DROP/DELETE/UPDATE — read-only canaries only.
 */
const CANARIES = [
  { kind: "sqli", value: "' OR '1'='1", assert: { expectStatusNot: [500], expectBodyExcludesCI: ["you have an error in your sql", "sql syntax", "sqlite_error", "ora-00", "psql:", "pg::", "sqlstate"] } },
  { kind: "xss", value: "<svg/onload=alert(1)>", assert: { expectBodyExcludesCI: ["<svg/onload="] } },
  { kind: "ssti", value: "${7*191}", assert: { expectBodyExcludesCI: ["1337"] } },
] as const;

const SPRAY_FIELDS = ["q", "search", "name", "qty", "id", "value", "comment"];

export function generateInjection(scan: RepoScan | null, crawl: RuntimeCrawl, hints: AuditHints, c: Counter): GeneratedCard[] {
  const cards: GeneratedCard[] = [];

  // POST/PUT/PATCH targets (body injection)
  const postTargets = new Set<string>();
  for (const e of hints.postEndpoints ?? []) postTargets.add(e.path);
  for (const w of hints.writeApis ?? []) postTargets.add(w.path);
  for (const r of scan?.detail?.routes ?? []) if (r.kind === "api" && r.methods.some((m) => /POST|PUT|PATCH/i.test(m))) postTargets.add(r.url_path);

  // One GET query-injection target (the home page) as a baseline reflection probe.
  const getTargets = new Set<string>(["/"]);

  const mk = (target: string, method: "GET" | "POST", canary: typeof CANARIES[number]): GeneratedCard => {
    const body = method === "POST" ? Object.fromEntries(SPRAY_FIELDS.map((f) => [f, canary.value])) : undefined;
    const path = method === "GET" ? `${target}${target.includes("?") ? "&" : "?"}q=${encodeURIComponent(canary.value)}` : target;
    return {
      id: c.next("TC-INJ"), title: `No ${canary.kind.toUpperCase()} on ${method} ${target}`, category: "injection", status: "ready", risk: "high",
      goal: "Untrusted input must be validated/escaped: a canary must not 500 the server, leak a DB/engine error, or be reflected/evaluated.",
      steps: [`${method} ${target} with a ${canary.kind} canary`, "Assert: no 500, no DB error text, no unescaped reflection / template eval"],
      expectedEvidence: ["http_transcript"], dataNeeds: [],
      acceptanceCriteria: `${method} ${target} handles a ${canary.kind} canary safely (no 500/leak/reflection). WSTG-INPV / CWE-89/79.`,
      exec: [{ action: "http", method, path, ...(body ? { body } : {}), ...canary.assert }],
    };
  };

  for (const t of [...postTargets].slice(0, 5)) for (const canary of CANARIES) cards.push(mk(t, "POST", canary));
  for (const t of [...getTargets]) for (const canary of CANARIES) cards.push(mk(t, "GET", canary));
  return cards;
}
