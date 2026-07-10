/**
 * LaunchAudit Execution Engine — real Playwright runs, real evidence.
 *
 * Takes executable test cards, drives a real browser against the app under
 * audit, captures screenshots + console + network failures per card, turns
 * failures into findings, and syncs everything (cards, run results,
 * findings, artifacts) to the platform.
 *
 *   node --experimental-strip-types runner/executor.ts \
 *     --cards runner/cards/launchaudit-production.ts \
 *     [--app-url https://target.app] [--repo .] [--no-sync]
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { RunnerSyncPayload, SyncFinding, SyncRunResult, SyncTestCard } from "../src/lib/mcp-runner-contract.ts";
import { probeRuntime, scanRepo } from "./repo-scanner.ts";
import { runnerAuthHeaders } from "./blob-store.ts";

export type ExecStep =
  | { action: "goto"; url?: string; path?: string }
  | { action: "reload" }
  | { action: "click"; selector: string }
  | { action: "fill"; selector: string; value: string }
  | { action: "press"; key: string }
  | { action: "wait"; ms: number }
  | { action: "set_viewport"; width: number; height: number }
  | { action: "expect_visible"; selector: string }
  | { action: "expect_text"; selector: string; contains: string }
  | { action: "expect_url"; contains: string }
  | { action: "expect_http_ok"; url?: string; path?: string; jsonKeys?: string[] }
  | { action: "expect_no_horizontal_overflow" }
  | { action: "expect_console_clean" }
  | { action: "expect_network_clean" }
  | { action: "axe"; impactFloor?: "minor" | "moderate" | "serious" | "critical" }
  | { action: "wcag22"; check: "target_size" | "focus_order" }
  | { action: "supply_chain_scan"; hits: Array<{ kind: string; pkg: string; detail: string; severity: string }> }
  | { action: "race_probe"; path: string; method?: string; cookie?: string; body?: unknown; concurrency?: number; successStatus?: number[] }
  | { action: "llm_probe"; path: string; method?: string; promptField: string; replyPath?: string; cookie?: string; attack: "injection" | "system_leak" | "unsafe_output" }
  | { action: "web_vitals" }
  | {
      action: "http";
      method?: string;
      url?: string;
      path?: string;
      cookie?: string;
      headers?: Record<string, string>;
      body?: unknown;
      expectStatusOneOf?: number[];
      expectStatusNot?: number[];
      expectBlocked?: boolean;
      expectHeaderPresent?: string[];
      expectHeaderValueOneOf?: Record<string, string[]>;
      expectHeaderAbsent?: string[];
      /** defense-in-depth headers (CSP/COOP/…): absence is a verify-gap, not a hard bug */
      expectHeaderRecommended?: string[];
      /** a present header must NOT carry these (lowercased) tokens, e.g. CSP w/o 'unsafe-inline' */
      expectHeaderExcludesTokens?: Record<string, string[]>;
      expectJsonKeys?: string[];
      expectBodyExcludes?: string[];
      /** case-insensitive variant of expectBodyExcludes (injection error/reflection signatures) */
      expectBodyExcludesCI?: string[];
      /** labeled regex patterns the response body must NOT contain — served secrets/PII/info leaks */
      expectBodyExcludesRegex?: Array<{ label: string; pattern: string }>;
      /** require the body to contain AT LEAST ONE of these (case-insensitive) — e.g. a tracking pixel or payment script */
      expectBodyIncludesAny?: { needles: string[]; label: string };
      /** assert each flag (HttpOnly/Secure/SameSite) is present on the response's Set-Cookie */
      expectCookieFlags?: string[];
      /** send `Origin: <value>` and assert it is NOT reflected with Access-Control-Allow-Credentials: true */
      corsProbeOrigin?: string;
    }
  | {
      /**
       * Two-identity metamorphic authorization probe (read-only). Fetch the SAME
       * protected resource as the privileged (admin) identity to establish a baseline,
       * then as each lower-privilege identity. Metamorphic relation, no oracle needed:
       * a lower-privilege response must be DENIED or contain strictly LESS than the
       * higher-privilege one. A lower identity that sees ~all of admin's content means
       * the authorization gradient is broken. Read-only (GET) — never mutates the target.
       */
      action: "two_identity";
      url?: string;
      path?: string;
      method?: string;
      adminCookie: string;
      lower: Array<{ role: string; cookie?: string }>;
    }
  | {
      action: "elevenlabs";
      agentId: string;
      apiKeyEnv?: string;
      assert: ElAssertion;
    }
  | {
      action: "seo";
      url?: string;
      path?: string;
      assert: SeoAssertion;
    }
  | {
      action: "content";
      url?: string;
      path?: string;
      assert: ContentAssertion;
    }
  | {
      action: "dep_cve_audit";
      deps: Array<{ ecosystem: string; name: string; version: string }>;
      direct?: string[];
      /** direct deps the app's own source actually imports (reachability-lite) */
      imported?: string[];
    }
  | {
      action: "license_audit";
      flagged: Array<{ name: string; license: string; kind: "copyleft" | "unknown" }>;
    }
  | {
      action: "code_smell_scan";
      hits: Array<{ file: string; line: number; rule: string; cwe: string }>;
    }
  | {
      action: "secret_scan";
      hits: Array<{ file: string; line: number; rule: string; preview: string; knownFormat: boolean }>;
    };

