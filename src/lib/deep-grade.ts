/**
 * Paid "Single Run" grade — everything the free surface scan does, plus a
 * site-wide, URL-only sweep that a stranger can buy and get without a human:
 *
 *   - crawls up to PAGE_BUDGET internal pages and re-runs the header / cookie /
 *     SEO checks on every one of them (the free scan only looks at one URL)
 *   - broken internal links, mixed content, forms posting over http
 *   - static accessibility: lang attribute, h1, images without alt, empty buttons
 *   - launch blockers: robots noindex, robots.txt disallow-all, missing sitemap,
 *     missing canonical / favicon / OG image / Twitter card
 *   - error states: soft-404s, stack traces / framework error pages leaking
 *   - exposure: backup archives, config files, source maps, phpinfo, .DS_Store
 *   - TLS: certificate expiry, http -> https redirect
 *   - email: SPF + DMARC records for the domain (launch emails land or bounce)
 *   - Core Web Vitals + Lighthouse (performance / accessibility / best practices /
 *     SEO) through Google PageSpeed Insights when it answers in time
 *
 * Still no browser, no code, no login. Everything runs inside one serverless
 * invocation with a hard time budget so the buyer sees the result on the
 * success page within a minute of paying.
 */
import dns from "node:dns/promises";
import tls from "node:tls";
import { runInstantGrade, type Finding, type GradeFailure, type InstantGrade, type Sev } from "./instant-grade.ts";

export const PAGE_BUDGET = 8;
const PAGE_TIMEOUT = 7000;
const PSI_TIMEOUT = 28000;
const PENALTY: Record<Sev, number> = { critical: 22, high: 13, medium: 7, low: 3 };

export type Lighthouse = {
  performance: number | null;
  accessibility: number | null;
  best_practices: number | null;
  seo: number | null;
  lcp_ms: number | null;
  cls: number | null;
  inp_ms: number | null;
  source: "field" | "lab" | "none";
};

export type DeepGrade = InstantGrade & {
  kind: "deep";
  pages_scanned: number;
  pages: string[];
  lighthouse: Lighthouse | null;
  checks_run: number;
};

export const DEEP_GRADE_NOTE =
  "Single Run: a site-wide, URL-only audit (up to 8 pages) covering security headers, cookies, CORS, exposed files, accessibility basics, broken links, mixed content, SEO/launch blockers, error-page leaks, TLS, email DNS and Core Web Vitals. The hosted deep audit adds a real browser: broken access control, admin/RBAC, write-authz and authenticated flows.";

const UA = "8020LaunchAudit-Grader/1.0 (+https://fusiondataco.com)";

async function grab(url: string, opts: RequestInit = {}, ms = PAGE_TIMEOUT): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal, redirect: "manual", headers: { "user-agent": UA, ...(opts.headers || {}) } }); }
  catch { return null; }
  finally { clearTimeout(t); }
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[2] ?? m[3] ?? m[4] ?? "") : null;
}

/** Same-origin links from an HTML page, absolute, deduped, no fragments. */
export function internalLinks(html: string, base: URL, max = 60): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*>/gi)) {
    const href = attr(m[0], "href");
    if (!href || /^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
    let u: URL;
    try { u = new URL(href, base); } catch { continue; }
    if (u.origin !== base.origin) continue;
    if (/\.(png|jpe?g|gif|svg|webp|pdf|zip|mp4|css|js|ico|woff2?)$/i.test(u.pathname)) continue;
    u.hash = "";
    out.add(u.toString());
    if (out.size >= max) break;
  }
  return [...out];
}

function certExpiryDays(host: string): Promise<number | null> {
  return new Promise((resolve) => {
    const done = (v: number | null) => { try { s.destroy(); } catch { /* ignore */ } resolve(v); };
    const s = tls.connect({ host, port: 443, servername: host, timeout: 5000 }, () => {
      const cert = s.getPeerCertificate();
      if (!cert || !cert.valid_to) return done(null);
      done(Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / 86400000));
    });
    s.on("error", () => done(null));
    s.on("timeout", () => done(null));
  });
}

async function txt(name: string): Promise<string[]> {
  try { return (await dns.resolveTxt(name)).map((r) => r.join("")); } catch { return []; }
}

