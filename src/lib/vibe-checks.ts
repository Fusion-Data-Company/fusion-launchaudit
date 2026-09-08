/**
 * Vibe-coder checks — the class of mistake AI app builders (Lovable, Bolt, v0,
 * Cursor) ship that the free header/Lighthouse tools never look for, and that
 * this buyer is actually scared of after CVE-2025-48757 (170 Lovable apps
 * leaking user data through open Supabase RLS).
 *
 * Everything here is URL-only and black-box: we read the public HTML + the
 * JS bundles the page already ships, and make a small number of *unauthenticated*
 * requests a normal browser could make. We NEVER brute-force, never send more
 * than one request to an auth endpoint, and never write. Each finding carries a
 * paste-ready fix prompt for Claude Code / Cursor in `fix`.
 */
import type { Finding, Sev } from "./instant-grade.ts";

export type Grab = (url: string, opts?: RequestInit, ms?: number) => Promise<Response | null>;

export type VibeContext = {
  origin: URL;
  /** Home-page HTML (already fetched). */
  html: string;
  /** Text of same-origin JS bundles the page loads (already fetched, capped). */
  jsTexts: string[];
  grab: Grab;
};

export type VibeResult = { findings: Finding[]; passed: number; checks: number };

const F = (
  category: string,
  severity: Sev,
  title: string,
  detail: string,
  fix: string,
): Finding => ({ category, severity, title, detail, fix });

/** Common table names an AI builder scaffolds. Used for the RLS read probe. */
export const COMMON_TABLES = [
  "users", "profiles", "customers", "orders", "messages", "posts",
  "todos", "payments", "subscriptions", "accounts", "leads", "contacts",
];

/** Admin surfaces AI builders leave server-unguarded ("hidden, not locked"). */
export const ADMIN_PATHS = ["/admin", "/dashboard", "/administrator", "/api/admin", "/api/admin/users"];

const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/;

/** Find a Supabase project URL + a JWT (anon key) shipped in the client. Pure. */
export function extractSupabase(text: string): { url: string; anonKey: string } | null {
  const urlM = text.match(/https:\/\/[a-z0-9-]+\.supabase\.co/i);
  if (!urlM) return null;
  const keyM = text.match(JWT_RE);
  if (!keyM) return null;
  // Confirm it decodes to a Supabase anon/service token (role claim), not any JWT.
  try {
    const payload = JSON.parse(Buffer.from(keyM[0].split(".")[1], "base64").toString("utf8")) as { role?: string; iss?: string };
    if (payload.role !== "anon" && payload.role !== "service_role" && !/supabase/i.test(payload.iss ?? "")) return null;
  } catch { /* still likely a supabase key if the URL is present */ }
  return { url: urlM[0].replace(/\/+$/, ""), anonKey: keyM[0] };
}

/** Find a Firebase config (databaseURL / projectId) shipped in the client. Pure. */
export function extractFirebase(text: string): { databaseURL: string | null; projectId: string | null } | null {
  const db = text.match(/https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)?\.(?:firebaseio\.com|firebasedatabase\.app)/i);
  const proj = text.match(/["']?projectId["']?\s*[:=]\s*["']([a-z0-9-]+)["']/i);
  if (!db && !proj) return null;
  return { databaseURL: db ? db[0].replace(/\/+$/, "") : null, projectId: proj ? proj[1] : null };
}

/** Secret-shaped strings that must never reach the client. Pure. Skips values that
 *  are public by design (Stripe pk_live_, Firebase AIza… browser keys). */
export function findClientSecrets(text: string): Array<{ kind: string; sev: Sev; sample: string }> {
  const out: Array<{ kind: string; sev: Sev; sample: string }> = [];
  const seen = new Set<string>();
  const push = (kind: string, sev: Sev, m: string) => {
    const s = m.slice(0, 10) + "…";
    const id = kind + s;
    if (!seen.has(id)) { seen.add(id); out.push({ kind, sev, sample: s }); }
  };
  const rules: Array<[RegExp, string, Sev]> = [
    [/\bsk_live_[A-Za-z0-9]{16,}/g, "Stripe secret key (sk_live)", "critical"],
    [/\bsk_test_[A-Za-z0-9]{16,}/g, "Stripe secret key (sk_test)", "critical"],
    [/\brk_live_[A-Za-z0-9]{16,}/g, "Stripe restricted key (rk_live)", "critical"],
    [/\bpk_test_[A-Za-z0-9]{16,}/g, "Stripe TEST publishable key in production", "medium"],
    [/\bAKIA[0-9A-Z]{16}\b/g, "AWS access key id", "critical"],
    [/\bsk-ant-[A-Za-z0-9_-]{20,}/g, "Anthropic API key", "critical"],
    [/\bsk-proj-[A-Za-z0-9_-]{20,}/g, "OpenAI project key", "critical"],
    [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, "Private key (PEM)", "critical"],
    [/\bghp_[A-Za-z0-9]{36}\b/g, "GitHub personal access token", "critical"],
    [/\bxox[baprs]-[A-Za-z0-9-]{10,}/g, "Slack token", "critical"],
  ];
  for (const [re, kind, sev] of rules) { const m = text.match(re); if (m) for (const hit of m.slice(0, 2)) push(kind, sev, hit); }
  return out;
}

const PLACEHOLDER_RES: Array<[RegExp, string]> = [
  [/lorem ipsum/i, "lorem ipsum"],
  [/\byour company\b/i, "your company"],
  [/\byour business name\b/i, "your business name"],
  [/\[insert[^\]]{0,40}\]/i, "[insert …]"],
  [/\breplace this\b/i, "replace this"],
  [/company name here/i, "company name here"],
  [/example@example\.com/i, "example@example.com"],
  [/\b555-555-5555\b/, "555-555-5555"],
  [/\bTODO:/,"TODO:"],
  [/\byour headline here\b/i, "your headline here"],
  [/\blorem\b/i, "lorem"],
];

