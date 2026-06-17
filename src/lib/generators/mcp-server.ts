import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * MCP-server component — tested wherever the target exposes a Model Context
 * Protocol server. One item is testable over HTTP (the endpoint must require
 * auth), the rest (tools injection-safe, no secret leakage in tool output,
 * destructive tools gated) need an authenticated tool-call session and are
 * declared BLOCKED with guidance. Honest — never a faked pass.
 */
function mcpPath(scan: RepoScan | null, crawl: RuntimeCrawl): string | null {
  const routes = (scan?.detail?.routes ?? []).map((r) => r.url_path);
  const links = crawl.links.map((l) => l.href);
  const found = [...routes, ...links].find((p) => /\/(mcp|api\/mcp)(\/|$)/i.test(p));
  if (found) { try { return new URL(found).pathname; } catch { return found.startsWith("/") ? found : null; } }
  const evidence = [scan?.repo_summary?.framework ?? "", ...(scan?.detail?.framework_evidence ?? [])].join(" ").toLowerCase();
  if (/modelcontextprotocol|mcp[-_ ]?server|@modelcontextprotocol/.test(evidence)) return "/mcp";
  return null;
}

export function mcpPresent(scan: RepoScan | null, crawl: RuntimeCrawl, hints: AuditHints): boolean {
  return mcpPath(scan, crawl) !== null || Boolean((hints as { mcpPath?: unknown }).mcpPath);
}

export function generateMcpServer(scan: RepoScan | null, crawl: RuntimeCrawl, hints: AuditHints, c: Counter): GeneratedCard[] {
  const path = ((hints as { mcpPath?: string }).mcpPath) ?? mcpPath(scan, crawl);
  if (!path) return [];
  const cards: GeneratedCard[] = [];

  cards.push({
    id: c.next("TC-MCP"), title: `MCP endpoint requires authentication: ${path}`, category: "mutation_authz", status: "ready", risk: "critical",
    goal: "An MCP server exposes tools that act on your systems. An unauthenticated request must be rejected — an open MCP endpoint hands tool execution to anyone.",
    steps: [`POST ${path} with no credential`, "Expect a rejection (401/403), not a 2xx tool response"], expectedEvidence: ["http_transcript"], dataNeeds: [],
    acceptanceCriteria: `Anonymous POST ${path} is rejected (not 2xx). An MCP server must require auth.`,
    exec: [{ action: "http", method: "POST", path, body: { jsonrpc: "2.0", id: 1, method: "tools/list" }, expectStatusNot: [200, 201, 202] }],
  });

  const blocked: Array<[string, string]> = [
    ["MCP tools are injection-safe", "tool inputs are validated/escaped so a crafted argument can't traverse paths, run shell, or inject into a downstream query"],
    ["No secret leakage in tool output", "tool responses never echo API keys, tokens, connection strings, or internal config"],
    ["Destructive tools are gated", "delete/write/transfer tools require explicit confirmation or elevated auth, not a bare call"],
  ];
  for (const [title, crit] of blocked) {
    cards.push({
      id: c.next("TC-MCP"), title, category: "voice_agent", status: "blocked", risk: "high",
      goal: "An MCP tool-behavior property that needs an authenticated tool-call session to verify.",
      steps: ["Provide an MCP credential + tool list", "Re-run an authenticated tool-call eval against the server"], expectedEvidence: ["tool-call transcript"], dataNeeds: ["MCP auth + tool inventory"],
      acceptanceCriteria: `BLOCKED: ${crit} — needs an authenticated tool-call session, not a single HTTP probe.`, exec: [],
    });
  }
  return cards;
}
