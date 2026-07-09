import { test } from "node:test";
import assert from "node:assert/strict";
import { generateDataExposure } from "./data-exposure.ts";
import type { AuditHints, Counter } from "./types.ts";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

function counter(): Counter {
  let n = 0;
  return { next: (p: string) => `${p}-${++n}` } as unknown as Counter;
}
const crawl = {} as RuntimeCrawl;
const scanWith = (routes: RepoScan["detail"]["routes"]): RepoScan => ({
  repo_summary: {} as RepoScan["repo_summary"],
  detail: { repo_path: "/x", scanned_at: "", framework_evidence: [], test_tooling: [], test_file_count: 0, route_files_sampled: [], routes, env_sources: [], files_walked: 0, truncated: false },
});

test("no candidate endpoints → no cards", () => {
  const cards = generateDataExposure(scanWith([]), crawl, {} as AuditHints, counter());
  assert.equal(cards.length, 0);
});

test("candidates but no user session → one honest BLOCKED card", () => {
  const hints = { protectedApis: [{ path: "/api/users/42", method: "GET" }] } as AuditHints;
  const cards = generateDataExposure(null, crawl, hints, counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].status, "blocked");
  assert.equal(cards[0].category, "data_exposure");
});

test("with a user session → ready cards that assert NEVER-EXPOSE properties are absent", () => {
  const hints = { roles: { user: { cookie: "sid=u" } }, protectedApis: [{ path: "/api/users/42", method: "GET" }] } as AuditHints;
  const cards = generateDataExposure(null, crawl, hints, counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].status, "ready");
  const step = cards[0].exec[0] as { action: string; method: string; cookie: string; expectBodyExcludesCI: string[] };
  assert.equal(step.action, "http");
  assert.equal(step.method, "GET");
  assert.equal(step.cookie, "sid=u");
  // Asserts the classic credential/secret/PII property names.
  assert.ok(step.expectBodyExcludesCI.includes('"password"'));
  assert.ok(step.expectBodyExcludesCI.includes('"ssn"'));
  assert.ok(step.expectBodyExcludesCI.includes('"card_number"'));
});

test("id-bearing protected routes and GET APIs from the repo scan are candidates", () => {
  const hints = { roles: { user: { cookie: "sid=u" } }, protectedRoutes: ["/account/1234"] } as AuditHints;
  const cards = generateDataExposure(
    scanWith([{ file: "a", url_path: "/api/orders/7", kind: "api", methods: ["GET"], privileged: false }]),
    crawl, hints, counter(),
  );
  const paths = cards.map((c) => (c.exec[0] as { path: string }).path).sort();
  assert.deepEqual(paths, ["/account/1234", "/api/orders/7"]);
});

test("a write-only API (no GET) is not probed for read exposure", () => {
  const hints = { roles: { user: { cookie: "sid=u" } } } as AuditHints;
  const cards = generateDataExposure(
    scanWith([{ file: "a", url_path: "/api/delete", kind: "api", methods: ["DELETE"], privileged: false }]),
    crawl, hints, counter(),
  );
  assert.equal(cards.length, 0);
});