/** One assertion against a page's rendered content (fake/placeholder data integrity). */
export type ContentAssertion =
  | { kind: "no_lorem" }
  | { kind: "no_unbound_values" }
  | { kind: "no_localhost_refs" }
  | { kind: "no_placeholder_markers" };

/** One assertion against a page's initial server HTML (SEO / structured data). */
export type SeoAssertion =
  | { kind: "title_present"; minLen?: number }
  | { kind: "meta_present"; name: string; label?: string }
  | { kind: "canonical_present" }
  | { kind: "viewport_present" }
  | { kind: "og_present"; property: string }
  | { kind: "jsonld_valid" }
  | { kind: "not_noindex" };

/** One assertion against a fetched ElevenLabs ConvAI agent config (dot-path into the agent JSON). */
export type ElAssertion =
  | { kind: "reachable"; label?: string }
  | { kind: "field_present"; path: string; label?: string }
  | { kind: "nonempty_string"; path: string; minLen?: number; label?: string }
  | { kind: "field_oneof"; path: string; oneOf: string[]; label?: string }
  | { kind: "nonempty_array"; path: string; label?: string }
  | { kind: "tools_not_wiped"; label?: string }
  | { kind: "webhooks_https"; label?: string }
  | { kind: "no_placeholder_prompt"; path: string; label?: string };

export type ExecutableTestCard = SyncTestCard & { exec: ExecStep[]; authState?: string };

type CardResult = {
  card: ExecutableTestCard;
  status: "passed" | "failed";
  failedStep?: string;
  error?: string;
  consoleErrors: string[];
  failedRequests: string[];
  screenshotPath: string;
  startedAt: string;
  endedAt: string;
};

const args = process.argv.slice(2);
function arg(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
}

