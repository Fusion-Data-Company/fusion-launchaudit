import { test } from "node:test";
import assert from "node:assert/strict";
import { generateFunnel } from "./funnel.ts";
import { Counter } from "./types.ts";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const scan = null as unknown as RepoScan | null;
const crawlOf = (links: string[]): RuntimeCrawl =>
  ({ app_url: "https://funnel.test", title: "Offer", links: links.map((href) => ({ href, text: "x" })), form_count: 1, button_count: 3, has_password_field: false, console_errors_on_load: 0, crawled_at: "now" } as RuntimeCrawl);
const byCat = (cards: { category: string }[]) => cards.filter((c) => c.category === "funnel");
const find = (cards: { title: string }[], frag: string) => cards.find((c) => c.title.toLowerCase().includes(frag));

test("funnel: full set present and all categorized 'funnel'", () => {
  const cards = generateFunnel(scan, crawlOf(["https://funnel.test/thank-you", "https://funnel.test/checkout"]), {}, new Counter());
  assert.equal(byCat(cards).length, cards.length);
  for (const frag of ["cta", "thank-you", "saves the lead", "tracking", "payment", "mobile"]) {
    assert.ok(find(cards, frag), `expected a funnel card about "${frag}"`);
  }
});

test("funnel: CTA card probes each internal link for non-404; thank-you + payment ready when present", () => {
  const cards = generateFunnel(scan, crawlOf(["https://funnel.test/step-2", "https://funnel.test/thank-you", "https://funnel.test/checkout"]), {}, new Counter());
  const cta = find(cards, "cta")!;
  assert.equal(cta.status, "ready");
  assert.ok(cta.exec.length >= 3); // one http step per internal link
  assert.deepEqual((cta.exec[0] as Record<string, unknown>).expectStatusNot, [404, 410, 500, 502, 503]);
  assert.equal(find(cards, "thank-you")!.status, "ready");
  assert.equal(find(cards, "payment")!.status, "ready");
});

test("funnel: lead-save is BLOCKED by default (never auto-submits to a live endpoint)", () => {
  const cards = generateFunnel(scan, crawlOf(["https://funnel.test/x"]), {}, new Counter());
  assert.equal(find(cards, "saves the lead")!.status, "blocked");
});

test("funnel: tracking pixel check asserts at least one analytics tag is present", () => {
  const cards = generateFunnel(scan, crawlOf([]), {}, new Counter());
  const px = find(cards, "tracking")!;
  assert.equal(px.status, "ready");
  assert.ok(((px.exec[0] as { expectBodyIncludesAny?: { needles: string[] } }).expectBodyIncludesAny?.needles ?? []).some((n) => n.includes("gtag") || n.includes("fbq")));
});

test("funnel: no thank-you / payment links -> honest blocked, not faked", () => {
  const cards = generateFunnel(scan, crawlOf(["https://funnel.test/a"]), {}, new Counter());
  assert.equal(find(cards, "thank-you")!.status, "blocked");
  assert.equal(find(cards, "payment")!.status, "blocked");
});
