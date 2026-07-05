import { test } from "node:test";
import assert from "node:assert/strict";
import { generateMassAssignment } from "./mass-assignment.ts";
import { Counter, type AuditHints } from "./types.ts";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const scan = null as unknown as RepoScan | null;
const crawl = {} as unknown as RuntimeCrawl;

test("mass-assignment: honestly blocked when no object-update endpoint is discovered", () => {
  const hints: AuditHints = { postEndpoints: [{ path: "/api/lead" }] }; // not an object-update shape
  const cards = generateMassAssignment(scan, crawl, hints, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].status, "blocked");
  assert.equal(cards[0].category, "mass_assignment");
});

test("mass-assignment: an object-update endpoint yields a ready card asserting privileged fields are not echoed", () => {
  const hints: AuditHints = { writeApis: [{ path: "/api/user/profile", method: "PATCH" }] };
  const cards = generateMassAssignment(scan, crawl, hints, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].status, "ready");
  const step = cards[0].exec[0] as Record<string, unknown>;
  assert.equal(step.method, "PATCH");
  assert.equal((step.body as Record<string, unknown>).role, "admin");
  assert.ok((step.expectBodyExcludesCI as string[]).includes('"role":"admin"'));
});

test("mass-assignment: sends the captured user cookie when a 'user' role is available", () => {
  const hints: AuditHints = { writeApis: [{ path: "/api/account/settings", method: "POST" }], roles: { user: { cookie: "sid=abc" } } };
  const cards = generateMassAssignment(scan, crawl, hints, new Counter());
  assert.equal((cards[0].exec[0] as Record<string, unknown>).cookie, "sid=abc");
});
