import { test } from "node:test";
import assert from "node:assert/strict";
import { generateTlsHsts } from "./tls-hsts.ts";
import { Counter } from "./types.ts";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const scan = null as unknown as RepoScan | null;
const crawl = (appUrl: string): RuntimeCrawl => ({ app_url: appUrl } as unknown as RuntimeCrawl);

test("tls-hsts: an https deployment gets HSTS + http->https redirect cards", () => {
  const cards = generateTlsHsts(scan, crawl("https://prod.test"), {}, new Counter());
  assert.equal(cards.length, 2);
  assert.ok(cards.every((c) => c.category === "tls_hsts" && c.status === "ready"));
  const hsts = cards.find((c) => c.title.includes("HSTS"))!;
  assert.deepEqual((hsts.exec[0] as Record<string, unknown>).expectHeaderPresent, ["strict-transport-security"]);
  const redirect = cards.find((c) => c.title.includes("redirects"))!;
  const step = redirect.exec[0] as Record<string, unknown>;
  assert.deepEqual(step.expectStatusOneOf, [301, 307, 308]);
  assert.equal(step.url, "http://prod.test/", "probes the plain-http variant");
});

test("tls-hsts: an http target is honestly blocked (checks only meaningful over https)", () => {
  const cards = generateTlsHsts(scan, crawl("http://prod.test"), {}, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].status, "blocked");
});

test("tls-hsts: a localhost https target is blocked (not a real deployment)", () => {
  const cards = generateTlsHsts(scan, crawl("https://localhost:3000"), {}, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].status, "blocked");
});
