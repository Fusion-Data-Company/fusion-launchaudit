import { test } from "node:test";
import assert from "node:assert/strict";
import { generateCookieSecurity } from "./cookie-security.ts";
import { Counter, type AuditHints } from "./types.ts";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const scan = null as unknown as RepoScan | null;
const crawl = {} as unknown as RuntimeCrawl;

test("cookie-security: honestly blocked when no login probe is available", () => {
  const cards = generateCookieSecurity(scan, crawl, {}, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].status, "blocked");
  assert.equal(cards[0].category, "cookie_security");
  assert.equal(cards[0].exec.length, 0);
});

test("cookie-security: with a login probe, a ready card inspects live Set-Cookie flags", () => {
  const hints: AuditHints = { loginProbe: { path: "/api/login", body: "{}", contentType: "application/json" } };
  const cards = generateCookieSecurity(scan, crawl, hints, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].status, "ready");
  const step = cards[0].exec[0] as Record<string, unknown>;
  assert.equal(step.method, "POST");
  assert.equal(step.path, "/api/login");
  assert.deepEqual(step.expectCookieFlags, ["HttpOnly", "Secure", "SameSite"]);
});
