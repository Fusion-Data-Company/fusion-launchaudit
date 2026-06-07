/**
 * LaunchAudit MCP Server — the TestSprite pattern, Fusion-owned.
 *
 * Install this into Claude Code / Cursor / Windsurf and the customer's own
 * coding agent does the reasoning (test planning, failure classification,
 * repair writing) by calling these tools. The LaunchAudit platform stores
 * campaign state and renders evidence. Private code never leaves the machine:
 * scanning is local; only sanitized summaries sync.
 *
 * Config:
 *   LAUNCHAUDIT_API_URL      platform base URL (default: production)
 *   LAUNCHAUDIT_CAMPAIGN_ID  campaign to attach to (default: cmp_launch_001)
 */
import os from "node:os";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { probeRuntime, scanRepo } from "./repo-scanner.ts";

const API_URL = (process.env.LAUNCHAUDIT_API_URL ?? "https://launch-audit-platform.vercel.app").replace(/\/$/, "");
const CAMPAIGN_ID = process.env.LAUNCHAUDIT_CAMPAIGN_ID ?? "cmp_launch_001";

const server = new McpServer({ name: "launchaudit", version: "0.1.0" });

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string, hint: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify({ error: message, hint }, null, 2) }],
  };
}

server.tool(
  "launchaudit_scan_repo",
  "Inspect a local repository before planning tests: framework, package manager, scripts, page/API route counts, env keys expected vs present (names only — values never read), and existing test tooling. Run this FIRST so test cards are grounded in repo truth.",
  { repo_path: z.string().describe("Absolute path to the repository root") },
  async ({ repo_path }) => {
    try {
      const scan = await scanRepo(repo_path);
      return ok(scan);
    } catch (error) {
      return fail(
        `Could not scan ${repo_path}: ${error instanceof Error ? error.message : "unknown error"}`,
        "Pass the absolute path to a directory containing the project (where package.json lives).",
      );
    }
  },
);

server.tool(
  "launchaudit_probe_runtime",
  "Check whether the app under audit is reachable at a URL (HTTP probe). Console/network capture arrives with the Playwright layer; this reports reachability truthfully.",
  { app_url: z.string().url().describe("URL of the running app, e.g. http://localhost:3000") },
  async ({ app_url }) => ok(await probeRuntime(app_url)),
);

server.tool(
  "launchaudit_get_campaign",
  "Fetch the current LaunchAudit campaign: test cards with statuses, findings, repair tasks, and persistence mode. Use to see existing coverage before writing new test cards, or to review findings that need repair work.",
  {},
  async () => {
    try {
      const response = await fetch(`${API_URL}/api/campaign`);
      if (!response.ok) {
        return fail(`Campaign API returned ${response.status}`, `Check ${API_URL}/api/campaign is deployed and reachable.`);
      }
      const data = await response.json();
      return ok({
        campaign: data.campaign,
        test_cards: data.test_cards,
        findings: data.findings,
        repair_tasks: data.repair_tasks,
        persistence: data.persistence,
      });
    } catch (error) {
      return fail(
        `Could not reach the LaunchAudit platform: ${error instanceof Error ? error.message : "unknown"}`,
        `Set LAUNCHAUDIT_API_URL if the platform runs somewhere other than ${API_URL}.`,
      );
    }
  },
);

server.tool(
  "launchaudit_get_test_card_contract",
  "Get the exact contract for authoring LaunchAudit test cards. Every card must be specific and evidence-gated — generic smoke tests are rejected culture-wise. Returns the schema, allowed categories/risk levels, and authoring rules.",
  {},
  async () =>
    ok({
      schema: {
        id: "string — TC-<number>, unique",
        title: "string — specific behavior under test, not a vague area",
        category: "auth | core_workflow | roles_permissions | forms_validation | state_persistence | responsive_visual | accessibility | performance | api_contract | console_network | error_empty_states | integration_side_effects",
        status: "ready (always, until executed)",
        risk: "critical | high | medium | low",
        goal: "string — what passing proves about launch readiness",
        steps: "string[] — concrete reproduction steps a runner can execute",
        expectedEvidence: "string[] — artifacts that must exist to claim the result (screenshot, trace, network log)",
        dataNeeds: "string[] — accounts, seeds, or fixtures required",
        acceptanceCriteria: "string — the single unambiguous pass condition",
      },
      authoring_rules: [
        "Ground every card in the actual repo scan — reference real routes, real env keys, real frameworks.",
        "Each card needs a falsifiable acceptance criterion; 'works correctly' is not one.",
        "Cover at least: one auth flow, one role boundary, one form edge case, one responsive check, one API/console check, and declare blocked checks honestly when sandbox keys are missing.",
        "Blocked is a first-class status — never silently skip what cannot run.",
      ],
    }),
);

server.tool(
  "launchaudit_sync_campaign",
  "Sync test cards and repo/runtime truth to the LaunchAudit command center. Scans the repo and probes the runtime fresh (live_scan), then submits. Returns persistence info — postgres mode means it survived durably.",
  {
    repo_path: z.string().describe("Absolute path to the repository under audit"),
    app_url: z.string().url().optional().describe("Running app URL; defaults to the campaign's configured URL"),
    test_cards: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          category: z.string(),
          status: z.string(),
          risk: z.string(),
        }),
      )
      .describe("Test cards to sync (id, title, category, status, risk)"),
  },
  async ({ repo_path, app_url, test_cards }) => {
    try {
      const scan = await scanRepo(repo_path);
      const runtime = await probeRuntime(app_url ?? "http://localhost:3000");
      const response = await fetch(`${API_URL}/api/runner/sync`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          campaign_id: CAMPAIGN_ID,
          runner_host: os.hostname(),
          build_sha: process.env.LAUNCHAUDIT_BUILD_SHA ?? "mcp",
          scan_mode: "live_scan",
          scan_detail: scan.detail,
          repo_summary: scan.repo_summary,
          runtime_summary: runtime,
          test_cards,
          artifact_refs: [`repo-scan://${CAMPAIGN_ID}/${encodeURIComponent(scan.detail.repo_path)}`],
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        return fail(`Sync rejected (${response.status}): ${JSON.stringify(result)}`, "Check the payload shape against launchaudit_get_test_card_contract.");
      }
      return ok(result);
    } catch (error) {
      return fail(
        `Sync failed: ${error instanceof Error ? error.message : "unknown"}`,
        `Confirm the platform at ${API_URL} is reachable and repo_path exists.`,
      );
    }
  },
);

server.tool(
  "launchaudit_register_artifact",
  "Register evidence (screenshot, trace, video, network log) for a test run. Returns the deterministic blob path and persistence status. Evidence-gating is the product: failures without artifacts don't count.",
  {
    run_id: z.string().describe("Run identifier, e.g. run_2026_06_07_001"),
    test_card_id: z.string().describe("Test card this evidence belongs to"),
    artifact_type: z.enum(["screenshot", "trace", "video", "network_log", "accessibility_snapshot", "report_pdf"]),
    filename: z.string(),
    sha256: z.string().describe("Checksum of the artifact file"),
  },
  async ({ run_id, test_card_id, artifact_type, filename, sha256 }) => {
    const response = await fetch(`${API_URL}/api/storage/register-artifact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaign_id: CAMPAIGN_ID, run_id, test_card_id, artifact_type, filename, sha256 }),
    });
    const result = await response.json();
    if (!response.ok) {
      return fail(`Artifact registration rejected (${response.status})`, JSON.stringify(result));
    }
    return ok(result);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`LaunchAudit MCP server ready — platform: ${API_URL}, campaign: ${CAMPAIGN_ID}`);
