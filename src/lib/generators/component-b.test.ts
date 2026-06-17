import { test } from "node:test";
import assert from "node:assert/strict";
import { generateDatabase } from "./database.ts";
import { generateMcpServer } from "./mcp-server.ts";
import { Counter } from "./types.ts";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const crawlOf = (links: string[] = []): RuntimeCrawl =>
  ({ app_url: "https://x.test", title: "X", links: links.map((href) => ({ href, text: "x" })), form_count: 0, button_count: 0, has_password_field: false, console_errors_on_load: 0, crawled_at: "now" } as RuntimeCrawl);
const scanOf = (evidence: string[] = [], env: string[] = []): RepoScan =>
  ({ repo_summary: { framework: "", framework_evidence: evidence, env_keys_present: env }, detail: { routes: [], framework_evidence: evidence } } as unknown as RepoScan);
const has = (cards: { exec: unknown[] }[], pred: (e: Record<string, unknown>) => boolean) => cards.some((c) => c.exec.some((e) => pred(e as Record<string, unknown>)));

test("database: when a DB is present, probes for a leaked connection string + blocks the invisible items", () => {
  const cards = generateDatabase(scanOf(["prisma", "postgres"]), crawlOf(), {}, new Counter());
  assert.ok(cards.length >= 5);
  assert.ok(has(cards, (e) => (e.expectBodyExcludesCI as string[])?.some((s) => s.includes("postgres://")) ?? false));
  for (const item of ["Indexes", "Migrations", "backups", "Row-level security", "pooling"]) {
    assert.ok(cards.some((c) => c.title.toLowerCase().includes(item.toLowerCase()) && c.status === "blocked"), `expected blocked card for ${item}`);
  }
});

test("database: detected from env (DATABASE_URL) too; absent -> no cards", () => {
  assert.ok(generateDatabase(scanOf([], ["DATABASE_URL"]), crawlOf(), {}, new Counter()).length > 0);
  assert.equal(generateDatabase(scanOf([], []), crawlOf(), {}, new Counter()).length, 0);
});

test("mcp-server: when an MCP server is present, requires-auth probe + blocks tool-behavior items", () => {
  const cards = generateMcpServer(scanOf(["@modelcontextprotocol/sdk"]), crawlOf(), {}, new Counter());
  assert.ok(cards.some((c) => c.title.includes("requires authentication") && c.status === "ready"));
  assert.ok(has(cards, (e) => e.action === "http" && e.method === "POST" && Array.isArray(e.expectStatusNot)));
  for (const item of ["injection-safe", "secret leakage", "Destructive"]) {
    assert.ok(cards.some((c) => c.title.includes(item) && c.status === "blocked"), `expected blocked card for ${item}`);
  }
});

test("mcp-server: detected from an /mcp route; absent -> no cards", () => {
  assert.ok(generateMcpServer(scanOf([]), crawlOf(["https://x.test/api/mcp"]), {}, new Counter()).length > 0);
  assert.equal(generateMcpServer(scanOf([]), crawlOf([]), {}, new Counter()).length, 0);
});
