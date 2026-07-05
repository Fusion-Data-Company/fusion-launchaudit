import { test } from "node:test";
import assert from "node:assert/strict";
import { generateBackend } from "./backend.ts";
import { Counter, type AuditHints } from "./types.ts";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const scan = null as unknown as RepoScan | null;
const crawlOf = (links: string[]): RuntimeCrawl =>
  ({ app_url: "https://api.test", title: "t", links: links.map((href) => ({ href, text: "x" })), form_count: 0, button_count: 0, has_password_field: false, console_errors_on_load: 0, crawled_at: "now" } as RuntimeCrawl);

test("backend: a declared POST endpoint yields a malformed-input card demanding non-5xx and no stack trace", () => {
  const hints: AuditHints = { postEndpoints: [{ path: "/api/lead" }] };
  const cards = generateBackend(scan, crawlOf([]), hints, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].category, "api_contract");
  const step = cards[0].exec[0] as Record<string, unknown>;
  assert.equal(step.method, "POST");
  assert.deepEqual(step.expectStatusNot, [500, 502, 503]);
  assert.ok(Array.isArray(step.expectBodyExcludes) && (step.expectBodyExcludes as string[]).includes("TypeError"));
});

test("backend: /api/ links become endpoint-responds cards (capped at 4)", () => {
  const cards = generateBackend(scan, crawlOf([
    "https://api.test/api/a", "https://api.test/api/b", "https://api.test/api/c",
    "https://api.test/api/d", "https://api.test/api/e", "https://api.test/about",
  ]), {}, new Counter());
  const apiCards = cards.filter((c) => c.title.startsWith("API endpoint responds:"));
  assert.equal(apiCards.length, 4, "api link cards capped at 4; non-/api/ links ignored");
});

test("backend: emits nothing when there are no post endpoints and no /api/ links", () => {
  const cards = generateBackend(scan, crawlOf(["https://api.test/about", "https://api.test/pricing"]), {}, new Counter());
  assert.equal(cards.length, 0);
});