/** Placeholder / AI-scaffold copy visible on the page. Pure (operates on visible text). */
export function findPlaceholders(html: string): string[] {
  const visible = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const hits = new Set<string>();
  for (const [re, label] of PLACEHOLDER_RES) if (re.test(visible)) hits.add(label);
  return [...hits];
}

/** A 200 that is really an empty SPA shell (same as home), not real page content. */
function looksLikeShell(body: string, homeHtml: string): boolean {
  const b = body.trim();
  if (b.length < 1200) {
    const mount = /<div[^>]+id=["'](root|app|__next|__nuxt)["'][^>]*>\s*<\/div>/i.test(b);
    if (mount) return true;
  }
  // Near-identical to the home page => generic shell, not a distinct admin page.
  if (homeHtml && Math.abs(b.length - homeHtml.trim().length) < 40 && b.slice(0, 400) === homeHtml.trim().slice(0, 400)) return true;
  return false;
}

const AUTH_HINTS = [/\/login\b/i, /\/sign-?in\b/i, /\/api\/auth\b/i, /\/api\/login\b/i, /type=["']password["']/i];

export async function runVibeChecks(ctx: VibeContext): Promise<VibeResult> {
  const { origin, html, jsTexts, grab } = ctx;
  const findings: Finding[] = [];
  let passed = 0;
  let checks = 0;
  const corpus = [html, ...jsTexts].join("\n");

  // ---- Supabase anon key + RLS read probe (the CVE-2025-48757 class) --------
  checks++;
  const sb = extractSupabase(corpus);
  if (sb) {
    const readable: string[] = [];
    await Promise.all(COMMON_TABLES.map(async (t) => {
      const r = await grab(`${sb.url}/rest/v1/${t}?select=*&limit=1`, { headers: { apikey: sb.anonKey, authorization: `Bearer ${sb.anonKey}` } }, 6000);
      if (!r || r.status !== 200) return;
      try { const rows = await r.json(); if (Array.isArray(rows) && rows.length > 0) readable.push(t); } catch { /* not json */ }
    }));
    if (readable.length) {
      findings.push(F("Supabase / RLS", "critical",
        `Supabase tables readable with the public anon key: ${readable.join(", ")}`,
        `Your Supabase URL and anon key ship in the client (that part is normal), but an unauthenticated request using that key returned rows from ${readable.length} table${readable.length === 1 ? "" : "s"} (${readable.join(", ")}). Row Level Security is off or too permissive — this is exactly the flaw that leaked 170 Lovable apps' user data.`,
        `Enable Row Level Security on every public table in Supabase and add owner-scoped policies. For each of these tables (${readable.join(", ")}): run "alter table <t> enable row level security;" then add a policy like "create policy \\"own rows\\" on <t> for select using (auth.uid() = user_id);". Verify with an anon-key SELECT that it now returns zero rows. Do NOT rely on hiding the key in the client. Standard: Supabase RLS / CWE-284.`));
    } else {
      passed++;
    }
  } else {
    passed++;
  }

  // ---- Firebase open rules probe (RTDB + Firestore) -------------------------
  checks++;
  const fb = extractFirebase(corpus);
  let fbOpen = false;
  if (fb?.databaseURL) {
    const r = await grab(`${fb.databaseURL}/.json?shallow=true`, {}, 6000);
    if (r && r.status === 200) {
      const body = (await r.text()).slice(0, 2000).trim();
      if (body && body !== "null" && !/permission denied|"error"/i.test(body)) {
        fbOpen = true;
        findings.push(F("Firebase", "critical",
          "Firebase Realtime Database is world-readable",
          `An unauthenticated request to ${fb.databaseURL}/.json returned data. Your database rules allow public reads — anyone can pull the whole tree.`,
          `Lock down your Firebase Realtime Database rules. Replace any {".read": true} with auth-scoped rules, e.g. {"rules": {"$uid": {".read": "auth != null && auth.uid === $uid", ".write": "auth != null && auth.uid === $uid"}}}. Deploy with "firebase deploy --only database" and re-check that ${fb.databaseURL}/.json returns "Permission denied". Standard: Firebase Security Rules / CWE-284.`));
      }
    }
  }
  if (fb?.projectId && !fbOpen) {
    const r = await grab(`https://firestore.googleapis.com/v1/projects/${fb.projectId}/databases/(default)/documents/users?pageSize=1`, {}, 6000);
    if (r && r.status === 200) {
      try {
        const j = await r.json() as { documents?: unknown[] };
        if (Array.isArray(j.documents) && j.documents.length > 0) {
          fbOpen = true;
          findings.push(F("Firebase", "critical",
            "Firestore collection is world-readable",
            `An unauthenticated Firestore read of the "users" collection in project ${fb.projectId} returned documents. Your Firestore rules allow public reads.`,
            `Fix your Firestore security rules. Replace "allow read, write: if true;" with auth-scoped rules, e.g. "match /users/{uid} { allow read, write: if request.auth != null && request.auth.uid == uid; }". Deploy with "firebase deploy --only firestore:rules" and re-test an unauthenticated read returns PERMISSION_DENIED. Standard: Firebase Security Rules / CWE-284.`));
        }
      } catch { /* not json */ }
    }
  }
  if (!fbOpen) passed++;

  // ---- Secret keys shipped to the client -----------------------------------
  checks++;
  const secrets = findClientSecrets(corpus);
  if (secrets.length) {
    const crit = secrets.filter((s) => s.sev === "critical");
    for (const s of crit.slice(0, 3)) {
      findings.push(F("Secrets", "critical",
        `${s.kind} exposed in the client bundle`,
        `A ${s.kind} (${s.sample}) is readable in your page or JS bundle. Anyone who opens dev tools has it. Assume it is already compromised.`,
        `Remove the ${s.kind} from all client-side code immediately and ROTATE it (assume it is leaked). Server-only secrets must live in a server env var (never NEXT_PUBLIC_/VITE_/PUBLIC_ prefixed) and be used only in server routes or edge functions. Rotate the key in the provider dashboard, redeploy, and re-scan. Standard: OWASP WSTG configuration / CWE-798.`));
    }
    const testKey = secrets.find((s) => s.sev === "medium");
    if (testKey) {
      findings.push(F("Secrets", "medium",
        "Stripe is running in TEST mode in production",
        "A pk_test_ publishable key is live on the production site — real customers cannot actually pay, and it signals the checkout was never switched to live.",
        `Swap the Stripe TEST publishable key (pk_test_…) for your LIVE key (pk_live_…) in the production environment, and make sure the matching secret key is sk_live_ on the server. Keep test keys in your local/preview env only. Standard: Stripe go-live checklist.`));
    }
    if (!crit.length && !testKey) passed++;
  } else {
    passed++;
  }

  // ---- Admin routes reachable without auth ---------------------------------
  checks++;
  const adminHits: Array<{ path: string; sev: Sev; why: string }> = [];
  await Promise.all(ADMIN_PATHS.map(async (p) => {
    const r = await grab(new URL(p, origin).toString(), {}, 5000);
    if (!r) return;
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (p.startsWith("/api/")) {
      if (r.status === 200 && /json/.test(ct)) {
        try {
          const j = await r.json();
          const hasData = Array.isArray(j) ? j.length > 0 : j && typeof j === "object" && Object.keys(j as object).length > 0;
          if (hasData) adminHits.push({ path: p, sev: "critical", why: "returned JSON data to an unauthenticated caller" });
        } catch { /* ignore */ }
      }
      return;
    }
    if (r.status === 200) {
      const body = (await r.text()).slice(0, 40000);
      if (/type=["']password["']|sign in|log ?in|unauthor|forbidden/i.test(body)) return; // it IS gated (login page)
      if (looksLikeShell(body, html)) { adminHits.push({ path: p, sev: "medium", why: "served a 200 client shell (HTTP can't prove the client gate; verify the API)" }); return; }
      if (/admin|dashboard|users|settings|manage/i.test(body)) adminHits.push({ path: p, sev: "high", why: "served real admin-looking content to an unauthenticated visitor" });
    }
  }));
  if (adminHits.length) {
    const worst = adminHits.some((h) => h.sev === "critical") ? "critical" : adminHits.some((h) => h.sev === "high") ? "high" : "medium";
    findings.push(F("Access control", worst as Sev,
      `Admin surface reachable without auth: ${adminHits.map((h) => h.path).join(", ")}`,
      adminHits.map((h) => `${h.path} ${h.why}`).join("; ") + ".",
      `Add a SERVER-SIDE authorization check to these routes/APIs (${adminHits.map((h) => h.path).join(", ")}). In the route handler or shared middleware, reject anonymous or non-admin requests with 401/403 BEFORE returning anything — hiding the link in the UI is not a control. For Next.js, guard in middleware.ts and re-check the role inside each /api/admin handler. Verify an unauthenticated curl to each path returns 401/403. Standard: OWASP WSTG-ATHZ / CWE-306.`));
  } else {
    passed++;
  }

  // ---- Vite / Next dev artifacts shipped to production ----------------------
  checks++;
  if (/\/@vite\/client|__vite__mapDeps|import\.meta\.env\.DEV/i.test(corpus) && /\/@vite\/client/i.test(html)) {
    findings.push(F("Debug leak", "high",
      "Vite dev server client is shipped in production",
      "The page loads /@vite/client — you deployed the dev build, not a production build. It hot-reloads, exposes source, and is far slower.",
      `Deploy the production build, not the dev server. Run "npm run build" and serve the dist/ output (e.g. "vite preview" or your host's static output), and make sure your deploy command is the build, not "vite"/"npm run dev". Standard: Vite production build.`));
  } else if (/nextjs-portal|__nextjs_original-stack-frame|__next_dev/i.test(corpus)) {
    findings.push(F("Debug leak", "medium",
      "Next.js is running in development mode",
      "Dev-only markers (the error overlay / stack-frame endpoint) are present — the site is served with `next dev`, which is slow and leaks source and stack traces.",
      `Run Next.js in production: build with "next build" and start with "next start" (or deploy to a host that does this automatically). Never run "next dev" as your production server. Standard: Next.js deployment.`));
  } else {
    passed++;
  }

  // ---- Source maps published in production ----------------------------------
  checks++;
  if (jsTexts.some((t) => /\/\/[#@]\s*sourceMappingURL=/.test(t))) {
    findings.push(F("Debug leak", "low",
      "Source maps are published in production",
      "Your minified JS references a .map file, which ships your original, unminified source (and often comments and structure) to anyone.",
      `Turn off source maps in production builds. Next.js: set "productionBrowserSourceMaps: false" in next.config.js (the default). Vite: set "build.sourcemap: false". Rebuild and confirm no //# sourceMappingURL= line remains in the shipped JS. Standard: production build hygiene.`));
  } else {
    passed++;
  }

  // ---- Auth endpoint present -> advise rate-limit verification (no probing) --
  checks++;
  if (AUTH_HINTS.some((re) => re.test(corpus))) {
    findings.push(F("Auth hardening", "low",
      "Verify rate limiting on the login endpoint",
      "This app exposes a login / auth endpoint. We do not brute-force it, so we cannot confirm a limit exists — but AI builders almost never add one, and an unthrottled login invites credential-stuffing.",
      `Add rate limiting to your login and password-reset endpoints (report-only finding — verify this yourself). Limit attempts per IP and per account (e.g. 5 per 15 minutes) and add exponential backoff or a captcha after repeated failures. On Vercel use @upstash/ratelimit; on Supabase Auth enable the built-in rate limits. Standard: OWASP WSTG-ATHN / API4:2023.`));
  } else {
    passed++;
  }

  // ---- Placeholder / AI-scaffold copy still on the page --------------------
  checks++;
  const placeholders = findPlaceholders(html);
  if (placeholders.length) {
    findings.push(F("Content", placeholders.length > 2 ? "medium" : "low",
      `Placeholder copy still on the page: ${placeholders.slice(0, 4).join(", ")}`,
      `The live page still shows scaffold text (${placeholders.join(", ")}). It reads as unfinished and can leak straight into search results and link previews.`,
      `Replace the placeholder copy (${placeholders.join(", ")}) with real content. Search the codebase for each phrase and write the actual headline/body/contact details. Standard: launch content hygiene.`));
  } else {
    passed++;
  }

  return { findings, passed, checks };
}
