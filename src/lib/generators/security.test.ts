import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSecurity } from "./security.ts";
import { Counter, type AuditHints } from "./types.ts";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const scan = null as unknown as RepoScan | null;
const crawl = {} as unknown as RuntimeCrawl;

test("security: per path emits header-quality, CSP, and COOP cards plus the secret-file probes", () => {
  const cards = generateSecurity(scan, crawl, {}, new Counter());
  // 3 header cards for "/" + 5 secret/VCS file cards.
  assert.equal(cards.filter((c) => c.category === "security_headers").length, 3);
  assert.equal(cards.filter((c) => c.category === "secrets_exposure").length, 5);
});

test("security: hardening card asserts safe header VALUES and absence of the X-Powered-By banner", () => {
  const cards = generateSecurity(scan, crawl, {}, new Counter());
  const hardening = cards.find((c) => c.title.startsWith("Hardening headers carry safe values"))!;
  const step = hardening.exec[0] as Record<string, unknown>;
  assert.deepEqual(step.expectHeaderPresent, ["referrer-policy", "permissions-policy"]);
  assert.deepEqual(step.expectHeaderAbsent, ["x-powered-by"]);
  const oneOf = step.expectHeaderValueOneOf as Record<string, string[]>;
  assert.deepEqual(oneOf["x-content-type-options"], ["nosniff"]);
});

test("security: the .env secret-file probe asserts the body excludes real-secret markers", () => {
  const cards = generateSecurity(scan, crawl, {}, new Counter());
  const envCard = cards.find((c) => c.title.includes("/.env") && !c.title.includes(".env.local") && !c.title.includes(".env.production"))!;
  const step = envCard.exec[0] as Record<string, unknown>;
  assert.equal(step.path, "/.env");
  assert.ok((step.expectBodyExcludes as string[]).includes("postgres://"));
});

test("security: multiple securityPaths multiply the header cards", () => {
  const hints: AuditHints = { securityPaths: ["/", "/app"] };
  const cards = generateSecurity(scan, crawl, hints, new Counter());
  assert.equal(cards.filter((c) => c.category === "security_headers").length, 6); // 3 per path
});