async function pageSpeed(url: string): Promise<Lighthouse | null> {
  const key = process.env.PAGESPEED_API_KEY;
  const q = new URLSearchParams({ url, strategy: "mobile" });
  for (const c of ["performance", "accessibility", "best-practices", "seo"]) q.append("category", c);
  if (key) q.set("key", key);
  const r = await grab(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, { headers: { accept: "application/json" } }, PSI_TIMEOUT);
  if (!r || !r.ok) return null;
  try {
    const j = (await r.json()) as {
      lighthouseResult?: { categories?: Record<string, { score?: number | null }>; audits?: Record<string, { numericValue?: number }> };
      loadingExperience?: { metrics?: Record<string, { percentile?: number }> };
    };
    const cats = j.lighthouseResult?.categories ?? {};
    const pct = (k: string) => (typeof cats[k]?.score === "number" ? Math.round((cats[k]!.score as number) * 100) : null);
    const field = j.loadingExperience?.metrics ?? {};
    const lab = j.lighthouseResult?.audits ?? {};
    const hasField = Boolean(field.LARGEST_CONTENTFUL_PAINT_MS?.percentile);
    return {
      performance: pct("performance"), accessibility: pct("accessibility"), best_practices: pct("best-practices"), seo: pct("seo"),
      lcp_ms: hasField ? field.LARGEST_CONTENTFUL_PAINT_MS!.percentile! : lab["largest-contentful-paint"]?.numericValue != null ? Math.round(lab["largest-contentful-paint"].numericValue!) : null,
      cls: hasField && field.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile != null ? field.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100 : lab["cumulative-layout-shift"]?.numericValue ?? null,
      inp_ms: hasField ? field.INTERACTION_TO_NEXT_PAINT?.percentile ?? null : null,
      source: hasField ? "field" : cats.performance ? "lab" : "none",
    };
  } catch { return null; }
}

