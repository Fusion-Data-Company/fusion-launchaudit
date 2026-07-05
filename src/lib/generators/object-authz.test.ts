import { test } from "node:test";
import assert from "node:assert/strict";
import { generateObjectAuthz } from "./object-authz.ts";
import { Counter, type AuditHints } from "./types.ts";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const scan = null as unknown as RepoScan | null;
const crawl = {} as unknown as RuntimeCrawl;

test("object-authz: no id-bearing routes means no cards", () => {
  const hints: AuditHints = { protectedApis: [{ path: "/api/profile" }] }; // no numeric id segment
  const cards = generateObjectAuthz(scan, crawl, hints, new Counter());
  assert.equal(cards.length, 0);
});

test("object-authz: id-bearing routes but no user session -> honestly blocked", () => {
  const hints: AuditHints = { protectedApis: [{ path: "/api/orders/42" }] };
  const cards = generateObjectAuthz(scan, crawl, hints, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].status, "blocked");
  assert.equal(cards[0].category, "object_authz");
});

test("object-authz: with a user session, the id is swapped to a neighbour and cross-user access must be denied", () => {
  const hints: AuditHints = { protectedApis: [{ path: "/api/orders/42" }], roles: { user: { cookie: "sid=abc" } } };
  const cards = generateObjectAuthz(scan, crawl, hints, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].status, "ready");
  const step = cards[0].exec[0] as Record<string, unknown>;
  assert.equal(step.method, "GET");
  assert.equal(step.path, "/api/orders/1", "id segment swapped to a different owner");
  assert.equal(step.cookie, "sid=abc");
  assert.deepEqual(step.expectStatusOneOf, [401, 403, 404]);
});
