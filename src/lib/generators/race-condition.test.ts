import { test } from "node:test";
import assert from "node:assert/strict";
import { generateRaceCondition } from "./race-condition.ts";
import { Counter, type AuditHints } from "./types.ts";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const crawl = {} as RuntimeCrawl;

test("no limited-action endpoints → no cards", () => {
  const hints = { roles: { user: { cookie: "u" } }, postEndpoints: [{ path: "/api/orders" }] } as AuditHints;
  assert.equal(generateRaceCondition(null, crawl, hints, new Counter()).length, 0);
});

test("a coupon/redeem endpoint with a user session → a race_probe card", () => {
  const hints = { roles: { user: { cookie: "sid=u" } }, postEndpoints: [{ path: "/api/coupon/redeem" }] } as AuditHints;
  const cards = generateRaceCondition(null, crawl, hints, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].category, "race_condition");
  const step = cards[0].exec[0] as { action: string; path: string; cookie: string; concurrency: number };
  assert.equal(step.action, "race_probe");
  assert.equal(step.path, "/api/coupon/redeem");
  assert.equal(step.cookie, "sid=u");
  assert.ok(step.concurrency >= 2);
});

test("limited-action endpoint but no user session → one honest BLOCKED card", () => {
  const hints = { writeApis: [{ path: "/api/gift/claim", method: "POST" }] } as AuditHints;
  const cards = generateRaceCondition(null, crawl, hints, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].status, "blocked");
});

test("keyword match covers transfer/withdraw/vote; ignores a plain GET-only api", () => {
  const hints = { roles: { user: { cookie: "u" } }, writeApis: [{ path: "/api/wallet/transfer", method: "POST" }] } as AuditHints;
  const scan = { detail: { routes: [{ file: "f", url_path: "/api/status", kind: "api", methods: ["GET"], privileged: false }] } } as unknown as RepoScan;
  const cards = generateRaceCondition(scan, crawl, hints, new Counter());
  const paths = cards.map((c) => (c.exec[0] as { path: string }).path);
  assert.ok(paths.includes("/api/wallet/transfer"));
  assert.ok(!paths.includes("/api/status"));
});