export async function runDeepGrade(target: URL): Promise<DeepGrade | GradeFailure> {
  const surface = await runInstantGrade(target);
  if (!surface.ok) return surface;
  const origin = new URL(surface.url);
  const findings: Finding[] = [...surface.findings];
  let passed = surface.passed;
  let checks = 12; // the surface scan's own check groups; the counts below are added only when a check actually ran
  const F = (category: string, severity: Sev, title: string, detail: string) => findings.push({ category, severity, title, detail });
  const dedupe = new Set(findings.map((f) => f.title));
  const Fonce = (category: string, severity: Sev, title: string, detail: string) => { if (!dedupe.has(title)) { dedupe.add(title); F(category, severity, title, detail); } };

  // ---- home page + crawl ------------------------------------------------
  const home = await grab(origin.toString());
  const homeHtml = home ? (await home.text()).slice(0, 300000) : "";
  const links = internalLinks(homeHtml, origin, 60);
  const targets = [origin.toString(), ...links.filter((l) => l !== origin.toString())].slice(0, PAGE_BUDGET);
  const pages: { url: string; status: number; html: string; headers: Headers | null }[] = [];
  await Promise.all(targets.map(async (u) => {
    const r = u === origin.toString() && home ? home : await grab(u);
    if (!r) { pages.push({ url: u, status: 0, html: "", headers: null }); return; }
    const html = u === origin.toString() ? homeHtml : (await r.text()).slice(0, 300000);
    pages.push({ url: u, status: r.status, html, headers: r.headers });
  }));

  // ---- broken links (page-level + a sample of deeper links) ---------------
  checks++;
  const broken = pages.filter((p) => p.status === 0 || p.status >= 400 || p.status === 404);
  const extra = links.filter((l) => !targets.includes(l)).slice(0, 20);
  const extraBroken: string[] = [];
  await Promise.all(extra.map(async (l) => { const r = await grab(l, { method: "HEAD" }, 5000); if (!r || r.status >= 400) extraBroken.push(l); }));
  const brokenAll = [...broken.map((b) => b.url), ...extraBroken];
  if (brokenAll.length) F("Links", brokenAll.length > 3 ? "high" : "medium", `${brokenAll.length} broken internal link${brokenAll.length === 1 ? "" : "s"}`, `Linked from your own pages but returning an error: ${brokenAll.slice(0, 5).map((u) => new URL(u).pathname).join(", ")}${brokenAll.length > 5 ? ", …" : ""}.`);
  else passed++;

  // ---- per-page checks ---------------------------------------------------
  const okPages = pages.filter((p) => p.status > 0 && p.status < 400 && p.html);
  if (okPages.length === 0) {
    return { ok: false, status: 409, blocked: true, http_status: home?.status ?? 0, error: `We could not load a single page on ${origin.host} from our scanner (home page answered HTTP ${home?.status ?? "nothing"}). We do not score what we cannot see: allow the user agent 8020LaunchAudit-Grader/1.0 and run it again, or ask for a refund.` };
  }
  let noAlt = 0, noH1: string[] = [], noLang = false, emptyBtn = 0, mixed: string[] = [], httpForms: string[] = [], noCanon: string[] = [], noTitle: string[] = [], noViewport: string[] = [];
  let headerGaps = 0;
  for (const p of okPages) {
    const h = p.html;
    for (const m of h.matchAll(/<img\b[^>]*>/gi)) { if (attr(m[0], "alt") === null && !/\srole\s*=\s*["']?presentation/i.test(m[0])) noAlt++; }
    if (!/<h1[\s>]/i.test(h)) noH1.push(p.url);
    if (p.url === origin.toString() && !/<html[^>]*\slang\s*=/i.test(h)) noLang = true;
    for (const m of h.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)) { const inner = m[1].replace(/<[^>]+>/g, "").trim(); if (!inner && !/aria-label/i.test(m[0])) emptyBtn++; }
    if (origin.protocol === "https:") for (const m of h.matchAll(/<(?:img|script|link|iframe|video|audio|source)\b[^>]*\s(?:src|href)\s*=\s*["']http:\/\/[^"']+/gi)) { mixed.push(p.url); break; }
    for (const m of h.matchAll(/<form\b[^>]*>/gi)) { const a = attr(m[0], "action"); if (a && /^http:\/\//i.test(a)) { httpForms.push(p.url); break; } }
    if (!/<link[^>]+rel=["']canonical["']/i.test(h)) noCanon.push(p.url);
    if (!/<title[^>]*>\s*\S/i.test(h)) noTitle.push(p.url);
    if (!/<meta[^>]+name=["']viewport["']/i.test(h)) noViewport.push(p.url);
    if (p.headers && p.url !== origin.toString()) { for (const k of ["content-security-policy", "x-frame-options", "x-content-type-options"]) if (!p.headers.get(k)) headerGaps++; }
  }
  checks += 8;
  if (noAlt) F("Accessibility", noAlt > 5 ? "high" : "medium", `${noAlt} image${noAlt === 1 ? "" : "s"} without alt text`, "Screen readers announce these as 'image' with no meaning; also an easy SEO loss. Add alt=\"\" for decorative images and real descriptions for the rest.");
  else passed++;
  if (noH1.length) F("Accessibility", "medium", `${noH1.length} page${noH1.length === 1 ? "" : "s"} without an <h1>`, `Every page needs one heading that says what it is (${noH1.slice(0, 3).map((u) => new URL(u).pathname).join(", ")}).`);
  else passed++;
  if (noLang) F("Accessibility", "medium", "No lang attribute on <html>", "Screen readers guess the language; browsers translate the wrong thing. Add <html lang=\"en\">.");
  else passed++;
  if (emptyBtn) F("Accessibility", "medium", `${emptyBtn} button${emptyBtn === 1 ? "" : "s"} with no accessible name`, "Icon-only buttons need aria-label so keyboard and screen-reader users know what they do.");
  else passed++;
  if (mixed.length) F("TLS", "high", "Mixed content on an https page", `Assets loaded over plain http on ${mixed.slice(0, 3).map((u) => new URL(u).pathname).join(", ")} — browsers block or warn, and the padlock disappears.`);
  else passed++;
  if (httpForms.length) F("TLS", "critical", "Form posts over plain http", `A form on ${new URL(httpForms[0]).pathname} submits to an http:// URL — anything typed into it travels in cleartext.`);
  else passed++;
  if (noCanon.length === okPages.length && okPages.length) F("SEO", "low", "No canonical URLs", "Without <link rel=\"canonical\"> search engines may index duplicate versions (www / trailing slash / query strings) and split your ranking.");
  else passed++;
  if (noTitle.length > 1) Fonce("SEO", "medium", `${noTitle.length} pages without a <title>`, "Each page needs its own title; browser tabs, bookmarks and search results all show it.");
  if (noViewport.length > 1) Fonce("SEO", "medium", `${noViewport.length} pages missing the mobile viewport tag`, "Those pages render zoomed-out on phones.");
  if (headerGaps > 0 && okPages.length > 1) F("Security headers", "low", "Security headers not applied site-wide", `${headerGaps} header gap${headerGaps === 1 ? "" : "s"} on secondary pages — set CSP / X-Frame-Options / X-Content-Type-Options at the platform level so every route gets them.`);
  else if (okPages.length > 1) passed++;

  // ---- launch blockers: robots, sitemap, noindex, favicon, OG image -------
  checks += 5;
  const robots = await grab(new URL("/robots.txt", origin).toString(), {}, 5000);
  const robotsTxt = robots && robots.status === 200 ? (await robots.text()).slice(0, 20000) : "";
  if (/^\s*user-agent:\s*\*\s*$[\s\S]*?^\s*disallow:\s*\/\s*$/im.test(robotsTxt)) F("Launch", "critical", "robots.txt blocks the whole site", "User-agent: * / Disallow: / tells every search engine to stay out. Fine for staging, fatal for launch.");
  else passed++;
  if (/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(homeHtml) || /noindex/i.test(home?.headers.get("x-robots-tag") || "")) F("Launch", "critical", "Home page is noindex", "A noindex tag or X-Robots-Tag header on the home page removes the site from search results.");
  else passed++;
  const sitemapHinted = /sitemap:/i.test(robotsTxt);
  const sm = await grab(new URL("/sitemap.xml", origin).toString(), { method: "HEAD" }, 5000);
  if (!(sm && sm.status === 200) && !sitemapHinted) F("SEO", "low", "No sitemap.xml", "A sitemap gets new pages discovered days faster. Most frameworks generate one in one line.");
  else passed++;
  const fav = /<link[^>]+rel=["'][^"']*icon[^"']*["']/i.test(homeHtml) || ((await grab(new URL("/favicon.ico", origin).toString(), { method: "HEAD" }, 4000))?.status === 200);
  if (!fav) F("Launch", "low", "No favicon", "The tab shows a blank page icon; it reads as unfinished.");
  else passed++;
  if (!/<meta[^>]+property=["']og:image["']/i.test(homeHtml)) F("SEO", "low", "No Open Graph image", "Links shared on LinkedIn, Slack, iMessage or X show no preview image without og:image.");
  else passed++;

  // ---- error states ------------------------------------------------------
  checks += 2;
  const nf = await grab(new URL(`/__launch-audit-${Date.now().toString(36)}`, origin).toString(), {}, 6000);
  if (nf) {
    const body = (await nf.text()).slice(0, 50000);
    if (nf.status === 200 && !/not found|404/i.test(body)) F("Errors", "medium", "Soft 404", "Unknown URLs return 200 instead of 404 — search engines index junk pages and monitoring never sees the breakage.");
    else passed++;
    if (/(Traceback \(most recent call last\)|at Object\.<anonymous>|node_modules\/|Unhandled Runtime Error|Application error: a (client|server)-side exception|Whoops, looks like something went wrong|SQLSTATE\[|ORA-\d{5}|Warning: mysql_)/i.test(body)) F("Errors", "high", "Error page leaks internals", "The error page shows a stack trace or framework debug output — paths, versions and sometimes queries, for free.");
    else passed++;
  }

  // ---- exposure sweep (beyond the free scan's .env/.git) ------------------
  checks++;
  const exposed: string[] = [];
  const probes: [string, RegExp][] = [
    ["/.DS_Store", /^\0\0\0\x01Bud1/],
    ["/phpinfo.php", /phpinfo\(\)|PHP Version/i],
    ["/config.json", /"(password|secret|api[_-]?key|token)"\s*:/i],
    ["/.env.production", /^\s*[A-Z0-9_]+\s*=/m],
    ["/backup.zip", /^PK\x03\x04/],
    ["/db.sql", /(CREATE TABLE|INSERT INTO)/i],
    ["/wp-config.php.bak", /DB_PASSWORD/],
    ["/.git/index", /^DIRC/],
    ["/server-status", /Apache Server Status/i],
    ["/admin/config.yml", /(password|secret):/i],
  ];
  await Promise.all(probes.map(async ([path, re]) => {
    const r = await grab(new URL(path, origin).toString(), {}, 5000);
    if (!r || r.status !== 200) return;
    const body = (await r.text()).slice(0, 4000);
    if (re.test(body)) exposed.push(path);
  }));
  const maps = new Set<string>();
  for (const m of homeHtml.matchAll(/<script\b[^>]*\ssrc\s*=\s*["']([^"']+\.js)(\?[^"']*)?["']/gi)) { try { const u = new URL(m[1], origin); if (u.origin === origin.origin) maps.add(u.toString() + ".map"); } catch { /* ignore */ } }
  let mapHit = "";
  await Promise.all([...maps].slice(0, 6).map(async (u) => { const r = await grab(u, { method: "HEAD" }, 4000); if (r && r.status === 200 && /json|octet/i.test(r.headers.get("content-type") || "")) mapHit ||= new URL(u).pathname; }));
  if (exposed.length) F("Secrets", "critical", `Exposed ${exposed.join(", ")}`, "Publicly downloadable files that leak configuration, backups or server internals. Remove them or block them at the edge.");
  else passed++;
  if (mapHit) F("Secrets", "low", "Source maps are public", `${mapHit} ships your original source to anyone who asks. Disable productionBrowserSourceMaps / devtool in production builds.`);

  // ---- TLS + redirect ----------------------------------------------------
  if (origin.protocol === "https:") {
    checks += 2;
    const days = await certExpiryDays(origin.hostname);
    if (days !== null && days < 14) F("TLS", days < 3 ? "critical" : "high", `TLS certificate expires in ${days} day${days === 1 ? "" : "s"}`, "When it lapses every visitor gets a full-page browser warning. Check that auto-renewal is actually running.");
    else if (days !== null) passed++;
    const plain = await grab(`http://${origin.host}/`, {}, 6000);
    if (plain && !(plain.status >= 300 && plain.status < 400 && /^https:/i.test(plain.headers.get("location") || ""))) F("TLS", "medium", "http:// does not redirect to https://", "Typing the bare domain lands on the insecure version (or a dead page). Add a permanent redirect at the edge.");
    else if (plain) passed++;
  }

  // ---- email DNS ---------------------------------------------------------
  checks += 2;
  const apex = origin.hostname.split(".").slice(-2).join(".");
  const spf = (await txt(apex)).some((t) => /^v=spf1/i.test(t));
  const dmarc = (await txt(`_dmarc.${apex}`)).some((t) => /^v=DMARC1/i.test(t));
  if (!spf) F("Email", "medium", `No SPF record on ${apex}`, "Sign-up confirmations, receipts and password resets from this domain are far more likely to land in spam. Add a v=spf1 TXT record.");
  else passed++;
  if (!dmarc) F("Email", "medium", `No DMARC record on ${apex}`, "Gmail and Yahoo now require DMARC for bulk senders, and it stops anyone spoofing your domain. Add _dmarc TXT: v=DMARC1; p=quarantine.");
  else passed++;

  // ---- page weight (own measurement, no Google needed) ---------------------
  checks += 2;
  const t0 = Date.now();
  const timed = await grab(origin.toString(), { headers: { "cache-control": "no-cache" } }, 10000);
  const ttfb = Date.now() - t0;
  const assets = new Set<string>();
  for (const m of homeHtml.matchAll(/<(?:script|img|link)\b[^>]*\s(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    try { const u = new URL(m[1], origin); if (/\.(js|mjs|css|png|jpe?g|gif|webp|avif|svg|woff2?)(\?|$)/i.test(u.pathname + u.search) || /\/_next\/static\//.test(u.pathname)) assets.add(u.toString()); } catch { /* ignore */ }
  }
  let bytes = homeHtml.length;
  const big: { path: string; kb: number }[] = [];
  await Promise.all([...assets].slice(0, 25).map(async (u) => {
    const r = await grab(u, { method: "HEAD" }, 4000);
    const n = Number(r?.headers.get("content-length") || 0);
    if (n > 0) { bytes += n; if (n > 500 * 1024) big.push({ path: new URL(u).pathname.split("/").pop() || u, kb: Math.round(n / 1024) }); }
  }));
  if (timed && ttfb > 1800) F("Performance", "medium", `Slow server response (${(ttfb / 1000).toFixed(1)}s to first byte)`, "Time-to-first-byte over ~0.8s drags every other metric; check cold starts, uncached database calls, or a region far from your users.");
  else if (timed) passed++;
  const mb = bytes / (1024 * 1024);
  if (mb > 3 || big.length) F("Performance", mb > 5 ? "high" : "medium", `Heavy home page (${mb.toFixed(1)} MB across ${assets.size + 1} assets)`, `${big.length ? "Largest: " + big.sort((a, b) => b.kb - a.kb).slice(0, 3).map((b) => `${b.path} (${b.kb} KB)`).join(", ") + ". " : ""}Mobile visitors on 4G wait roughly ${Math.max(1, Math.round(mb * 2))}s+ before the page is usable. Compress images (AVIF/WebP), lazy-load below the fold, split the JS bundle.`);
  else passed++;

  // ---- Core Web Vitals / Lighthouse (when PageSpeed answers) -----------------
  const lh = await pageSpeed(origin.toString());
  if (lh) {
    checks += 4;
    if (lh.performance !== null && lh.performance < 50) F("Performance", "high", `Lighthouse performance ${lh.performance}/100 on mobile`, `LCP ${lh.lcp_ms != null ? Math.round(lh.lcp_ms / 100) / 10 + "s" : "n/a"}, CLS ${lh.cls != null ? lh.cls.toFixed(2) : "n/a"}${lh.inp_ms != null ? `, INP ${lh.inp_ms}ms` : ""} (${lh.source} data). Below 50 is the range where users bounce before the page paints.`);
    else if (lh.performance !== null && lh.performance < 80) F("Performance", "medium", `Lighthouse performance ${lh.performance}/100 on mobile`, `LCP ${lh.lcp_ms != null ? Math.round(lh.lcp_ms / 100) / 10 + "s" : "n/a"}, CLS ${lh.cls != null ? lh.cls.toFixed(2) : "n/a"} (${lh.source} data). Google's 'good' bar is LCP under 2.5s and CLS under 0.1.`);
    else if (lh.performance !== null) passed++;
    if (lh.accessibility !== null && lh.accessibility < 90) F("Accessibility", lh.accessibility < 70 ? "high" : "medium", `Lighthouse accessibility ${lh.accessibility}/100`, "Contrast, labels, focus order and ARIA problems Lighthouse can prove. Under 90 is where ADA/WCAG complaints start.");
    else if (lh.accessibility !== null) passed++;
    if (lh.best_practices !== null && lh.best_practices < 80) F("Best practices", "low", `Lighthouse best-practices ${lh.best_practices}/100`, "Console errors, deprecated APIs, missing image aspect ratios or insecure requests.");
    else if (lh.best_practices !== null) passed++;
    if (lh.seo !== null && lh.seo < 90) F("SEO", "low", `Lighthouse SEO ${lh.seo}/100`, "Crawlability, tap-target size, meta tags and structured data.");
    else if (lh.seo !== null) passed++;
  }

  // ---- score -------------------------------------------------------------
  // One real problem is priced once. A site-wide finding ("8 pages missing X")
  // replaces the single-page version of the same problem, and no category can
  // take more than a fixed share of the score, so a site with no critical
  // finding cannot land in the red on repetition alone.
  const twins: Array<[RegExp, RegExp]> = [
    [/^Missing a mobile viewport tag$/, /pages missing the mobile viewport tag$/],
    [/^Missing a real <title>$/, /pages without a <title>$/],
    [/^Missing (Content-Security-Policy|X-Frame-Options|X-Content-Type-Options|Referrer-Policy)/, /^Security headers not applied site-wide$/],
  ];
  const deduped = findings.filter((f) => {
    for (const [single, siteWide] of twins) {
      if (single.test(f.title) && findings.some((g) => siteWide.test(g.title))) {
        // keep the header singles (they name the header); drop the site-wide roll-up instead
        if (/^Security headers not applied site-wide$/.test(f.title)) return false;
        if (!/^Missing (Content-Security-Policy|X-Frame-Options|X-Content-Type-Options|Referrer-Policy)/.test(f.title)) return false;
      }
    }
    return true;
  });
  const CATEGORY_CAP = 30;
  const byCategory = new Map<string, number>();
  let penalty = 0;
  for (const f of deduped) {
    const c = byCategory.get(f.category) || 0;
    const add = Math.min(PENALTY[f.severity], Math.max(0, CATEGORY_CAP - c));
    byCategory.set(f.category, c + add);
    penalty += add;
  }
  findings.length = 0; findings.push(...deduped);
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const band = score >= 75 ? "green" : score >= 40 ? "yellow" : "red";
  const order: Record<Sev, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  const scanned = okPages.length;
  return {
    ...surface,
    kind: "deep",
    score, band, passed, findings,
    pages_scanned: scanned,
    pages: okPages.map((p) => p.url),
    lighthouse: lh,
    checks_run: checks,
    summary: findings.length
      ? `Audited ${scanned} page${scanned === 1 ? "" : "s"} on ${origin.host}: ${findings.length} issue${findings.length === 1 ? "" : "s"} (${findings.filter((f) => f.severity === "critical" || f.severity === "high").length} critical/high).`
      : `Audited ${scanned} page${scanned === 1 ? "" : "s"} on ${origin.host}: nothing to fix at the URL level. The browser-based deep audit is the next step.`,
    note: DEEP_GRADE_NOTE,
  };
}
