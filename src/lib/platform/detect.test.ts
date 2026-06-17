import { test } from "node:test";
import assert from "node:assert/strict";
import { detectPlatform, type Platform } from "./detect.ts";
import type { RepoScan, ScannedRoute } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const route = (p: Partial<ScannedRoute>): ScannedRoute => ({ file: "f", url_path: "/", kind: "page", methods: ["GET"], privileged: false, ...p });
const scanOf = (over: { framework?: string; evidence?: string[]; routes?: ScannedRoute[]; api?: number; total?: number }): RepoScan =>
  ({ repo_summary: { framework: over.framework ?? "", api_route_count: over.api ?? 0, route_count: over.total ?? (over.routes?.length ?? 0) },
     detail: { routes: over.routes ?? [], framework_evidence: over.evidence ?? [] } } as unknown as RepoScan);
const crawlOf = (over: Partial<RuntimeCrawl>): RuntimeCrawl =>
  ({ app_url: "https://x.com", title: "", links: [], form_count: 0, button_count: 0, has_password_field: false, console_errors_on_load: 0, crawled_at: "now", ...over } as RuntimeCrawl);

const expectPlatform = (p: Platform, scan: RepoScan | null, crawl: RuntimeCrawl) =>
  assert.equal(detectPlatform(scan, crawl, {}).platform, p);

test("e-commerce: detected from cart/checkout routes or a commerce dependency", () => {
  expectPlatform("ecommerce", scanOf({ evidence: ["shopify storefront"], routes: [route({ url_path: "/products/42" })], total: 1 }), crawlOf({}));
  expectPlatform("ecommerce", null, crawlOf({ links: [{ href: "https://x.com/cart", text: "Cart" }, { href: "https://x.com/checkout", text: "Checkout" }] }));
});

test("mobile app: detected from an Expo / React Native project", () => {
  expectPlatform("mobile_app", scanOf({ evidence: ["expo", "react-native"] }), crawlOf({}));
});

test("browser extension: detected from a manifest", () => {
  expectPlatform("browser_extension", scanOf({ evidence: ["manifest_version 3", "chrome.runtime"] }), crawlOf({}));
});

test("API backend: API routes with no real page surface", () => {
  expectPlatform("api_backend", scanOf({ routes: [route({ url_path: "/api/x", kind: "api", methods: ["GET"] })], api: 1, total: 1 }), crawlOf({ title: "" }));
});

test("blog/CMS: blog routes + a content framework", () => {
  expectPlatform("blog_cms", scanOf({ evidence: ["ghost"], routes: [route({ url_path: "/blog/hello" })], total: 1 }), crawlOf({ links: [{ href: "https://x.com/blog/hello", text: "Post" }] }));
});

test("sales funnel: a lead form on a small site with a thank-you step", () => {
  expectPlatform("sales_funnel", null, crawlOf({ form_count: 1, links: [{ href: "https://x.com/thank-you", text: "Thanks" }] }));
});

test("marketing/landing: static pages, no auth, no API, no form", () => {
  expectPlatform("marketing_landing", scanOf({ routes: [route({ url_path: "/" }), route({ url_path: "/about" })], total: 2 }), crawlOf({ title: "Acme" }));
});

test("internal tool/admin: admin/privileged routes dominate", () => {
  expectPlatform("internal_tool_admin", scanOf({ routes: [route({ url_path: "/admin", privileged: true }), route({ url_path: "/admin/users", privileged: true })], total: 2 }), crawlOf({ has_password_field: true }));
});

test("detection always returns signals explaining itself", () => {
  const d = detectPlatform(scanOf({ evidence: ["shopify"] }), crawlOf({}), {});
  assert.ok(d.signals.length > 0);
  assert.ok(["high", "medium", "low"].includes(d.confidence));
});
