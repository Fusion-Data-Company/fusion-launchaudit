/**
 * Execution core — real Playwright + HTTP runs, per-card evidence.
 * Shared by audit.ts and executor.ts. Handles browser steps (FE) and
 * raw HTTP steps (BE / admin-RBAC / middleware), plus per-card auth state.
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { type Browser, type BrowserContext, type Page } from "playwright";
import { launchBrowser } from "./browser.ts";
import { runnerAuthHeaders } from "./blob-store.ts";
import { runElevenLabsAssertion } from "./elevenlabs-audit.ts";
import { runSeoAssertion } from "./seo-audit.ts";
import { runContentAssertion } from "./content-audit.ts";
import type { ExecStep, ExecutableTestCard } from "./executor.ts";

export type CardResult = {
  card: ExecutableTestCard;
  status: "passed" | "failed";
  failedStep?: string;
  error?: string;
  consoleErrors: string[];
  failedRequests: string[];
  screenshotPath: string;
  /** Playwright trace.zip — only written for FAILED browser cards (size discipline). Empty otherwise. */
  tracePath: string;
  startedAt: string;
  endedAt: string;
  attempts: number;
  flaky?: boolean;
};

type ExecOptions = { appUrl: string; artifactDir: string };

const BLOCKED_STATUSES = new Set([301, 302, 303, 307, 308, 401, 403]);
const describeStep = (s: ExecStep) => JSON.stringify(s);

function resolveUrl(appUrl: string, step: { url?: string; path?: string }) {
  return step.url ?? `${appUrl}${step.path ?? "/"}`;
}

async function runHttp(step: Extract<ExecStep, { action: "http" }>, appUrl: string) {
  const target = resolveUrl(appUrl, step);
  const headers: Record<string, string> = { ...(step.headers ?? {}) };
  if (step.cookie) headers["cookie"] = step.cookie;
  let body: string | undefined;
  if (step.body !== undefined) {
    body = typeof step.body === "string" ? step.body : JSON.stringify(step.body);
    headers["content-type"] = headers["content-type"] ?? "application/json";
  }
  const res = await fetch(target, { method: step.method ?? "GET", headers, body, redirect: "manual" });
  const status = res.status;
  const text = await res.text();

  if (step.expectStatusOneOf && !step.expectStatusOneOf.includes(status)) {
    throw new Error(`${step.method ?? "GET"} ${target}: expected status in [${step.expectStatusOneOf}], got ${status}`);
  }
  if (step.expectStatusNot && step.expectStatusNot.includes(status)) {
    throw new Error(`${step.method ?? "GET"} ${target}: status ${status} is not allowed here`);
  }
  if (step.expectBlocked && !BLOCKED_STATUSES.has(status)) {
    throw new Error(`${step.method ?? "GET"} ${target}: expected access to be BLOCKED (redirect/401/403), but got ${status} — this surface is exposed`);
  }
  if (step.expectHeaderPresent) {
    for (const h of step.expectHeaderPresent) {
      if (!res.headers.get(h)) throw new Error(`${target}: missing required header "${h}"`);
    }
  }
  if (step.expectHeaderValueOneOf) {
    for (const [h, allowed] of Object.entries(step.expectHeaderValueOneOf)) {
      const val = (res.headers.get(h) ?? "").toLowerCase();
      if (!val) throw new Error(`${target}: missing required header "${h}"`);
      if (!allowed.some((a) => val.includes(a.toLowerCase()))) {
        throw new Error(`${target}: header "${h}" is "${val}", expected one of [${allowed.join(", ")}]`);
      }
    }
  }
  if (step.expectHeaderAbsent) {
    for (const h of step.expectHeaderAbsent) {
      const leaked = res.headers.get(h);
      if (leaked) throw new Error(`${target}: header "${h}" should not be exposed (leaks "${leaked}")`);
    }
  }
  if (step.expectJsonKeys) {
    let json: Record<string, unknown>;
    try { json = JSON.parse(text); } catch { throw new Error(`${target}: expected JSON body, got non-JSON`); }
    for (const k of step.expectJsonKeys) if (!(k in json)) throw new Error(`${target}: JSON missing key "${k}"`);
  }
  if (step.expectBodyExcludes) {
    for (const frag of step.expectBodyExcludes) {
      if (text.includes(frag)) throw new Error(`${target}: response leaks "${frag}" (likely a stack trace or sensitive data)`);
    }
  }
}

