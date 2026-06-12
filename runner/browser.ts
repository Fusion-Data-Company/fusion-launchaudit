/**
 * Browser preflight — single, hardened entry point for every Playwright
 * Chromium launch in the runner. Before this existed, four separate call
 * sites (crawler, execute-core, capture-auth, executor) each did a raw
 * `chromium.launch()`. When the Chromium binary was missing, every one of
 * them threw a raw, uncaught Playwright stack trace and the audit died with
 * no actionable message.
 *
 * launchBrowser() does three things the raw call did not:
 *   1. Detects the "browser binary not installed" failure specifically.
 *   2. Auto-installs Chromium once (npx playwright install chromium) and retries.
 *   3. If install is unavailable/fails, throws ONE clean, actionable error
 *      instead of a stack trace.
 *
 * Every launch in the runner MUST go through here. No direct chromium.launch().
 */
import { spawnSync } from "node:child_process";
import { chromium, type Browser, type LaunchOptions } from "playwright";

let installAttempted = false;

/** Heuristic: does this error mean "the Chromium binary isn't installed"? */
function isMissingBrowserError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Executable doesn't exist") ||
    message.includes("playwright install") ||
    message.includes("browserType.launch") && message.includes("install")
  );
}

/** Install Chromium AND the headless shell (Playwright ≥1.49 ships them separately). Returns true on success. */
function installChromium(): boolean {
  process.stderr.write("      Chromium binary missing — installing (npx playwright install chromium chromium-headless-shell)...\n");
  const result = spawnSync("npx", ["playwright", "install", "chromium", "chromium-headless-shell"], {
    stdio: ["ignore", "inherit", "inherit"],
    timeout: 300_000,
  });
  return result.status === 0;
}

/**
 * Launch a Chromium browser with a preflight install fallback.
 * On a missing-binary failure, installs Chromium once and retries.
 * Throws a single clean error if the browser still cannot launch.
 */
export async function launchBrowser(options?: LaunchOptions): Promise<Browser> {
  try {
    return await chromium.launch(options);
  } catch (error) {
    if (!isMissingBrowserError(error)) {
      // A real launch failure (sandbox, perms, OOM) — surface the actual cause.
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Playwright failed to launch Chromium: ${detail}`);
    }
    if (installAttempted) {
      throw new Error(
        "Playwright Chromium is not installed and auto-install already failed. " +
          "Run `npx playwright install chromium chromium-headless-shell` manually, then re-run the audit.",
      );
    }
    installAttempted = true;
    if (!installChromium()) {
      throw new Error(
        "Playwright Chromium is not installed and auto-install failed. " +
          "Run `npx playwright install chromium chromium-headless-shell` manually (check network/permissions), then re-run the audit.",
      );
    }
    // Retry once after a successful install.
    return await chromium.launch(options);
  }
}

/**
 * Close a browser without ever throwing — used in finally blocks so a
 * close failure can't mask the real error or crash the process.
 */
export async function closeBrowserQuietly(browser: Browser | undefined | null): Promise<void> {
  if (!browser) return;
  try {
    await browser.close();
  } catch {
    /* browser already gone — nothing to do */
  }
}
