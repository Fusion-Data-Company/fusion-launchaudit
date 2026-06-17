import { test } from "node:test";
import assert from "node:assert/strict";
import { generateApiBackend, generateMarketing, generateBlogCms, generateEcommerce, generateWebApp, generateInternalTool, generateMobile, generateBrowserExtension, generateAiVoice } from "./platform-checks.ts";
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

test("ecommerce: product + checkout (with payment provider) when present, else blocked", () => {
  const cards = generateEcommerce(scan, crawlOf(["https://x.test/product/1", "https://x.test/checkout"]), {}, new Counter());
  assert.ok(cards.some((c) => c.title.includes("Product / catalog") && c.status === "ready"));
  assert.ok(has(cards, (e) => (e.expectBodyIncludesAny as { needles?: string[] })?.needles?.some((n) => n.includes("stripe")) ?? false));
  const bare = generateEcommerce(scan, crawlOf([]), {}, new Counter());
  assert.ok(bare.filter((c) => c.status === "blocked").length >= 2);
});

test("web_app_saas: login loads + protected route blocks anonymous", () => {
  const cards = generateWebApp(scan, crawlOf(), { loginPath: "/login", protectedRoutes: ["/dashboard"] }, new Counter());
  assert.ok(cards.some((c) => c.title.includes("Login page loads") && c.status === "ready"));
  assert.ok(has(cards, (e) => e.expectBlocked === true));
  const bare = generateWebApp(scan, crawlOf(), {}, new Counter());
  assert.ok(bare.filter((c) => c.status === "blocked").length >= 2);
});

test("internal_tool_admin: internal surface blocks anonymous; flags public signup", () => {
  const cards = generateInternalTool(scan, crawlOf(["https://x.test/register"]), { protectedRoutes: ["/admin"] }, new Counter());
  assert.ok(has(cards, (e) => e.expectBlocked === true));
  assert.ok(cards.some((c) => c.title.toLowerCase().includes("self-registration")));
});

test("mobile_app: binary checks are honestly blocked with MASVS citations (never faked)", () => {
  const cards = generateMobile(scan, crawlOf(), {}, new Counter());
  assert.ok(cards.length >= 2);
  assert.ok(cards.every((c) => c.status === "blocked" && c.category === "mobile"));
  assert.ok(cards.some((c) => c.acceptanceCriteria.includes("MASVS")));
});

test("browser_extension: package checks are honestly blocked (never faked)", () => {
  const cards = generateBrowserExtension(scan, crawlOf(), {}, new Counter());
  assert.ok(cards.length >= 2);
  assert.ok(cards.every((c) => c.status === "blocked" && c.category === "browser_extension"));
});

test("ai_chatbot_voice: probes a discovered chat endpoint; LLM red-team + agent config blocked", () => {
  const withChat = generateAiVoice(scan, crawlOf(["https://x.test/api/chat"]), {}, new Counter());
  assert.ok(withChat.some((c) => c.title.includes("Chat endpoint responds") && c.status === "ready"));
  assert.ok(withChat.some((c) => c.title.includes("Prompt-injection") && c.status === "blocked"));
  const none = generateAiVoice(scan, crawlOf(), {}, new Counter());
  assert.ok(none.some((c) => c.title.includes("No chat/AI endpoint") && c.status === "blocked"));
});