async function runStep(page: Page, step: ExecStep, state: { consoleErrors: string[]; failedRequests: string[] }, appUrl: string): Promise<void> {
  switch (step.action) {
    case "goto": {
      await page.goto(step.url ?? `${appUrl}${step.path ?? "/"}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      try { await page.waitForLoadState("networkidle", { timeout: 6000 }); } catch { /* busy app — fine */ }
      return;
    }
    case "reload": {
      await page.reload({ waitUntil: "domcontentloaded" });
      try { await page.waitForLoadState("networkidle", { timeout: 6000 }); } catch { /* busy app — fine */ }
      return;
    }
    case "click": await page.click(step.selector, { timeout: 8000 }); return;
    case "fill": await page.fill(step.selector, step.value, { timeout: 8000 }); return;
    case "press": await page.keyboard.press(step.key); return;
    case "wait": await page.waitForTimeout(step.ms); return;
    case "set_viewport": await page.setViewportSize({ width: step.width, height: step.height }); return;
    case "expect_visible": {
      const v = await page.locator(step.selector).first().isVisible({ timeout: 8000 }).catch(() => false);
      if (!v) throw new Error(`Expected visible: ${step.selector}`); return;
    }
    case "expect_text": {
      const t = (await page.locator(step.selector).first().textContent({ timeout: 8000 })) ?? "";
      if (!t.includes(step.contains)) throw new Error(`Expected "${step.contains}" in ${step.selector}; got "${t.slice(0, 120)}"`); return;
    }
    case "expect_url": if (!page.url().includes(step.contains)) throw new Error(`Expected URL to contain "${step.contains}"; got ${page.url()}`); return;
    case "expect_http_ok": {
      const target = step.url ?? `${appUrl}${step.path ?? "/"}`;
      const r = await fetch(target);
      if (!r.ok) throw new Error(`Expected 2xx from ${target}; got ${r.status}`);
      if (step.jsonKeys) { const d = await r.json(); for (const k of step.jsonKeys) if (!(k in d)) throw new Error(`${target} missing key "${k}"`); }
      return;
    }
    case "expect_no_horizontal_overflow": {
      const o = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      if (o) throw new Error("Horizontal overflow detected"); return;
    }
    case "expect_console_clean": if (state.consoleErrors.length) throw new Error(`Console errors: ${state.consoleErrors.slice(0, 3).join(" | ").slice(0, 300)}`); return;
    case "expect_network_clean": if (state.failedRequests.length) throw new Error(`Failed requests: ${state.failedRequests.slice(0, 3).join(" | ").slice(0, 300)}`); return;
    case "http": await runHttp(step, appUrl); return;
    case "elevenlabs": await runElevenLabsAssertion(step.agentId, step.apiKeyEnv, step.assert); return;
    case "seo": await runSeoAssertion(resolveUrl(appUrl, step), step.assert); return;
    case "content": await runContentAssertion(resolveUrl(appUrl, step), step.assert); return;
  }
}

/** Deterministic, no-browser cards: raw HTTP (BE/RBAC/middleware/security/write-authz), ElevenLabs, and SEO API checks. */
const NO_BROWSER_ACTIONS = new Set(["http", "elevenlabs", "seo", "content"]);
const isNoBrowser = (card: ExecutableTestCard) => card.exec.length > 0 && card.exec.every((s) => NO_BROWSER_ACTIONS.has(s.action));

async function runNoBrowserStep(step: ExecStep, appUrl: string): Promise<void> {
  if (step.action === "http") return runHttp(step, appUrl);
  if (step.action === "elevenlabs") return runElevenLabsAssertion(step.agentId, step.apiKeyEnv, step.assert);
  if (step.action === "seo") return runSeoAssertion(resolveUrl(appUrl, step), step.assert);
  if (step.action === "content") return runContentAssertion(resolveUrl(appUrl, step), step.assert);
  throw new Error(`runNoBrowserStep got a browser action: ${step.action}`);
}

async function runBrowserAttempt(browser: Browser, card: ExecutableTestCard, options: ExecOptions) {
  const state = { consoleErrors: [] as string[], failedRequests: [] as string[] };
  let status: "passed" | "failed" = "passed";
  let failedStep: string | undefined;
  let error: string | undefined;

  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    ...(card.authState ? { storageState: card.authState } : {}),
  });
  // Trace every attempt (screenshots + DOM snapshots); export only on failure.
  await context.tracing.start({ screenshots: true, snapshots: true }).catch(() => {});
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") state.consoleErrors.push(m.text()); });
  page.on("response", (r) => { if (r.status() >= 500) state.failedRequests.push(`${r.status()} ${r.url()}`); });

  for (const step of card.exec) {
    try { await runStep(page, step, state, options.appUrl); }
    catch (e) { status = "failed"; failedStep = describeStep(step); error = e instanceof Error ? e.message : String(e); break; }
  }

  await fs.mkdir(options.artifactDir, { recursive: true });
  const screenshotPath = path.join(options.artifactDir, `${card.id}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});

  // Size discipline: keep the trace.zip only when the card FAILED.
  let tracePath = "";
  if (status === "failed") {
    tracePath = path.join(options.artifactDir, `${card.id}-trace.zip`);
    try { await context.tracing.stop({ path: tracePath }); }
    catch { tracePath = ""; }
  } else {
    await context.tracing.stop().catch(() => {});
  }

  await context.close();
  return { status, failedStep, error, consoleErrors: state.consoleErrors, failedRequests: state.failedRequests, screenshotPath, tracePath };
}

async function executeOne(browser: Browser, card: ExecutableTestCard, options: ExecOptions): Promise<CardResult> {
  const startedAt = new Date().toISOString();

  // No-browser cards (admin/RBAC/backend/middleware/security/write-authz/ElevenLabs) are deterministic — no browser, no retry.
  if (isNoBrowser(card)) {
    let status: "passed" | "failed" = "passed";
    let failedStep: string | undefined;
    let error: string | undefined;
    for (const step of card.exec) {
      try { await runNoBrowserStep(step, options.appUrl); }
      catch (e) { status = "failed"; failedStep = describeStep(step); error = e instanceof Error ? e.message : String(e); break; }
    }
    return { card, status, failedStep, error, consoleErrors: [], failedRequests: [], screenshotPath: "", tracePath: "", startedAt, endedAt: new Date().toISOString(), attempts: 1 };
  }

  // Browser cards: bounded retry separates a real failure from a one-off timing flake
  // (e.g. an assertion that fired before an intro animation revealed the nav).
  const MAX_ATTEMPTS = 3;
  let attempt = 1;
  let last = await runBrowserAttempt(browser, card, options);
  while (last.status === "failed" && attempt < MAX_ATTEMPTS) {
    attempt += 1;
    last = await runBrowserAttempt(browser, card, options);
  }
  const flaky = last.status === "passed" && attempt > 1;
  // A failed attempt may have exported a trace before a retry recovered; the
  // card ultimately passed, so drop the stale trace (passed checks keep none).
  if (last.status === "passed") {
    await fs.unlink(path.join(options.artifactDir, `${card.id}-trace.zip`)).catch(() => {});
  }
  return {
    card, status: last.status, failedStep: last.failedStep, error: last.error,
    consoleErrors: last.consoleErrors, failedRequests: last.failedRequests, screenshotPath: last.screenshotPath,
    tracePath: last.status === "failed" ? last.tracePath : "",
    startedAt, endedAt: new Date().toISOString(), attempts: attempt, flaky,
  };
}

export async function executeCards(cards: ExecutableTestCard[], options: ExecOptions): Promise<CardResult[]> {
  const browser = await launchBrowser();
  const results: CardResult[] = [];
  for (const card of cards) {
    const r = await executeOne(browser, card, options);
    results.push(r);
    const tag = r.status === "passed" ? (r.flaky ? "FLAKY" : "PASS") : "FAIL";
    const note = r.flaky ? ` (recovered on attempt ${r.attempts})` : r.status === "failed" && r.error ? ` — ${r.error.slice(0, 100)}` : "";
    console.error(`      ${tag}  ${card.id}  ${card.title}${note}`);
  }
  await browser.close();
  return results;
}

export async function registerArtifact(platformUrl: string, campaignId: string, runId: string, testCardId: string, filePath: string, artifactType: "screenshot" | "trace" = "screenshot"): Promise<string | null> {
  if (!filePath) return null;
  try {
    const content = await fs.readFile(filePath);
    const sha256 = crypto.createHash("sha256").update(content).digest("hex");
    const r = await fetch(`${platformUrl}/api/storage/register-artifact`, {
      method: "POST", headers: { "content-type": "application/json", ...runnerAuthHeaders() },
      body: JSON.stringify({ campaign_id: campaignId, run_id: runId, test_card_id: testCardId, artifact_type: artifactType, filename: path.basename(filePath), sha256 }),
    });
    const d = await r.json();
    return d.artifact_ref ?? null;
  } catch { return null; }
}
