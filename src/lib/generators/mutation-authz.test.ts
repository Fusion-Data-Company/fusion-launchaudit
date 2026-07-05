import { test } from "node:test";
import assert from "node:assert/strict";
import { generateMutationAuthz } from "./mutation-authz.ts";
import { Counter, type AuditHints } from "./types.ts";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const scan = null as unknown as RepoScan | null;
const crawl = {} as unknown as RuntimeCrawl;

test("mutation-authz: no mutating targets means no cards at all", () => {
  const cards = generateMutationAuthz(scan, crawl, {}, new Counter());
  assert.equal(cards.length, 0);
});

test("mutation-authz: targets but no captured user session -> honestly blocked", () => {
  const hints: AuditHints = { protectedApis: [{ path: "/api/admin/delete", method: "POST" }] };
  const cards = generateMutationAuthz(scan, crawl, hints, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].status, "blocked");
  assert.equal(cards[0].category, "mutation_authz");
});

test("mutation-authz: with a user session, a ready card requires the privileged mutation to be denied 401/403", () => {
  const hints: AuditHints = { protectedApis: [{ path: "/api/admin/delete", method: "POST" }], roles: { user: { cookie: "sid=abc" } } };
  const cards = generateMutationAuthz(scan, crawl, hints, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].status, "ready");
  const step = cards[0].exec[0] as Record<string, unknown>;
  assert.equal(step.method, "POST");
  assert.equal(step.cookie, "sid=abc");
  assert.deepEqual(step.expectStatusOneOf, [401, 403]);
});
