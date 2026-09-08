/**
 * Instant, URL-only black-box readiness grade — the shared engine behind
 * /api/grade (free) and the paid-audit webhook (first automatic deliverable).
 * No browser, no repo, no code upload — it only touches the public URL, so it
 * is privacy-safe and runs in a serverless function. It is an honest SUBSET of
 * the full local audit; the deep checks (IDOR, admin/RBAC, repo) need Chromium.
 */
import dns from "node:dns/promises";
import net from "node:net";
import { runVibeChecks } from "./vibe-checks.ts";

export type Sev = "critical" | "high" | "medium" | "low";
export type Finding = { title: string; severity: Sev; detail: string; category: string; fix?: string };
export type InstantGrade = {
  ok: true;
  url: string;
  score: number;
  band: "green" | "yellow" | "red";
  passed: number;
  summary: string;
  findings: Finding[];
  note: string;
};
export type GradeFailure = { ok: false; status: number; error: string; blocked?: boolean; http_status?: number };

/** Bot-management challenge pages we refuse to grade as if they were the customer's site. */
const CHALLENGE_SIGNS = [/cf-browser-verification/i, /_cf_chl_opt/i, /cf-chl/i, /Attention Required!\s*\|\s*Cloudflare/i, /Just a moment\.\.\./i, /Access Denied/i, /Request unsuccessful\. Incapsula/i, /_Incapsula_Resource/i, /Reference #\d+\.[0-9a-f]+\.[0-9a-f]+\.[0-9a-f]+/i, /akamai/i, /Pardon Our Interruption/i, /PerimeterX/i, /px-captcha/i, /distil_r_captcha/i, /DataDome/i, /Please verify you are a human/i, /enable JavaScript and cookies to continue/i];

/**
 * A response we cannot honestly grade: an error status, a body too short to
 * be a page, or a bot-management challenge. Returning a distinct failure
 * instead of a score is the difference between a report and a fabrication.
 */
export function blockedReason(status: number, html: string): string | null {
  if (status >= 400) return `The site answered our scanner with HTTP ${status}, so what we saw was an error page, not your site.`;
  if (status >= 300) return `The site kept redirecting (HTTP ${status}) and never served a page to our scanner.`;
  const body = html.trim();
  if (body.length < 500) return `The site returned only ${body.length} bytes to our scanner, which is not a real page. It may be blocking automated traffic.`;
  for (const re of CHALLENGE_SIGNS) if (re.test(body.slice(0, 20000))) return "The site put a bot-protection challenge (Cloudflare, Akamai or similar) in front of our scanner instead of the page.";
  return null;
}

const PENALTY: Record<Sev, number> = { critical: 22, high: 13, medium: 7, low: 3 };

export const INSTANT_GRADE_NOTE =
  "This is the free 10-second surface scan (no code, no install). The deep audit — broken access control (IDOR), admin/RBAC, write-authz, and your actual code — runs free inside your own agent; your code never leaves your machine.";

export function privateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const x = ip.toLowerCase();
  return x === "::1" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80") || x.startsWith("::ffff:127.") || x.startsWith("::ffff:10.") || x.startsWith("::ffff:192.168.");
}

/** Static (no-DNS) part of the SSRF guard. Returns an error string or null. */
export function hostLooksPrivate(host: string): string | null {
  const h = host.toLowerCase();
  const bad = ["localhost", "metadata.google.internal", "instance-data"];
  if (bad.includes(h) || h.endsWith(".internal") || h.endsWith(".local") || h.endsWith(".localhost")) return "private host";
  if (net.isIP(host) && privateIp(host)) return "private ip";
  return null;
}

/** Full SSRF guard: static check + DNS resolution must not land on a private address. */
export async function assertPublic(host: string): Promise<void> {
  const staticProblem = hostLooksPrivate(host);
  if (staticProblem) throw new Error(staticProblem);
  if (net.isIP(host)) return;
  const addrs = await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some((a: { address: string }) => privateIp(a.address))) throw new Error("resolves to private ip");
}

/**
 * Normalize + syntactically validate a user-supplied target URL (no network).
 * Adds https:// when the scheme is missing, rejects non-http(s) and private hosts.
 */
export function parseTargetUrl(input: unknown): { ok: true; url: URL } | { ok: false; error: string } {
  let raw = typeof input === "string" ? input.trim() : "";
  if (!raw) return { ok: false, error: "Provide a url." };
  if (raw.length > 2048) return { ok: false, error: "That URL is too long." };
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
  let u: URL;
  try { u = new URL(raw); } catch { return { ok: false, error: `Not a valid URL: ${raw}` }; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, error: "Only http/https URLs." };
  if (u.username || u.password) return { ok: false, error: "Credentials in the URL aren't allowed." };
  if (!u.hostname || !u.hostname.includes(".") && !net.isIP(u.hostname)) return { ok: false, error: "That doesn't look like a public hostname." };
  if (hostLooksPrivate(u.hostname)) return { ok: false, error: "That host isn't a public address we can scan." };
  return { ok: true, url: u };
}

