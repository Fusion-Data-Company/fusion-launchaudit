import { test } from "node:test";
import assert from "node:assert/strict";
import { generateElevenLabs } from "./elevenlabs.ts";
import { generateSeo } from "./seo.ts";
import { Counter } from "./types.ts";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const scan = null as unknown as RepoScan | null;
const crawl = {} as unknown as RuntimeCrawl;

test("ElevenLabs: no agents configured means no cards and no false penalty", () => {
  assert.equal(generateElevenLabs(scan, crawl, {}, new Counter()).length, 0);
});

test("ElevenLabs: a configured agent with no API key in env yields an honest BLOCKED card", () => {
  const keyEnv = "EL_KEY_THAT_IS_UNSET_FOR_TEST";
  delete process.env[keyEnv];
  const cards = generateElevenLabs(scan, crawl, { elevenLabsAgents: [{ agentId: "a1" }], elevenLabsApiKeyEnv: keyEnv }, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].status, "blocked");
});

test("ElevenLabs: with a key present, the tool-wipe check (tool_ids:[] guard) is generated", () => {
  const keyEnv = "EL_KEY_PRESENT_FOR_TEST";
  process.env[keyEnv] = "xi-test";
  try {
    const cards = generateElevenLabs(scan, crawl, { elevenLabsAgents: [{ agentId: "a1" }], elevenLabsApiKeyEnv: keyEnv }, new Counter());
    assert.ok(cards.length >= 5, "expected the full ready card set");
    assert.ok(cards.some((c) => c.exec.some((e) => ((e as Record<string, unknown>).assert as Record<string, unknown>)?.kind === "tools_not_wiped")), "expected a tools-not-wiped check");
    assert.ok(cards.every((c) => c.category === "voice_agent"));
  } finally {
    delete process.env[keyEnv];
  }
});

test("ElevenLabs: a toolless agent skips the tool-wipe and webhook checks", () => {
  const keyEnv = "EL_KEY_TOOLLESS_TEST";
  process.env[keyEnv] = "xi-test";
  try {
    const cards = generateElevenLabs(scan, crawl, { elevenLabsAgents: [{ agentId: "a1", toolless: true }], elevenLabsApiKeyEnv: keyEnv }, new Counter());
    assert.ok(!cards.some((c) => c.exec.some((e) => ((e as Record<string, unknown>).assert as Record<string, unknown>)?.kind === "tools_not_wiped")), "toolless agent must not assert tools present");
  } finally {
    delete process.env[keyEnv];
  }
});

test("SEO: generates the universal (title, viewport) and marketing checks, all categorized seo", () => {
  const cards = generateSeo(scan, crawl, {}, new Counter());
  assert.ok(cards.length >= 8);
  assert.ok(cards.every((c) => c.category === "seo"));
  assert.ok(cards.some((c) => c.exec.some((e) => ((e as Record<string, unknown>).assert as Record<string, unknown>)?.kind === "title_present")));
  assert.ok(cards.some((c) => c.exec.some((e) => ((e as Record<string, unknown>).assert as Record<string, unknown>)?.kind === "viewport_present")));
});
