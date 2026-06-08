/**
 * Execution core — shared by executor.ts (cards-file CLI) and audit.ts
 * (full audit pipeline). Real Playwright runs, per-card evidence.
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { ExecStep, ExecutableTestCard } from "./executor.ts";

export type CardResult = {
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

type ExecOptions = { appUrl: string; artifactDir: string };

function describeStep(step: ExecStep): string {
  return JSON.stringify(step);
}

async function runStep(page: Page, step: ExecStep, state: { consoleErrors: string[]; failedRequests: string[] }, appUrl: string): Promise<void> {
  switch (step.action) {
    case "goto":
      await page.goto(step.url ?? `${appUrl}${step.path ?? "/"}`, { waitUntil: "networkidle", timeout: 30000 });
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
      const target = step.url ?? `${appUrl}${step.path ?? "/"}`;
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

async function executeOne(browser: Browser, card: ExecutableTestCard, options: ExecOptions): Promise<CardResult> {
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
      await runStep(page, step, state, options.appUrl);
    } catch (stepError) {
      status = "failed";
      failedStep = describeStep(step);
      error = stepError instanceof Error ? stepError.message : String(stepError);
      break;
    }
  }

  await fs.mkdir(options.artifactDir, { recursive: true });
  const screenshotPath = path.join(options.artifactDir, `${card.id}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});
  await context.close();

  return { card, status, failedStep, error, consoleErrors: state.consoleErrors, failedRequests: state.failedRequests, screenshotPath, startedAt, endedAt: new Date().toISOString() };
}

export async function executeCards(cards: ExecutableTestCard[], options: ExecOptions): Promise<CardResult[]> {
  const browser = await chromium.launch();
  const results: CardResult[] = [];
  for (const card of cards) {
    const result = await executeOne(browser, card, options);
    results.push(result);
    const mark = result.status === "passed" ? "PASS" : "FAIL";
    console.error(`      ${mark}  ${card.id}  ${card.title}${result.error ? ` — ${result.error.slice(0, 100)}` : ""}`);
  }
  await browser.close();
  return results;
}

export async function registerArtifact(platformUrl: string, campaignId: string, runId: string, testCardId: string, filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath);
    const sha256 = crypto.createHash("sha256").update(content).digest("hex");
    const response = await fetch(`${platformUrl}/api/storage/register-artifact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaign_id: campaignId, run_id: runId, test_card_id: testCardId, artifact_type: "screenshot", filename: path.basename(filePath), sha256 }),
    });
    const data = await response.json();
    return data.artifact_ref ?? null;
  } catch {
    return null;
  }
}
