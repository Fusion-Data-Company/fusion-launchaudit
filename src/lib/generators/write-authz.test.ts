import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWriteAuthz } from "./write-authz.ts";
import { Counter } from "./types.ts";
import type { RepoScan, ScannedRoute } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const crawl = {} as unknown as RuntimeCrawl; // write-authz ignores the crawl
const scanWith = (routes: ScannedRoute[]): RepoScan =>
  ({ detail: { routes }, repo_summary: { env_keys_missing: [] } } as unknown as RepoScan);
const route = (p: Partial<ScannedRoute>): ScannedRoute =>
  ({ file: "f", url_path: "/api/x", kind: "api", methods: ["POST"], privileged: false, ...p });

test("hint-declared write becomes a Tier-1 card demanding 401/403", () => {
  const cards = generateWriteAuthz(null, crawl, { writeApis: [{ path: "/api/admin/delete" }] }, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].category, "write_authz");
  assert.deepEqual((cards[0].exec[0] as Record<string, unknown>).expectStatusOneOf, [401, 403]);
});

test("a privileged scan route is Tier-1 (must reject anon writes)", () => {
  const cards = generateWriteAuthz(scanWith([route({ url_path: "/api/admin/wipe", privileged: true })]), crawl, {}, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].category, "write_authz");
});

test("an unknown-intent mutating route is Tier-2 (flag only if accepted), never claimed a bug", () => {
  const cards = generateWriteAuthz(scanWith([route({ url_path: "/api/contact" })]), crawl, {}, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].category, "write_authz_unverified");
  assert.ok((cards[0].exec[0] as Record<string, unknown>).expectStatusNot);
});

test("GET-only routes produce no write-authz card (the false-positive class)", () => {
  const cards = generateWriteAuthz(scanWith([route({ url_path: "/api/campaign", methods: ["GET"] })]), crawl, {}, new Counter());
  assert.equal(cards.length, 0);
});

test("a write declared in hints is not also emitted as an unknown-intent duplicate", () => {
  const scan = scanWith([route({ url_path: "/api/admin/delete", methods: ["POST"], privileged: true })]);
  const cards = generateWriteAuthz(scan, crawl, { writeApis: [{ path: "/api/admin/delete", method: "POST" }] }, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].category, "write_authz");
});
