import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeLink,
  looksLikeApi,
  sampleIdsFromPath,
  extractIdsFromJsonText,
  mergeDiscovered,
  type RuntimeCrawl,
} from "./crawler.ts";

const ORIGIN = "https://app.test";

test("normalizeLink keeps same-origin, strips query/hash/trailing-slash, drops the home page", () => {
  assert.equal(normalizeLink("https://app.test/dashboard?tab=1#x", ORIGIN), "https://app.test/dashboard");
  assert.equal(normalizeLink("/settings/", ORIGIN), "https://app.test/settings");
  assert.equal(normalizeLink("https://app.test/", ORIGIN), null); // home itself
  assert.equal(normalizeLink("https://evil.test/x", ORIGIN), null); // cross-origin
  assert.equal(normalizeLink("mailto:a@b.com", ORIGIN), null); // non-http scheme
  assert.equal(normalizeLink("javascript:void(0)", ORIGIN), null);
});

test("looksLikeApi recognizes API-shaped paths, not navigable pages", () => {
  for (const p of ["/api/users", "/graphql", "/api/trpc/x", "/v1/orders", "/data.json"]) assert.ok(looksLikeApi(p), p);
  for (const p of ["/dashboard", "/products/42", "/about", "/blog/post"]) assert.equal(looksLikeApi(p), false, p);
});

test("sampleIdsFromPath harvests numeric + uuid ids keyed by the preceding segment", () => {
  assert.deepEqual(sampleIdsFromPath("/products/1023/reviews/7"), { products: "1023", reviews: "7" });
  assert.deepEqual(sampleIdsFromPath("/users/550e8400-e29b-41d4-a716-446655440000"), {
    users: "550e8400-e29b-41d4-a716-446655440000",
  });
  assert.deepEqual(sampleIdsFromPath("/about/team"), {}); // no ids
  // first id per resource wins
  assert.deepEqual(sampleIdsFromPath("/products/5/products/9"), { products: "5" });
});

test("extractIdsFromJsonText pulls id/_id/uuid/slug values, bounded", () => {
  const body = JSON.stringify({ id: 42, name: "x", nested: { _id: "abc" }, slug: "hello-world" });
  const ids = extractIdsFromJsonText(body);
  assert.ok(ids.includes("42"));
  assert.ok(ids.includes("abc"));
  assert.ok(ids.includes("hello-world"));
  assert.ok(extractIdsFromJsonText("not json at all").length === 0);
});

const crawlOf = (over: Partial<RuntimeCrawl>): RuntimeCrawl => ({
  app_url: ORIGIN, reachable: true, title: "T", links: [], form_count: 0, button_count: 0,
  has_password_field: false, console_errors_on_load: 0, crawled_at: "now", ...over,
});

test("mergeDiscovered unions links + api_routes, dedupes, and sets authenticated", () => {
  const anon = crawlOf({
    links: [{ href: "https://app.test/a", text: "a" }],
    api_routes: [{ path: "/api/x", method: "GET" }],
    sampled_ids: { products: "1" },
    pages_crawled: 3,
    authenticated: false,
  });
  const authed = crawlOf({
    links: [{ href: "https://app.test/a", text: "a" }, { href: "https://app.test/admin", text: "admin" }],
    api_routes: [{ path: "/api/x", method: "GET" }, { path: "/api/admin/users", method: "DELETE" }],
    sampled_ids: { users: "9" },
    pages_crawled: 2,
    authenticated: true,
  });
  const merged = mergeDiscovered(anon, authed);
  assert.equal(merged.links.length, 2, "deduped the shared /a link, kept /admin");
  assert.ok(merged.links.some((l) => l.href.endsWith("/admin")));
  assert.equal(merged.api_routes!.length, 2, "deduped GET /api/x, added DELETE /api/admin/users");
  assert.deepEqual(merged.sampled_ids, { products: "1", users: "9" });
  assert.equal(merged.pages_crawled, 5);
  assert.equal(merged.authenticated, true);
});
