import { test } from "node:test";
import assert from "node:assert/strict";
import { generateObjectAuthz } from "./object-authz.ts";
import { generateMutationAuthz } from "./mutation-authz.ts";
import { generateCors } from "./cors.ts";
import { generateCookieSecurity } from "./cookie-security.ts";
import { Counter, type AuditHints } from "./types.ts";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const scan = null as unknown as RepoScan | null;
const crawl = {} as unknown as RuntimeCrawl;
const exec0 = (c: { exec: unknown[] }) => c.exec[0] as Record<string, unknown>;

// ---- object-authz (IDOR) ----
test("IDOR: with a user session, probes an id-bearing route as that user expecting 401/403/404", () => {
  const hints: AuditHints = { protectedRoutes: ["/admin/users/42"], roles: { user: { cookie: "session=user" } } };
  const cards = generateObjectAuthz(scan, crawl, hints, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].category, "object_authz");
  assert.equal(cards[0].status, "ready");
  assert.equal(exec0(cards[0]).cookie, "session=user");
  assert.match(exec0(cards[0]).path as string, /\/admin\/users\/1$/); // id swapped to a non-owned neighbour
  assert.deepEqual(exec0(cards[0]).expectStatusOneOf, [401, 403, 404]);
});

test("IDOR: no captured user session -> honest blocked card, not a fake pass", () => {
  const cards = generateObjectAuthz(scan, crawl, { protectedRoutes: ["/admin/users/42"] }, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].status, "blocked");
});

test("IDOR: nothing id-shaped -> no cards", () => {
  const cards = generateObjectAuthz(scan, crawl, { protectedRoutes: ["/admin"], roles: { user: { cookie: "x" } } }, new Counter());
  assert.equal(cards.length, 0);
});

// ---- mutation-authz ----
test("mutation-authz: normal user probes a privileged mutation expecting 401/403", () => {
  const hints: AuditHints = { protectedApis: [{ path: "/api/admin/delete-user", method: "POST" }], roles: { user: { cookie: "session=user" } } };
  const cards = generateMutationAuthz(scan, crawl, hints, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].category, "mutation_authz");
  assert.equal(exec0(cards[0]).method, "POST");
  assert.deepEqual(exec0(cards[0]).expectStatusOneOf, [401, 403]);
});

test("mutation-authz: no user session -> blocked", () => {
  const cards = generateMutationAuthz(scan, crawl, { protectedApis: [{ path: "/api/admin/x", method: "POST" }] }, new Counter());
  assert.equal(cards[0].status, "blocked");
});

// ---- cors ----
test("cors: always probes with a hostile Origin", () => {
  const cards = generateCors(scan, crawl, {}, new Counter());
  assert.ok(cards.length >= 1);
  assert.equal(cards[0].category, "cors");
  assert.match(exec0(cards[0]).corsProbeOrigin as string, /^https:\/\//);
});

// ---- cookie-security ----
test("cookie-security: with a login probe, asserts HttpOnly/Secure/SameSite on Set-Cookie", () => {
  const hints: AuditHints = { loginProbe: { path: "/login", body: "username=u&password=p", contentType: "application/x-www-form-urlencoded" } };
  const cards = generateCookieSecurity(scan, crawl, hints, new Counter());
  assert.equal(cards[0].status, "ready");
  assert.deepEqual(exec0(cards[0]).expectCookieFlags, ["HttpOnly", "Secure", "SameSite"]);
});

test("cookie-security: no login probe -> blocked, not faked", () => {
  const cards = generateCookieSecurity(scan, crawl, {}, new Counter());
  assert.equal(cards[0].status, "blocked");
});
