import { test } from "node:test";
import assert from "node:assert/strict";
import { generateAiRedteam } from "./ai-redteam.ts";
import { Counter, type AuditHints } from "./types.ts";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const crawl = {} as RuntimeCrawl;

test("no AI config and no detectable endpoint → no cards", () => {
  const hints = { postEndpoints: [{ path: "/api/orders" }] } as AuditHints;
  assert.equal(generateAiRedteam(null, crawl, hints, new Counter()).length, 0);
});

test("a detected chat endpoint but no config → one honest BLOCKED card", () => {
  const hints = { postEndpoints: [{ path: "/api/chat" }] } as AuditHints;
  const cards = generateAiRedteam(null, crawl, hints, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].status, "blocked");
  assert.equal(cards[0].category, "ai_security");
});

test("a configured AI endpoint → three canary cards (injection, leak, unsafe output)", () => {
  const hints = { aiEndpoints: [{ path: "/api/assistant", promptField: "message", replyPath: "reply" }] } as AuditHints;
  const cards = generateAiRedteam(null, crawl, hints, new Counter());
  assert.equal(cards.length, 3);
  const attacks = cards.map((c) => (c.exec[0] as { attack: string }).attack).sort();
  assert.deepEqual(attacks, ["injection", "system_leak", "unsafe_output"]);
  const step = cards[0].exec[0] as { action: string; path: string; promptField: string; replyPath: string };
  assert.equal(step.action, "llm_probe");
  assert.equal(step.path, "/api/assistant");
  assert.equal(step.promptField, "message");
  assert.equal(step.replyPath, "reply");
});

test("the /api/orders style path does not falsely register as an AI endpoint", () => {
  const scan = { detail: { routes: [{ file: "f", url_path: "/api/orders", kind: "api", methods: ["POST"], privileged: false }] } } as unknown as RepoScan;
  assert.equal(generateAiRedteam(scan, crawl, {} as AuditHints, new Counter()).length, 0);
});
