import { test } from "node:test";
import assert from "node:assert/strict";
import { generateApiBackend, generateMarketing, generateBlogCms } from "./platform-checks.ts";
import { Counter, type AuditHints } from "./types.ts";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const scan = null as unknown as RepoScan | null;
const crawlOf = (links: string[] = []): RuntimeCrawl =>
  ({ app_url: "https://x.test", title: "X", links: links.map((href) => ({ href, text: "x" })), form_count: 0, button_count: 2, has_password_field: false, console_errors_on_load: 0, crawled_at: "now" } as RuntimeCrawl);
const has = (cards: { exec: unknown[] }[], pred: (e: Record<string, unknown>) => boolean) => cards.some((c) => c.exec.some((e) => pred(e as Record<string, unknown>)));

test("api_backend: probes unknown-route 404, JSON-not-HTML errors, and wrong-method rejection", () => {
  const cards = generateApiBackend(scan, crawlOf(), { protectedApis: [{ path: "/api/items", method: "GET" }] }, new Counter());
  assert.ok(cards.every((c) => c.category === "api_contract"));
  assert.ok(has(cards, (e) => Array.isArray(e.expectStatusOneOf) && (e.expectStatusOneOf as number[]).includes(404)));
  assert.ok(has(cards, (e) => Array.isArray(e.expectBodyExcludes) && (e.expectBodyExcludes as string[]).includes("<html")));
  assert.ok(cards.some((c) => c.title.includes("Wrong HTTP method") && c.status === "ready"));
});

test("api_backend: no known API route -> method check is honestly blocked", () => {
  const cards = generateApiBackend(scan, crawlOf(), {}, new Counter());
  assert.ok(cards.some((c) => c.status === "blocked" && c.title.toLowerCase().includes("method-handling")));
});

test("marketing: soft-404 check + a CTA-present browser card", () => {
  const cards = generateMarketing(scan, crawlOf(), {}, new Counter());
  assert.ok(has(cards, (e) => e.action === "http" && Array.isArray(e.expectStatusOneOf) && (e.expectStatusOneOf as number[]).includes(404)));
  assert.ok(has(cards, (e) => e.action === "expect_visible"));
});

test("marketing: a discovered conversion path is checked; none -> blocked", () => {
  const withContact = generateMarketing(scan, crawlOf(["https://x.test/contact"]), {}, new Counter());
  assert.ok(withContact.some((c) => c.title.includes("Conversion path loads") && c.status === "ready"));
  const without = generateMarketing(scan, crawlOf(["https://x.test/about"]), {}, new Counter());
  assert.ok(without.some((c) => c.status === "blocked"));
});

test("blog_cms: robots.txt, well-formed sitemap, and soft-404 post checks", () => {
  const cards = generateBlogCms(scan, crawlOf(), {}, new Counter());
  assert.ok(cards.some((c) => c.title.includes("robots.txt")));
  assert.ok(has(cards, (e) => (e.expectBodyIncludesAny as { needles?: string[] })?.needles?.includes("<urlset") ?? false));
  assert.ok(has(cards, (e) => Array.isArray(e.expectStatusOneOf) && (e.expectStatusOneOf as number[]).includes(404)));
});
