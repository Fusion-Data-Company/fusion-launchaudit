import { test } from "node:test";
import assert from "node:assert/strict";
import { generateMcpServer, mcpPresent } from "./mcp-server.ts";
import { Counter, type AuditHints } from "./types.ts";
import type { RepoScan, ScannedRoute } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const emptyCrawl = { links: [] } as unknown as RuntimeCrawl;
const scanWith = (routes: ScannedRoute[], evidence: string[] = []): RepoScan =>
  ({ detail: { routes, framework_evidence: evidence }, repo_summary: { framework: "" } } as unknown as RepoScan);
const route = (url_path: string): ScannedRoute =>
  ({ file: "f", url_path, kind: "api", methods: ["POST"], privileged: false } as ScannedRoute);

test("mcp-server: no MCP surface -> no cards, mcpPresent() false", () => {
  const scan = scanWith([route("/api/lead")]);
  assert.equal(mcpPresent(scan, emptyCrawl, {}), false);
  assert.equal(generateMcpServer(scan, emptyCrawl, {}, new Counter()).length, 0);
});

test("mcp-server: an /api/mcp route makes it present and emits one ready + three blocked cards", () => {
  const scan = scanWith([route("/api/mcp")]);
  assert.equal(mcpPresent(scan, emptyCrawl, {}), true);
  const cards = generateMcpServer(scan, emptyCrawl, {}, new Counter());
  assert.equal(cards.length, 4);
  assert.equal(cards.filter((c) => c.status === "ready").length, 1);
  assert.equal(cards.filter((c) => c.status === "blocked").length, 3);
});

test("mcp-server: the auth card sends an anonymous tools/list and asserts a non-2xx rejection", () => {
  const scan = scanWith([route("/api/mcp")]);
  const ready = generateMcpServer(scan, emptyCrawl, {}, new Counter()).find((c) => c.status === "ready")!;
  assert.equal(ready.category, "mutation_authz");
  const step = ready.exec[0] as Record<string, unknown>;
  assert.equal(step.method, "POST");
  assert.equal(step.path, "/api/mcp");
  assert.equal((step.body as Record<string, unknown>).method, "tools/list");
  assert.deepEqual(step.expectStatusNot, [200, 201, 202]);
});

test("mcp-server: an explicit hints.mcpPath drives the probe path", () => {
  const scan = scanWith([]);
  const hints = { mcpPath: "/custom/mcp" } as unknown as AuditHints;
  const cards = generateMcpServer(scan, emptyCrawl, hints, new Counter());
  assert.ok(cards.length >= 1);
  assert.equal((cards[0].exec[0] as Record<string, unknown>).path, "/custom/mcp");
});