const APP_URL = (arg("app-url") ?? process.env.LAUNCH_AUDIT_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const SYNC_URL = process.env.LAUNCH_AUDIT_SYNC_URL ?? "http://127.0.0.1:3010/api/runner/sync";
const REGISTER_URL = SYNC_URL.replace("/runner/sync", "/storage/register-artifact");
const CAMPAIGN_ID = process.env.LAUNCH_AUDIT_CAMPAIGN_ID ?? "cmp_launch_001";
const ARTIFACT_DIR = arg("artifact-dir") ?? "runner-artifacts";

function describeStep(step: ExecStep): string {
  return JSON.stringify(step);
}

async function runStep(page: Page, step: ExecStep, state: { consoleErrors: string[]; failedRequests: string[] }): Promise<void> {
  switch (step.action) {
    case "goto":
      await page.goto(step.url ?? `${APP_URL}${step.path ?? "/"}`, { waitUntil: "networkidle", timeout: 30000 });
      return;
    case "reload":
      await page.reload({ waitUntil: "networkidle" });
      return;
    case "click":
      await page.click(step.selector, { timeout: 8000 });
      return;
    case "fill":
      await page.fill(step.selector, step.value, { timeout: 8000 });
      return;
    case "press":
      await page.keyboard.press(step.key);
      return;
    case "wait":
      await page.waitForTimeout(step.ms);
      return;
    case "set_viewport":
      await page.setViewportSize({ width: step.width, height: step.height });
      return;
    case "expect_visible": {
      const visible = await page.locator(step.selector).first().isVisible({ timeout: 8000 }).catch(() => false);
      if (!visible) throw new Error(`Expected visible: ${step.selector}`);
      return;
    }
    case "expect_text": {
      const text = (await page.locator(step.selector).first().textContent({ timeout: 8000 })) ?? "";
      if (!text.includes(step.contains)) throw new Error(`Expected "${step.contains}" in ${step.selector}; got "${text.slice(0, 120)}"`);
      return;
    }
    case "expect_url": {
      if (!page.url().includes(step.contains)) throw new Error(`Expected URL to contain "${step.contains}"; got ${page.url()}`);
      return;
    }
    case "expect_http_ok": {
      const target = step.url ?? `${APP_URL}${step.path ?? "/"}`;
      const response = await fetch(target);
      if (!response.ok) throw new Error(`Expected 2xx from ${target}; got ${response.status}`);
      if (step.jsonKeys) {
        const data = await response.json();
        for (const key of step.jsonKeys) {
          if (!(key in data)) throw new Error(`Response from ${target} missing key "${key}"`);
        }
      }
      return;
    }
    case "expect_no_horizontal_overflow": {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      if (overflow) throw new Error("Horizontal overflow detected");
      return;
    }
    case "expect_console_clean":
      if (state.consoleErrors.length > 0) throw new Error(`Console errors: ${state.consoleErrors.slice(0, 3).join(" | ").slice(0, 300)}`);
      return;
    case "expect_network_clean":
      if (state.failedRequests.length > 0) throw new Error(`Failed requests: ${state.failedRequests.slice(0, 3).join(" | ").slice(0, 300)}`);
      return;
  }
}

async function executeCard(browser: Browser, card: ExecutableTestCard): Promise<CardResult> {
  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const state = { consoleErrors: [] as string[], failedRequests: [] as string[] };
  page.on("console", (message) => {
    if (message.type() === "error") state.consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 500) state.failedRequests.push(`${response.status()} ${response.url()}`);
  });

  const startedAt = new Date().toISOString();
  let status: "passed" | "failed" = "passed";
  let failedStep: string | undefined;
  let error: string | undefined;

  for (const step of card.exec) {
    try {
      await runStep(page, step, state);
    } catch (stepError) {
      status = "failed";
      failedStep = describeStep(step);
      error = stepError instanceof Error ? stepError.message : String(stepError);
      break;
    }
  }

  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const screenshotPath = path.join(ARTIFACT_DIR, `${card.id}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});
  await context.close();

  return {
    card,
    status,
    failedStep,
    error,
    consoleErrors: state.consoleErrors,
    failedRequests: state.failedRequests,
    screenshotPath,
    startedAt,
    endedAt: new Date().toISOString(),
  };
}

async function registerArtifact(runId: string, testCardId: string, filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath);
    const sha256 = crypto.createHash("sha256").update(content).digest("hex");
    const response = await fetch(REGISTER_URL, {
      method: "POST",
      headers: { "content-type": "application/json", ...runnerAuthHeaders() },
      body: JSON.stringify({
        campaign_id: CAMPAIGN_ID,
        run_id: runId,
        test_card_id: testCardId,
        artifact_type: "screenshot",
        filename: path.basename(filePath),
        sha256,
      }),
    });
    const data = await response.json();
    return data.artifact_ref ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const cardsModule = arg("cards");
  if (!cardsModule) {
    console.error("Usage: executor.ts --cards <module.ts> [--app-url <url>] [--repo <path>] [--no-sync]");
    process.exit(1);
  }

  const { cards } = (await import(path.resolve(cardsModule))) as { cards: ExecutableTestCard[] };
  console.error(`Executing ${cards.length} test cards against ${APP_URL}\n`);

  const browser = await chromium.launch();
  const results: CardResult[] = [];
  for (const card of cards) {
    const result = await executeCard(browser, card);
    results.push(result);
    const mark = result.status === "passed" ? "PASS" : "FAIL";
    console.error(`${mark}  ${card.id}  ${card.title}${result.error ? ` — ${result.error.slice(0, 110)}` : ""}`);
  }
  await browser.close();

  const runStamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runResults: SyncRunResult[] = [];
  const findings: SyncFinding[] = [];
  const artifactRefs: string[] = [];

  for (const result of results) {
    const runId = `run_${runStamp}_${result.card.id}`;
    const artifactRef = await registerArtifact(runId, result.card.id, result.screenshotPath);
    if (artifactRef) artifactRefs.push(artifactRef);
    runResults.push({
      run_id: runId,
      test_card_id: result.card.id,
      status: result.status,
      started_at: result.startedAt,
      ended_at: result.endedAt,
      artifact_refs: artifactRef ? [artifactRef] : [],
    });
    if (result.status === "failed") {
      findings.push({
        id: `FD_${runStamp}_${result.card.id}`,
        test_card_id: result.card.id,
        type: "product_bug",
        severity: result.card.risk as SyncFinding["severity"],
        title: `${result.card.title} — failed`,
        summary: `Failed at step ${result.failedStep}: ${result.error}`.slice(0, 480),
        evidence_refs: artifactRef ? [artifactRef] : [`file://${result.screenshotPath}`],
      });
    }
  }

  const passed = results.filter((r) => r.status === "passed").length;
  console.error(`\n${passed}/${results.length} passed | findings: ${findings.length} | artifacts: ${artifactRefs.length}`);

  if (args.includes("--no-sync")) {
    console.log(JSON.stringify({ results: runResults, findings }, null, 2));
    return;
  }

  const repoPath = arg("repo");
  const scan = repoPath ? await scanRepo(repoPath) : null;
  const runtime = await probeRuntime(APP_URL);

  const payload: RunnerSyncPayload = {
    campaign_id: CAMPAIGN_ID,
    runner_host: os.hostname(),
    build_sha: process.env.LAUNCH_AUDIT_BUILD_SHA ?? "executor",
    scan_mode: "live_scan",
    scan_detail: scan?.detail as Record<string, unknown> | undefined,
    repo_summary: scan?.repo_summary ?? {
      framework: "external target",
      package_manager: "n/a",
      scripts: [],
      route_count: 0,
      api_route_count: 0,
      env_keys_present: [],
      env_keys_missing: [],
    },
    runtime_summary: runtime,
    test_cards: results.map(({ card, status }) => ({ ...card, exec: undefined, status }) as SyncTestCard),
    run_results: runResults,
    findings,
    artifact_refs: artifactRefs,
  };

  const response = await fetch(SYNC_URL, {
    method: "POST",
    headers: { "content-type": "application/json", ...runnerAuthHeaders() },
    body: JSON.stringify(payload),
  });
  const syncResult = await response.json();
  console.log(JSON.stringify(syncResult, null, 2));
  if (!response.ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