async function grab(url: string, opts: RequestInit = {}, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal, redirect: "manual", headers: { "user-agent": "8020LaunchAudit-Grader/1.0", ...(opts.headers || {}) } }); }
  finally { clearTimeout(t); }
}

/** A grab that never throws (returns null) — for the vibe probes that fan out. */
async function safeGrab(url: string, opts: RequestInit = {}, ms = 6000): Promise<Response | null> {
  try { return await grab(url, opts, ms); } catch { return null; }
}

/** Fetch same-origin JS bundles the page ships, capped, so the vibe checks can
 *  read the client for leaked keys / dev artifacts. Best-effort, time-boxed. */
async function fetchJsBundles(html: string, origin: URL, max = 6, capBytes = 600_000): Promise<string[]> {
  const srcs = new Set<string>();
  for (const m of html.matchAll(/<script\b[^>]*\ssrc\s*=\s*["']([^"']+)["']/gi)) {
    try { const u = new URL(m[1], origin); if (u.origin === origin.origin && /\.(js|mjs)(\?|$)/i.test(u.pathname + u.search)) srcs.add(u.toString()); } catch { /* ignore */ }
  }
  const list = [...srcs].slice(0, max);
  const texts = await Promise.all(list.map(async (u) => {
    const r = await safeGrab(u, {}, 6000);
    if (!r || r.status !== 200) return "";
    try { return (await r.text()).slice(0, capBytes); } catch { return ""; }
  }));
  return texts.filter(Boolean);
}

/** Fallback fix prompt by category, so every surface finding is agent-ready. */
const SURFACE_FIX: Record<string, string> = {
  TLS: "Serve the whole site over HTTPS, 301-redirect http->https at the edge, and send Strict-Transport-Security (max-age=63072000; includeSubDomains; preload). Standard: OWASP Secure Headers / Mozilla TLS.",
  "Security headers": "Set the missing response headers at the platform level so every route gets them: Content-Security-Policy, X-Frame-Options: DENY (or CSP frame-ancestors), X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin. In Next.js use the headers() config or middleware; on Vercel use vercel.json headers. Remove X-Powered-By. Standard: OWASP Secure Headers.",
  Cookies: "Set session cookies with HttpOnly, Secure, and SameSite=Lax (or Strict). Standard: CWE-1004 / CWE-614.",
  CORS: "Never reflect an arbitrary Origin in Access-Control-Allow-Origin together with Access-Control-Allow-Credentials: true. Allowlist your exact known origins in the server CORS config. Standard: CWE-942.",
  Secrets: "Remove the exposed file/secret from what the server serves publicly, block it at the edge (deny /.env, /.git/*), and rotate anything leaked. Standard: OWASP WSTG configuration / CWE-798.",
  SEO: "Add a unique <title> (50-60 chars), a meta description, a canonical link, Open Graph tags, and a viewport meta; make sure the page is not accidentally noindex. Standard: Google Search Central.",
};

export function ensureFix(f: Finding): Finding {
  if (f.fix) return f;
  return { ...f, fix: SURFACE_FIX[f.category] ?? `Address "${f.title}": ${f.detail}` };
}

