import { test } from "node:test";
import assert from "node:assert/strict";
import { generateInfoDisclosure } from "./info-disclosure.ts";
import { classifyFailure } from "../../../runner/classify.ts";
import { Counter } from "./types.ts";

const crawl = {} as never;
const ctx = { appUrl: "https://x", devStubAuth: false };

test("generateInfoDisclosure emits an info_disclosure card with labeled regex assertions", () => {
  const cards = generateInfoDisclosure(null, crawl, { securityPaths: ["/", "/api/me"] }, new Counter());
  assert.equal(cards.length, 2);
  const card = cards[0];
  assert.equal(card.category, "info_disclosure");
  const step = card.exec[0] as { action: string; expectBodyExcludesRegex?: Array<{ label: string; pattern: string }> };
  assert.equal(step.action, "http");
  const labels = (step.expectBodyExcludesRegex ?? []).map((r) => r.label);
  assert.ok(labels.some((l) => l.includes("served credential")), "has credential-tier patterns");
  assert.ok(labels.some((l) => l.includes("info leak")), "has info-tier patterns");
});

test("the credential + info regexes match real samples and not clean prose", () => {
  const cards = generateInfoDisclosure(null, crawl, {}, new Counter());
  const pats = (cards[0].exec[0] as { expectBodyExcludesRegex: Array<{ label: string; pattern: string }> }).expectBodyExcludesRegex;
  const find = (frag: string) => pats.find((p) => p.label.includes(frag))!;
  assert.match("AKIAIOSFODNN7EXAMPLE", new RegExp(find("AWS access key").pattern));
  assert.match("-----BEGIN OPENSSH PRIVATE KEY-----", new RegExp(find("private key block").pattern));
  assert.match("10.0.3.14", new RegExp(find("internal RFC1918").pattern));
  // clean marketing copy must NOT trip any pattern
  const clean = "Welcome to our store. Buy 3 widgets and save. Contact us at hello@example.com.";
  assert.ok(!pats.some((p) => new RegExp(p.pattern).test(clean)), "no false positive on clean prose");
});

test("classify: served credential -> product_bug; info marker -> needs_verification", () => {
  const res = (error: string) => ({ card: { category: "info_disclosure" }, error } as never);
  assert.equal(classifyFailure(res("/: response body exposes an AWS access key id (served credential)"), ctx).type, "product_bug");
  assert.equal(classifyFailure(res("/: response body exposes an internal RFC1918 IP address (info leak)"), ctx).type, "needs_verification");
});
