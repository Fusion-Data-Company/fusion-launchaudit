import { test } from "node:test";
import assert from "node:assert/strict";
import { generateMassAssignment } from "./mass-assignment.ts";
import { generateTlsHsts } from "./tls-hsts.ts";
import { generateInjection } from "./injection.ts";
import { Counter, type AuditHints } from "./types.ts";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const scan = null as unknown as RepoScan | null;
const crawl = (appUrl = "") => ({ app_url: appUrl } as unknown as RuntimeCrawl);
const exec0 = (c: { exec: unknown[] }) => c.exec[0] as Record<string, unknown>;

// ---- mass-assignment ----
test("mass-assignment: probes an object-update endpoint and asserts privileged fields aren't echoed", () => {
  const hints: AuditHints = { postEndpoints: [{ path: "/api/account/update" }], roles: { user: { cookie: "session=user" } } };
  const cards = generateMassAssignment(scan, crawl(), hints, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].status, "ready");
  assert.ok((exec0(cards[0]).expectBodyExcludesCI as string[]).some((s) => s.includes("isadmin")));
});

test("mass-assignment: no object-update endpoint -> honest blocked card", () => {
  const cards = generateMassAssignment(scan, crawl(), { postEndpoints: [{ path: "/api/orders" }] }, new Counter());
  assert.equal(cards[0].status, "blocked");
});

// ---- tls-hsts ----
test("tls-hsts: http/localhost target is blocked, not failed", () => {
  const cards = generateTlsHsts(scan, crawl("http://127.0.0.1:4400"), {}, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].status, "blocked");
});

test("tls-hsts: https target gets HSTS + http->https redirect checks", () => {
  const cards = generateTlsHsts(scan, crawl("https://example.com"), {}, new Counter());
  assert.equal(cards.length, 2);
  assert.ok(cards.every((c) => c.status === "ready" && c.category === "tls_hsts"));
  assert.deepEqual(exec0(cards[0]).expectHeaderPresent, ["strict-transport-security"]);
});

// ---- injection ----
test("injection: a POST endpoint gets sqli/xss/ssti canary cards with shape assertions", () => {
  const cards = generateInjection(scan, crawl(), { postEndpoints: [{ path: "/api/orders" }] }, new Counter());
  // 3 canaries x (1 post target + 1 GET home) = 6
  assert.equal(cards.length, 6);
  assert.ok(cards.every((c) => c.category === "injection"));
  const sqli = cards.find((c) => c.title.includes("SQLI"))!;
  assert.deepEqual(exec0(sqli).expectStatusNot, [500]);
});
