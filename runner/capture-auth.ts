/**
 * Auth capture — logs into the app with developer-provided test credentials
 * (locally, never sent anywhere), saves a Playwright storage state + cookie
 * header per role. Enables role-based admin/RBAC checks: run the same admin
 * route as anonymous, as a normal user, and as an admin, and compare.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

export type CapturedAuth = { role: string; storageStatePath: string; cookieHeader: string };

export async function captureAuth(opts: {
  appUrl: string; loginPath?: string; username: string; password: string;
  usernameSelector?: string; passwordSelector?: string; submitSelector?: string;
  role: string; outDir: string;
}): Promise<CapturedAuth> {
  const base = opts.appUrl.replace(/\/$/, "");
  const loginUrl = `${base}${opts.loginPath ?? "/login"}`;
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(loginUrl, { waitUntil: "networkidle", timeout: 25000 });

  const userSel = opts.usernameSelector ?? 'input[name="username"], input[name="email"], input[type="email"], input[name="user"]';
  const passSel = opts.passwordSelector ?? 'input[name="password"], input[type="password"]';
  const subSel = opts.submitSelector ?? 'button[type="submit"], input[type="submit"], form button';

  await page.fill(userSel, opts.username, { timeout: 8000 });
  await page.fill(passSel, opts.password, { timeout: 8000 });
  await Promise.all([
    page.waitForLoadState("networkidle").catch(() => {}),
    page.click(subSel, { timeout: 8000 }).catch(() => {}),
  ]);
  await page.waitForTimeout(800);

  await fs.mkdir(opts.outDir, { recursive: true });
  const storageStatePath = path.join(opts.outDir, `${opts.role}.json`);
  await context.storageState({ path: storageStatePath });
  const cookies = await context.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  await browser.close();
  return { role: opts.role, storageStatePath, cookieHeader };
}
