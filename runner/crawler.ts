/**
 * Runtime crawler — opens the target app in a real browser and maps what
 * actually exists: same-origin links, forms, buttons, title. This is what
 * makes generated test cards specific to THE app instead of generic.
 */
import { launchBrowser } from "./browser.ts";

export type RuntimeCrawl = {
  app_url: string;
  reachable: boolean;
  title: string;
  links: Array<{ href: string; text: string }>;
  form_count: number;
  button_count: number;
  has_password_field: boolean;
  console_errors_on_load: number;
  crawled_at: string;
};

export async function crawlRuntime(appUrl: string): Promise<RuntimeCrawl> {
  const base = appUrl.replace(/\/$/, "");
  const browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  let consoleErrors = 0;
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors += 1;
  });

  const result: RuntimeCrawl = {
    app_url: base,
    reachable: false,
    title: "",
    links: [],
    form_count: 0,
    button_count: 0,
    has_password_field: false,
    console_errors_on_load: 0,
    crawled_at: new Date().toISOString(),
  };

  try {
    const response = await page.goto(base, { waitUntil: "domcontentloaded", timeout: 30000 });
    result.reachable = Boolean(response && response.status() < 500);
    // Best-effort settle for SPA hydration / async content. Real apps with
    // websockets, animation loops, or analytics beacons never reach "networkidle";
    // we wait softly and move on instead of hard-failing a reachable site.
    try { await page.waitForLoadState("networkidle", { timeout: 6000 }); } catch { /* busy app — fine */ }
    await page.waitForTimeout(800);
    result.title = await page.title();

    const origin = new URL(base).origin;
    const dom = await page.evaluate((originStr) => {
      const links: Array<{ href: string; text: string }> = [];
      const seen = new Set<string>();
      for (const a of document.querySelectorAll("a[href]")) {
        const href = (a as HTMLAnchorElement).href;
        if (!href.startsWith(originStr)) continue;
        const normalized = href.split("?")[0];
        if (seen.has(normalized) || normalized === originStr + "/" || normalized === originStr) continue;
        seen.add(normalized);
        links.push({ href: normalized, text: (a.textContent ?? "").trim().slice(0, 60) });
        if (links.length >= 10) break;
      }
      return {
        links,
        form_count: document.querySelectorAll("form").length,
        button_count: document.querySelectorAll("button, [role=button]").length,
        has_password_field: document.querySelectorAll('input[type="password"]').length > 0,
      };
    }, origin);

    result.links = dom.links;
    result.form_count = dom.form_count;
    result.button_count = dom.button_count;
    result.has_password_field = dom.has_password_field;
    result.console_errors_on_load = consoleErrors;
  } catch {
    result.reachable = false;
  }

  await browser.close();
  return result;
}
