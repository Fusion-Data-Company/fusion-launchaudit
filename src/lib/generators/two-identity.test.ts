import { test } from "node:test";
import assert from "node:assert/strict";
import { generateTwoIdentity } from "./two-identity.ts";
import { Counter, type AuditHints } from "./types.ts";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const crawl = {} as unknown as RuntimeCrawl;
const scan = null as RepoScan | null;

test("no protected routes → no cards", () => {
  const cards = generateTwoIdentity(scan, crawl, { protectedRoutes: [] }, new Counter());
  assert.equal(cards.length, 0);
});

test("protected routes but no admin session → one BLOCKED card, honestly declared", () => {
  const cards = generateTwoIdentity(scan, crawl, { protectedRoutes: ["/admin/users/1"], roles: {} }, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].status, "blocked");
  assert.equal(cards[0].category, "privilege_gradient");
});

test("with an admin session → a two_identity card whose lower set is anon-only when no user creds", () => {
  const hints: AuditHints = { protectedRoutes: ["/admin/users/1"], roles: { admin: { cookie: "session=admin" } } };
  const cards = generateTwoIdentity(scan, crawl, hints, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].status, "ready");
  const step = cards[0].exec[0] as { action: string; adminCookie: string; lower: Array<{ role: string; cookie?: string }> };
  assert.equal(step.action, "two_identity");
  assert.equal(step.adminCookie, "session=admin");
  assert.deepEqual(step.lower.map((l) => l.role), ["anonymous"]);
});

test("with admin AND user sessions → the gradient tests anon and user", () => {
  const hints: AuditHints = { protectedRoutes: ["/admin"], roles: { admin: { cookie: "session=admin" }, user: { cookie: "session=user" } } };
  const cards = generateTwoIdentity(scan, crawl, hints, new Counter());
  const step = cards[0].exec[0] as { lower: Array<{ role: string; cookie?: string }> };
  assert.deepEqual(step.lower.map((l) => l.role), ["anonymous", "user"]);
  assert.equal(step.lower.find((l) => l.role === "user")?.cookie, "session=user");
});

test("the gradient now extends to privileged JSON APIs, not just pages", () => {
  const hints: AuditHints = {
    protectedApis: [{ path: "/api/admin/stats", method: "GET" }],
    roles: { admin: { cookie: "session=admin" } },
  };
  const cards = generateTwoIdentity(scan, crawl, hints, new Counter());
  const paths = cards.map((c) => (c.exec[0] as { path: string }).path);
  assert.ok(paths.includes("/api/admin/stats"), "privileged GET API should be in the gradient");
});

test("a write-method privileged API is NOT pulled into the read-only gradient", () => {
  const hints: AuditHints = {
    protectedApis: [{ path: "/api/admin/delete", method: "POST" }],
    roles: { admin: { cookie: "session=admin" } },
  };
  const cards = generateTwoIdentity(scan, crawl, hints, new Counter());
  assert.equal(cards.length, 0); // POST-only → not a GET gradient target
});
