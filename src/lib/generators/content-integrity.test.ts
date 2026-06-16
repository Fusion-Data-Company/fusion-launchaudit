import { test } from "node:test";
import assert from "node:assert/strict";
import { generateContentIntegrity } from "./content-integrity.ts";
import { Counter } from "./types.ts";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const scan = null as unknown as RepoScan | null;
const crawl = (appUrl: string): RuntimeCrawl => ({ app_url: appUrl } as unknown as RuntimeCrawl);

test("all content-integrity cards are categorized content_integrity", () => {
  const cards = generateContentIntegrity(scan, crawl("https://lutherpools.com"), {}, new Counter());
  assert.ok(cards.length >= 4);
  assert.ok(cards.every((c) => c.category === "content_integrity"));
});

test("the localhost check runs for a deployed target", () => {
  const cards = generateContentIntegrity(scan, crawl("https://lutherpools.com"), {}, new Counter());
  assert.ok(cards.some((c) => c.exec.some((e) => (e as { assert: { kind: string } }).assert.kind === "no_localhost_refs")));
});

test("the localhost check is skipped for a local dev target (would false-positive)", () => {
  const cards = generateContentIntegrity(scan, crawl("http://localhost:3000"), {}, new Counter());
  assert.ok(!cards.some((c) => c.exec.some((e) => (e as { assert: { kind: string } }).assert.kind === "no_localhost_refs")));
});
