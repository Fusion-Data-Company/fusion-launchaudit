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
import { runAxeOnPage } from "./axe-audit.ts";
import { runWebVitalsOnPage } from "./web-vitals-audit.ts";
import { extractCveIds, parseEpssResponse, parseKevCatalog, rankVulns, type VulnEntry } from "../src/lib/report/vuln-priority.ts";
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
  /** Request->status transcript for no-browser (HTTP/SEO/EL) cards — the evidence a pass stands on. */
  httpEvidence?: string;
};

type ExecOptions = { appUrl: string; artifactDir: string };

const BLOCKED_STATUSES = new Set([301, 302, 303, 307, 308, 401, 403]);
const describeStep = (s: ExecStep) => JSON.stringify(s);

// --- SPA-shell detection (Truth Protocol) ----------------------------------
// A client-rendered app (React/Vue/Svelte SPA) serves the SAME HTML shell for
// every route and renders the real page in the browser; the route is guarded
// client-side and the true authorization gate is the API. So a 200 on an
// "expectBlocked" route is NOT proof of exposure when the body is just that
// shell. We compare the body to the homepage skeleton (cached per origin) and
// look for an empty mount node — only then do we downgrade (verify, not claim).
const _homeShellCache = new Map<string, string>();
function stripDynamic(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
function visibleTextLen(html: string): number {
  return stripDynamic(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;
}
/** Pure test (exported for unit tests): is `body` just a client app shell, judged against homepage `home`? */
export function isClientShellBody(body: string, home: string): boolean {
  const emptyRoot = /<div[^>]*\bid=["'](?:root|app|__next|app-root|root-app)["'][^>]*>\s*<\/div>/i.test(body);
  const spaMarker = /data-reactroot|<app-root\b|__NEXT_DATA__|ng-version=|window\.__NUXT__|id=["']svelte["']/i.test(body);
  const a = stripDynamic(body);
  const b = stripDynamic(home);
  const sameAsHome = b.length > 0 && a === b;
  let nearHome = false;
  if (b.length > 0 && !sameAsHome) {
    const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
    nearHome = ratio > 0.92 && visibleTextLen(body) < 2000;
  }
  // Only a POSITIVE shell signal downgrades. Real server-rendered content
  // (substantial visible text, differs from home, no empty mount) stays "exposed".
  return sameAsHome || nearHome || ((emptyRoot || spaMarker) && visibleTextLen(body) < 2000);
}
async function fetchHomeShell(appUrl: string): Promise<string> {
  let origin: string;
  try { origin = new URL(appUrl).origin; } catch { return ""; }
  if (_homeShellCache.has(origin)) return _homeShellCache.get(origin)!;
  let body = "";
  try { const r = await fetch(origin + "/", { redirect: "manual" }); body = await r.text(); } catch { body = ""; }
  _homeShellCache.set(origin, body);
  return body;
}
async function isClientRenderedShell(appUrl: string, body: string): Promise<boolean> {
  return isClientShellBody(body, await fetchHomeShell(appUrl));
}

function resolveUrl(appUrl: string, step: { url?: string; path?: string }) {
  return step.url ?? `${appUrl}${step.path ?? "/"}`;
}

async function runHttp(step: Extract<ExecStep, { action: "http" }>, appUrl: string, sink?: string[]) {
  const target = resolveUrl(appUrl, step);
  const headers: Record<string, string> = { ...(step.headers ?? {}) };
  if (step.cookie) headers["cookie"] = step.cookie;
  if (step.corsProbeOrigin) headers["origin"] = step.corsProbeOrigin;
  let body: string | undefined;
  if (step.body !== undefined) {
    body = typeof step.body === "string" ? step.body : JSON.stringify(step.body);
    headers["content-type"] = headers["content-type"] ?? "application/json";
  }
  const res = await fetch(target, { method: step.method ?? "GET", headers, body, redirect: "manual" });
  const status = res.status;
  const text = await res.text();
  // Record the receipt before assertions so both pass and fail carry evidence.
  if (sink) sink.push(`${step.method ?? "GET"} ${target} -> ${status}`);

  if (step.expectStatusOneOf && !step.expectStatusOneOf.includes(status)) {
    throw new Error(`${step.method ?? "GET"} ${target}: expected status in [${step.expectStatusOneOf}], got ${status}`);
  }
  if (step.expectStatusNot && step.expectStatusNot.includes(status)) {
    throw new Error(`${step.method ?? "GET"} ${target}: status ${status} is not allowed here`);
  }
  if (step.expectBlocked && !BLOCKED_STATUSES.has(status)) {
    const reqMethod = (step.method ?? "GET").toUpperCase();
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if ((reqMethod === "OPTIONS" || reqMethod === "HEAD") && (status === 200 || status === 204)) {
      // CORS preflight / metadata verb — a 200/204 here is expected and is NOT an
      // exposed privileged action (the real verb, e.g. GET/POST, is tested separately).
    } else if (status === 200 && ct.includes("text/html") && (await isClientRenderedShell(appUrl, text))) {
      // SPA caveat: a 200 that is only the client app shell can't prove exposure —
      // the page is guarded in the browser; the API is the real gate. Verify, don't over-claim.
      throw new Error(`${step.method ?? "GET"} ${target}: returned a client-rendered SPA shell (200 text/html, same skeleton as "/") — an HTTP probe can't confirm this route is gated; the page is rendered and guarded in the browser and the real authorization gate is the API. Verify the API enforces authz (or re-run with an authenticated browser session). [SPA_SHELL]`);
    } else {
      throw new Error(`${step.method ?? "GET"} ${target}: expected access to be BLOCKED (redirect/401/403), but got ${status} — this surface is exposed`);
    }
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
  if (step.expectHeaderRecommended) {
    for (const h of step.expectHeaderRecommended) {
      if (!res.headers.get(h)) throw new Error(`${target}: missing recommended header "${h}" (defense-in-depth)`);
    }
  }
  if (step.expectHeaderExcludesTokens) {
    for (const [h, tokens] of Object.entries(step.expectHeaderExcludesTokens)) {
      const val = (res.headers.get(h) ?? "").toLowerCase();
      if (!val) continue; // presence handled by expectHeaderRecommended/Present
      for (const t of tokens) {
        if (val.includes(t.toLowerCase())) throw new Error(`${target}: header "${h}" carries permissive directive "${t}" (defense-in-depth)`);
      }
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
  if (step.expectBodyExcludesCI) {
    const lower = text.toLowerCase();
    for (const frag of step.expectBodyExcludesCI) {
      if (lower.includes(frag.toLowerCase())) throw new Error(`${target}: response reflected/leaked "${frag}" (injection signature — unescaped reflection or a DB/engine error)`);
    }
  }
  if (step.expectBodyExcludesRegex) {
    for (const { label, pattern } of step.expectBodyExcludesRegex) {
      let re: RegExp;
      try { re = new RegExp(pattern); } catch { continue; }
      // Redact: never echo the matched secret — report only the labeled pattern.
      if (re.test(text)) throw new Error(`${target}: response body exposes ${label}`);
    }
  }
  if (step.expectBodyIncludesAny) {
    const lower = text.toLowerCase();
    const found = step.expectBodyIncludesAny.needles.some((n) => lower.includes(n.toLowerCase()));
    if (!found) throw new Error(`${target}: ${step.expectBodyIncludesAny.label} not found in the page (looked for ${step.expectBodyIncludesAny.needles.slice(0, 4).join(", ")})`);
  }
  if (step.expectCookieFlags) {
    // Node 22's getSetCookie() returns each Set-Cookie separately; fall back to the combined header.
    const getSetCookie = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
    const cookies = typeof getSetCookie === "function" ? getSetCookie.call(res.headers) : [res.headers.get("set-cookie") ?? ""];
    const joined = cookies.join(" ; ");
    if (!joined.trim()) throw new Error(`${target}: no Set-Cookie on the response — cannot evaluate session-cookie flags`);
    for (const flag of step.expectCookieFlags) {
      // SameSite needs a value; HttpOnly/Secure are bare attributes.
      const present = flag.toLowerCase() === "samesite"
        ? /;\s*samesite\s*=/i.test(joined)
        : new RegExp(`;\\s*${flag.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "i").test(joined);
      if (!present) throw new Error(`${target}: session cookie is missing the "${flag}" attribute — Set-Cookie: ${joined.slice(0, 160)}`);
    }
  }
  if (step.corsProbeOrigin) {
    const acao = res.headers.get("access-control-allow-origin") ?? "";
    const acac = (res.headers.get("access-control-allow-credentials") ?? "").toLowerCase() === "true";
    const reflectsProbe = acao === step.corsProbeOrigin || acao === "*";
    if (reflectsProbe && acac) {
      throw new Error(`${target}: CORS reflects Origin "${acao}" together with Access-Control-Allow-Credentials: true — any site can make credentialed cross-origin requests`);
    }
  }
}

/** Fetch a resource as one identity; return status + visible content length + shell flag. */
async function fetchAs(appUrl: string, target: string, method: string, cookie: string | undefined): Promise<{ status: number; len: number; shell: boolean }> {
  const headers: Record<string, string> = {};
  if (cookie) headers["cookie"] = cookie;
  const res = await fetch(target, { method, headers, redirect: "manual" });
  const text = await res.text();
  const ct = (res.headers.get("content-type") ?? "").toLowerCase();
  const shell = res.status === 200 && ct.includes("text/html") && (await isClientRenderedShell(appUrl, text));
  return { status: res.status, len: visibleTextLen(text), shell };
}

/**
 * Two-identity metamorphic authorization probe (read-only). See the ExecStep doc.
 * The relation that needs no oracle: on a resource the ADMIN sees (2xx, non-trivial
 * body), every lower-privilege identity must be denied OR see strictly less content.
 * We only flag when a lower identity sees ~all of admin's content (>= 90%), so a
 * partial/empty/denied/shell response never false-positives.
 */
async function runTwoIdentity(step: Extract<ExecStep, { action: "two_identity" }>, appUrl: string, sink?: string[]) {
  const target = resolveUrl(appUrl, step);
  const method = (step.method ?? "GET").toUpperCase();
  const admin = await fetchAs(appUrl, target, method, step.adminCookie);
  if (sink) sink.push(`${method} ${target} as admin -> ${admin.status} (${admin.len} chars)`);

  // Baseline must be a real, non-trivial admin-only resource; otherwise there's nothing to compare.
  const adminOk = admin.status >= 200 && admin.status < 300 && !admin.shell && admin.len >= 200;
  if (!adminOk) {
    throw new Error(`[BLOCKED] two-identity check needs an admin baseline: as admin, ${method} ${target} returned ${admin.status}${admin.shell ? " (SPA shell)" : ""} with ${admin.len} visible chars — cannot compare privilege levels (re-run with a valid admin session / a resource the admin can read).`);
  }

  for (const id of step.lower) {
    const low = await fetchAs(appUrl, target, method, id.cookie);
    if (sink) sink.push(`${method} ${target} as ${id.role} -> ${low.status} (${low.len} chars)`);
    const denied = BLOCKED_STATUSES.has(low.status) || low.status === 404 || low.status >= 500;
    if (denied || low.shell) continue; // properly gated (or unprovable shell) — relation holds
    if (low.status >= 200 && low.status < 300 && low.len >= 0.9 * admin.len) {
      throw new Error(`${method} ${target}: the "${id.role}" identity received ${low.status} with ${low.len} visible chars — ~the same content the admin sees (${admin.len}). A lower-privilege response must never contain as much as a higher-privilege one; the authorization gradient is broken (WSTG-ATHZ / SMRL metamorphic relation).`);
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
    case "axe": await runAxeOnPage(page, step.impactFloor ?? "serious"); return;
    case "wcag22": await runWcag22Check(page, step.check); return;
    case "web_vitals": await runWebVitalsOnPage(page); return;
    case "expect_console_clean": if (state.consoleErrors.length) throw new Error(`Console errors: ${state.consoleErrors.slice(0, 3).join(" | ").slice(0, 300)}`); return;
    case "expect_network_clean": if (state.failedRequests.length) throw new Error(`Failed requests: ${state.failedRequests.slice(0, 3).join(" | ").slice(0, 300)}`); return;
    case "http": await runHttp(step, appUrl); return;
    case "two_identity": await runTwoIdentity(step, appUrl); return;
    case "elevenlabs": await runElevenLabsAssertion(step.agentId, step.apiKeyEnv, step.assert); return;
    case "seo": await runSeoAssertion(resolveUrl(appUrl, step), step.assert); return;
    case "content": await runContentAssertion(resolveUrl(appUrl, step), step.assert); return;
    case "dep_cve_audit": await runDepCveAudit(step); return;
    case "secret_scan": await runSecretScan(step); return;
    case "license_audit": await runLicenseAudit(step); return;
    case "code_smell_scan": await runCodeSmellScan(step); return;
  }
}

// WCAG 2.2 AA checks that axe can't fully auto-detect (target size 2.5.8, focus order
// 2.4.3). Measured live in the rendered page. Conservative to stay honest: target-size
// looks only at real controls (button / submit-inputs / [role=button]/menuitem / select),
// NOT plain inline text links (2.5.8 exempts inline links in a sentence).
async function runWcag22Check(page: Page, check: "target_size" | "focus_order"): Promise<void> {
  if (check === "target_size") {
    const MIN = 24; // WCAG 2.2 SC 2.5.8 (AA): minimum 24×24 CSS px
    const undersized = await page.evaluate((min) => {
      const SEL = 'button, input[type="submit"], input[type="button"], input[type="reset"], [role="button"], [role="menuitem"], [role="tab"], select';
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll(SEL))) {
        const r = (el as HTMLElement).getBoundingClientRect();
        const style = getComputedStyle(el as HTMLElement);
        if (style.display === "none" || style.visibility === "hidden" || r.width === 0 || r.height === 0) continue;
        if (r.width < min || r.height < min) {
          const label = (el as HTMLElement).innerText?.trim().slice(0, 24) || (el as HTMLElement).getAttribute("aria-label") || (el.tagName.toLowerCase());
          out.push(`${label} (${Math.round(r.width)}×${Math.round(r.height)}px)`);
        }
      }
      return out;
    }, MIN);
    if (undersized.length) throw new Error(`${undersized.length} interactive target(s) below 24×24px (WCAG 2.2 SC 2.5.8): ${undersized.slice(0, 6).join(", ")}`);
    return;
  }
  // focus_order (2.4.3) smoke: a positive tabindex overrides the natural DOM order and is a
  // well-known focus-order hazard. Not a guaranteed violation → surfaced as a question.
  const positives = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll("[tabindex]"))) {
      const t = parseInt(el.getAttribute("tabindex") || "0", 10);
      if (t > 0) out.push(`${el.tagName.toLowerCase()}[tabindex=${t}]`);
    }
    return out;
  });
  if (positives.length) throw new Error(`${positives.length} element(s) use a positive tabindex, which overrides natural focus order (WCAG 2.2 SC 2.4.3 hazard): ${positives.slice(0, 6).join(", ")}`);
}

/** Deterministic, no-browser cards: raw HTTP (BE/RBAC/middleware/security/write-authz), ElevenLabs, and SEO API checks. */
const NO_BROWSER_ACTIONS = new Set(["http", "two_identity", "elevenlabs", "seo", "content", "dep_cve_audit", "secret_scan", "license_audit", "code_smell_scan"]);
export const isNoBrowser = (card: ExecutableTestCard) => card.exec.length > 0 && card.exec.every((s) => NO_BROWSER_ACTIONS.has(s.action));

async function runNoBrowserStep(step: ExecStep, appUrl: string, sink?: string[]): Promise<void> {
  if (step.action === "http") return runHttp(step, appUrl, sink);
  if (step.action === "two_identity") return runTwoIdentity(step, appUrl, sink);
  if (step.action === "elevenlabs") return runElevenLabsAssertion(step.agentId, step.apiKeyEnv, step.assert);
  if (step.action === "seo") return runSeoAssertion(resolveUrl(appUrl, step), step.assert);
  if (step.action === "content") return runContentAssertion(resolveUrl(appUrl, step), step.assert);
  if (step.action === "dep_cve_audit") return runDepCveAudit(step);
  if (step.action === "secret_scan") return runSecretScan(step);
  if (step.action === "license_audit") return runLicenseAudit(step);
  if (step.action === "code_smell_scan") return runCodeSmellScan(step);
  throw new Error(`runNoBrowserStep got a browser action: ${step.action}`);
}

type OsvBatchResponse = { results?: Array<{ vulns?: Array<{ id?: string; aliases?: string[] }> }> };
type DepCveStep = { deps?: Array<{ ecosystem: string; name: string; version: string }>; direct?: string[]; imported?: string[] };

/** Pure: turn an OSV querybatch response into a finding summary (exported for tests). */
export function summarizeOsv(
  deps: Array<{ name: string; version: string }>,
  resp: OsvBatchResponse,
  direct: Set<string>,
  imported: Set<string> = new Set(),
): { count: number; directCount: number; importedCount: number; lines: string[] } {
  const directLines: string[] = [];
  const transitiveLines: string[] = [];
  let importedCount = 0;
  (resp.results ?? []).forEach((r, i) => {
    const vulns = r?.vulns;
    const d = deps[i];
    if (!d || !vulns || vulns.length === 0) return;
    const ids = vulns.map((v) => v.id).filter(Boolean).slice(0, 4).join(", ");
    const isImported = imported.has(d.name);
    if (isImported) importedCount += 1;
    const line = `${d.name}@${d.version}${isImported ? " [imported]" : ""}: ${vulns.length} advisor${vulns.length === 1 ? "y" : "ies"} (${ids}${vulns.length > 4 ? ", …" : ""})`;
    (direct.has(d.name) ? directLines : transitiveLines).push(line);
  });
  const lines = [...directLines, ...transitiveLines];
  return { count: lines.length, directCount: directLines.length, importedCount, lines };
}

async function osvQueryBatch(queries: unknown[]): Promise<OsvBatchResponse> {
  const res = await fetch("https://api.osv.dev/v1/querybatch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ queries }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as OsvBatchResponse;
}

/** SCA: check resolved dependency versions against OSV.dev (free, no key). */
async function runDepCveAudit(step: DepCveStep): Promise<void> {
  const deps = step.deps ?? [];
  if (deps.length === 0) return;
  const direct = new Set(step.direct ?? []);
  const queries = deps.map((d) => ({ package: { ecosystem: d.ecosystem, name: d.name }, version: d.version }));

  let resp: OsvBatchResponse;
  try {
    const CHUNK = 500;
    const merged: OsvBatchResponse = { results: [] };
    for (let i = 0; i < queries.length; i += CHUNK) {
      const part = await osvQueryBatch(queries.slice(i, i + CHUNK));
      merged.results = [...(merged.results ?? []), ...(part.results ?? [])];
    }
    resp = merged;
  } catch (e) {
    // A failed lookup is our tooling/network (classify -> test_bug), never a claim about the app.
    throw new Error(`OSV query failed (${(e as Error).message}) — could not check dependencies; re-run with network access`);
  }

  const imported = new Set(step.imported ?? []);
  const { count, directCount, importedCount } = summarizeOsv(deps, resp, direct, imported);
  if (count > 0) {
    // Build per-dep entries with their CVE ids, then prioritize by real exploitability
    // (CISA KEV + EPSS) so "fix these first" is meaningful, not CVSS noise. Enrichment
    // is best-effort: a network failure degrades to reachability order, never a throw.
    const entries: VulnEntry[] = [];
    (resp.results ?? []).forEach((r, i) => {
      const vulns = r?.vulns;
      const d = deps[i];
      if (!d || !vulns || vulns.length === 0) return;
      entries.push({ name: d.name, version: d.version, direct: direct.has(d.name), imported: imported.has(d.name), cveIds: extractCveIds(vulns), advisoryCount: vulns.length });
    });
    const allCves = [...new Set(entries.flatMap((e) => e.cveIds))];
    const [epss, kev] = await Promise.all([fetchEpss(allCves), fetchKev()]);
    const ranked = rankVulns(entries, epss, kev);
    const kevCount = ranked.filter((r) => r.kev).length;
    const lines = ranked.map((r) => `${r.name}@${r.version}${r.tag ? " " + r.tag : ""}${r.imported ? " [imported]" : ""}: ${r.advisoryCount} advisor${r.advisoryCount === 1 ? "y" : "ies"} — ${r.priority}`);
    const shown = lines.slice(0, 8);
    const more = count > 8 ? ` | …+${count - 8} more` : "";
    const reach = importedCount > 0 ? `${importedCount} imported by your code` : `none imported by your code (transitive/unused — lower priority)`;
    const kevNote = kevCount > 0 ? `${kevCount} KNOWN-EXPLOITED (CISA KEV) — fix first; ` : "";
    throw new Error(
      `${count} dependency version${count === 1 ? "" : "s"} match a known OSV/GHSA advisory (${kevNote}${directCount} direct; ${reach}): ${shown.join(" | ")}${more}`,
    );
  }
}

// EPSS (FIRST) — probability a CVE is exploited in the next 30 days. Best-effort, chunked,
// short timeout. Never throws — enrichment failure just means no EPSS scores.
async function fetchEpss(cveIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (cveIds.length === 0) return out;
  const CHUNK = 90;
  for (let i = 0; i < cveIds.length; i += CHUNK) {
    const batch = cveIds.slice(i, i + CHUNK);
    try {
      const res = await fetch(`https://api.first.org/data/v1/epss?cve=${batch.join(",")}`, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) continue;
      for (const [k, v] of parseEpssResponse(await res.json())) out.set(k, v);
    } catch { /* best-effort */ }
  }
  return out;
}

// CISA Known Exploited Vulnerabilities catalog. Best-effort, short timeout, cached per run.
let _kevCache: Set<string> | null = null;
async function fetchKev(): Promise<Set<string>> {
  if (_kevCache) return _kevCache;
  try {
    const res = await fetch("https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json", { signal: AbortSignal.timeout(5000) });
    if (res.ok) { _kevCache = parseKevCatalog(await res.json()); return _kevCache; }
  } catch { /* best-effort */ }
  _kevCache = new Set();
  return _kevCache;
}

type LicenseAuditStep = { flagged?: Array<{ name: string; license: string; kind: "copyleft" | "unknown" }> };

/** License compliance: the read ran in the generator; this reports the flagged set.
 *  A license obligation is a legal/policy call, not a code defect → classify verifies. */
async function runLicenseAudit(step: LicenseAuditStep): Promise<void> {
  const flagged = step.flagged ?? [];
  if (flagged.length === 0) return;
  const copyleft = flagged.filter((f) => f.kind === "copyleft");
  const unknown = flagged.filter((f) => f.kind === "unknown");
  const parts: string[] = [];
  if (copyleft.length) parts.push(`${copyleft.length} copyleft (${copyleft.slice(0, 5).map((f) => `${f.name}: ${f.license}`).join(", ")}${copyleft.length > 5 ? ", …" : ""})`);
  if (unknown.length) parts.push(`${unknown.length} unknown-license (${unknown.slice(0, 5).map((f) => f.name).join(", ")}${unknown.length > 5 ? ", …" : ""})`);
  throw new Error(`${flagged.length} direct dependenc${flagged.length === 1 ? "y" : "ies"} need license review: ${parts.join("; ")}`);
}

type CodeSmellStep = { hits?: Array<{ file: string; line: number; rule: string; cwe: string }> };

/** SAST-lite: the grep ran in the generator; this reports the sinks to review.
 *  A grep match is a sink to confirm, not a proven exploit → classify verifies. */
async function runCodeSmellScan(step: CodeSmellStep): Promise<void> {
  const hits = step.hits ?? [];
  if (hits.length === 0) return;
  const shown = hits.slice(0, 8).map((h) => `${h.rule} (${h.cwe}) at ${h.file}:${h.line}`);
  const more = hits.length > 8 ? ` | …+${hits.length - 8} more` : "";
  throw new Error(`${hits.length} dangerous code sink${hits.length === 1 ? "" : "s"} to review: ${shown.join(" | ")}${more}`);
}

type SecretScanStep = { hits?: Array<{ file: string; line: number; rule: string; preview: string; knownFormat: boolean }> };

/** Secrets scan: the scan ran in the generator; this turns its REDACTED hits into a finding.
 *  Never prints a raw secret — the generator already reduced each hit to a first4…last4 preview. */
async function runSecretScan(step: SecretScanStep): Promise<void> {
  const hits = step.hits ?? [];
  if (hits.length === 0) return;
  // Emit "known" (live-format) first so the summary leads with the highest-severity items.
  const sorted = [...hits].sort((a, b) => Number(b.knownFormat) - Number(a.knownFormat));
  const knownCount = hits.filter((h) => h.knownFormat).length;
  const shown = sorted.slice(0, 8).map((h) => `${h.file}:${h.line} ${h.rule} (${h.preview})`);
  const more = hits.length > 8 ? ` | …+${hits.length - 8} more` : "";
  const lead = knownFlag(knownCount, hits.length);
  throw new Error(`${lead}: ${shown.join(" | ")}${more}`);
}

/** Phrase the lead so classify can branch: a known-format hit anywhere => the high-severity wording. */
function knownFlag(knownCount: number, total: number): string {
  if (knownCount > 0) {
    return `${total} exposed secret${total === 1 ? "" : "s"} in tracked files (${knownCount} live-format)`;
  }
  return `${total} high-entropy secret-like string${total === 1 ? "" : "s"} in tracked files (entropy-only)`;
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
    const transcript: string[] = [];
    for (const step of card.exec) {
      try { await runNoBrowserStep(step, options.appUrl, transcript); }
      catch (e) { status = "failed"; failedStep = describeStep(step); error = e instanceof Error ? e.message : String(e); break; }
    }
    return { card, status, failedStep, error, consoleErrors: [], failedRequests: [], screenshotPath: "", tracePath: "", startedAt, endedAt: new Date().toISOString(), attempts: 1, httpEvidence: transcript.join("\n") };
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

/** Run ONLY no-browser cards (HTTP/SEO/EL) without launching a browser — keeps
 *  pure-API audits (and the watchdog re-runs over them) free of Playwright. */
export async function executeNoBrowserCards(cards: ExecutableTestCard[], options: ExecOptions): Promise<CardResult[]> {
  const results: CardResult[] = [];
  for (const card of cards) {
    const r = await executeOne(undefined as unknown as Browser, card, options);
    results.push(r);
    const tag = r.status === "passed" ? "PASS" : "FAIL";
    console.error(`      ${tag}  ${card.id}  ${card.title}${r.status === "failed" && r.error ? ` — ${r.error.slice(0, 100)}` : ""}`);
  }
  return results;
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
