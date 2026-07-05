import { test } from "node:test";
import assert from "node:assert/strict";
import { generateInjection } from "./injection.ts";
import { Counter, type AuditHints } from "./types.ts";
import type { RepoScan, ScannedRoute } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const crawl = {} as unknown as RuntimeCrawl;
const scanWith = (routes: ScannedRoute[]): RepoScan => ({ detail: { routes } } as unknown as RepoScan);
const route = (p: Partial<ScannedRoute>): ScannedRoute =>
  ({ file: "f", url_path: "/api/x", kind: "api", methods: ["POST"], privileged: false, ...p });

test("injection: always sprays the three canaries against a GET '/' baseline", () => {
  const cards = generateInjection(null, crawl, {}, new Counter());
  assert.equal(cards.length, 3, "3 canaries x 1 GET target");
  assert.ok(cards.every((c) => c.category === "injection"));
  for (const kind of ["SQLI", "XSS", "SSTI"]) {
    assert.ok(cards.some((c) => c.title.includes(kind)), `expected a ${kind} card`);
  }
});

test("injection: the SQLi canary asserts no 500 and no leaked DB error text", () => {
  const cards = generateInjection(null, crawl, {}, new Counter());
  const sqli = cards.find((c) => c.title.includes("SQLI") && c.title.includes("GET"))!;
  const step = sqli.exec[0] as Record<string, unknown>;
  assert.deepEqual(step.expectStatusNot, [500]);
  assert.ok((step.expectBodyExcludesCI as string[]).some((s) => s.includes("sql syntax")));
  assert.ok((step.path as string).includes("q="), "GET target injects via the q query param");
});

test("injection: POST targets from hints add body-injection cards (3 canaries each)", () => {
  const hints: AuditHints = { postEndpoints: [{ path: "/api/search" }] };
  const cards = generateInjection(scanWith([]), crawl, hints, new Counter());
  const postCards = cards.filter((c) => c.title.includes("POST /api/search"));
  assert.equal(postCards.length, 3);
  const xss = postCards.find((c) => c.title.includes("XSS"))!;
  assert.ok((xss.exec[0] as Record<string, unknown>).body, "POST injection carries a sprayed body");
});