/** Run the surface scan against an already-validated URL. Performs DNS + HTTP. */
export async function runInstantGrade(target: URL): Promise<InstantGrade | GradeFailure> {
  let u = target;
  try { await assertPublic(u.hostname); } catch { return { ok: false, status: 400, error: "That host isn't a public address we can scan." }; }

  const findings: Finding[] = [];
  const passed: string[] = [];
  let html = "", main: Response | null = null;
  try {
    main = await grab(u.toString());
    if (main.status >= 300 && main.status < 400 && main.headers.get("location")) {
      const loc = new URL(main.headers.get("location")!, u);
      try { await assertPublic(loc.hostname); main = await grab(loc.toString()); u = loc; } catch { /* keep original */ }
    }
    html = (await main.text()).slice(0, 200000);
  } catch {
    return { ok: false, status: 502, error: `Couldn't reach ${u.origin}. Make sure it's live and public.` };
  }
  const blocked = blockedReason(main.status, html);
  if (blocked) {
    return { ok: false, status: 409, blocked: true, http_status: main.status, error: `${blocked} We do not score what we cannot see: allow the user agent 8020LaunchAudit-Grader/1.0 (or your CDN's verified-bot list) and run it again, or ask for a refund.` };
  }
  const H = (n: string) => main!.headers.get(n);

  // --- HTTPS / HSTS ---
  if (u.protocol !== "https:") findings.push({ category: "TLS", severity: "high", title: "No HTTPS", detail: "The site is served over plain http — credentials and cookies travel in cleartext." });
  else if (!H("strict-transport-security")) findings.push({ category: "TLS", severity: "medium", title: "Missing HSTS", detail: "No Strict-Transport-Security header — browsers can be downgraded to http before the redirect." });
  else passed.push("HSTS present");

  // --- Security headers ---
  const hdr: [string, string, Sev][] = [
    ["content-security-policy", "Content-Security-Policy", "high"],
    ["x-frame-options", "X-Frame-Options (clickjacking)", "medium"],
    ["x-content-type-options", "X-Content-Type-Options (MIME sniffing)", "low"],
    ["referrer-policy", "Referrer-Policy", "low"],
  ];
  for (const [k, label, sev] of hdr) {
    if (!H(k)) findings.push({ category: "Security headers", severity: sev, title: `Missing ${label}`, detail: `The ${label} response header is not set.` });
    else passed.push(`${label} set`);
  }
  if (H("x-powered-by") || /express|php|next\.js/i.test(H("server") || "")) findings.push({ category: "Security headers", severity: "low", title: "Stack banner leaked", detail: `Server reveals its stack (${H("x-powered-by") || H("server")}) — free recon for attackers.` });

  // --- Cookies ---
  const sc = H("set-cookie") || "";
  if (sc) {
    const miss = ["HttpOnly", "Secure", "SameSite"].filter((f) => !new RegExp(f, "i").test(sc));
    if (miss.length) findings.push({ category: "Cookies", severity: "high", title: `Session cookie missing ${miss.join(", ")}`, detail: "A login cookie without these flags can be stolen via XSS, leaked over http, or used in CSRF." });
    else passed.push("Cookie flags hardened");
  }

  // --- CORS reflection ---
  try {
    const c = await grab(u.toString(), { headers: { origin: "https://evil.example" } }, 6000);
    const acao = c.headers.get("access-control-allow-origin");
    if (acao === "https://evil.example" || (acao === "*" && (c.headers.get("access-control-allow-credentials") || "").toLowerCase() === "true"))
      findings.push({ category: "CORS", severity: "high", title: "CORS reflects any origin", detail: "The server echoes an arbitrary Origin (a hostile site could read your logged-in users' data)." });
    else passed.push("CORS does not reflect hostile origin");
  } catch { /* ignore */ }

  // --- Exposed secret / VCS files ---
  for (const path of ["/.env", "/.git/config", "/.git/HEAD", "/.env.local"]) {
    try {
      const r = await grab(new URL(path, u.origin).toString(), {}, 5000);
      if (r.status === 200) {
        const ct = (r.headers.get("content-type") || "").toLowerCase();
        const body = (await r.text()).slice(0, 4000);
        const looksReal = !ct.includes("text/html") && !body.trimStart().startsWith("<") &&
          (/^\s*[A-Z0-9_]+\s*=/m.test(body) || /\[core\]/.test(body) || /^ref:\s/m.test(body) || /-----BEGIN/.test(body));
        if (looksReal) { findings.push({ category: "Secrets", severity: "critical", title: `Exposed ${path}`, detail: `${path} is publicly downloadable — it can leak credentials, keys, or your full git history.` }); break; }
      }
    } catch { /* ignore */ }
  }

  // --- SEO basics (lightweight) ---
  const seo: [RegExp, string, Sev][] = [
    [/<title[^>]*>\s*\S/i, "a real <title>", "medium"],
    [/<meta[^>]+name=["']description["'][^>]+content=["']\s*\S/i, "a meta description", "low"],
    [/<meta[^>]+name=["']viewport["']/i, "a mobile viewport tag", "medium"],
    [/<meta[^>]+property=["']og:title["']/i, "an Open Graph title (link previews)", "low"],
  ];
  for (const [re, label, sev] of seo) {
    if (re.test(html)) passed.push(label + " present");
    else findings.push({ category: "SEO", severity: sev, title: `Missing ${label}`, detail: `The page is missing ${label}.` });
  }

  // --- Vibe-coder checks: Supabase/Firebase rules, leaked keys, open admin,
  //     dev-build leaks, placeholder copy — the class the free tools ignore. ---
  let passedCount = passed.length;
  try {
    const jsTexts = await fetchJsBundles(html, u, 6);
    const vibe = await runVibeChecks({ origin: u, html, jsTexts, grab: safeGrab });
    findings.push(...vibe.findings);
    passedCount += vibe.passed;
  } catch { /* vibe checks are best-effort; never fail the whole grade */ }

  const withFixes = findings.map(ensureFix);
  const penalty = withFixes.reduce((s, f) => s + PENALTY[f.severity], 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const band = score >= 75 ? "green" : score >= 40 ? "yellow" : "red";
  const order: Record<Sev, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  withFixes.sort((a, b) => order[a.severity] - order[b.severity]);
  findings.length = 0; findings.push(...withFixes);

  return {
    ok: true,
    url: u.origin,
    score, band,
    passed: passedCount,
    summary: findings.length
      ? `Surface scan found ${findings.length} issue${findings.length === 1 ? "" : "s"} on ${u.host}.`
      : `No surface-level issues found on ${u.host} — nice. The deep checks still need your repo.`,
    findings,
    note: INSTANT_GRADE_NOTE,
  };
}
