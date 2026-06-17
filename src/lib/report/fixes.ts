/**
 * Findings intelligence: (1) a ready-to-paste fix prompt for the user's AI builder
 * per finding — specific to the category + standard, so they can paste it straight
 * into Claude Code / Cursor and get the right fix; and (2) "Fix these 3 first" —
 * the launch-blockers that lead every report. Plain language; each fix names the
 * concrete action and the standard, never a vague "improve security".
 */
export type Finding = { id?: string; title: string; category: string; severity: string; summary: string };

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, "needs verification": 4 };

const FIX_TEMPLATES: Record<string, (f: Finding) => string> = {
  object_authz: (f) => `Fix IDOR / object-level authorization for "${f.title}". In the handler, before returning or mutating the record, verify the authenticated user actually owns it (compare the session user id to the record's owner id). If not, return 403 (or 404 to hide existence) — never the other owner's data. Standard: WSTG-ATHZ-04 / CWE-639.`,
  mutation_authz: (f) => `Add server-side function-level authorization to the privileged mutation in "${f.title}". A normal (non-admin) authenticated user must get 401/403 before any write happens — do not rely on hiding the button in the UI. Standard: OWASP API5 (BFLA) / CWE-285.`,
  mass_assignment: (f) => `Stop mass-assignment on the update endpoint in "${f.title}". Allowlist exactly which fields a client may set; ignore privileged fields like role/isAdmin coming from the request body. Standard: OWASP API3 / CWE-915.`,
  cors: (f) => `Fix the CORS policy for "${f.title}". Never reflect an arbitrary Origin in Access-Control-Allow-Origin together with Access-Control-Allow-Credentials: true. Allowlist your exact known origins instead. Standard: CWE-942.`,
  cookie_security: (f) => `Harden the session cookie ("${f.title}"). Set it with HttpOnly, Secure, and SameSite=Lax (or Strict). Standard: CWE-1004 (HttpOnly) / CWE-614 (Secure).`,
  injection: (f) => `Fix input handling for "${f.title}". Use parameterized queries (never string-concatenate user input into SQL), escape output so payloads can't reflect, and return a clean 400 on bad input instead of a 500/stack trace. Standard: WSTG-INPV / CWE-89 (SQLi) / CWE-79 (XSS).`,
  security_headers: (f) => `Add the missing security headers for "${f.title}": Content-Security-Policy, X-Frame-Options (or frame-ancestors), X-Content-Type-Options: nosniff, Referrer-Policy, and Strict-Transport-Security on HTTPS. Standard: OWASP Secure Headers.`,
  middleware: (f) => `Add the missing security headers / middleware guard for "${f.title}" (CSP, X-Frame-Options, X-Content-Type-Options, HSTS). Standard: OWASP Secure Headers.`,
  secrets_exposure: (f) => `Stop serving secret/VCS files ("${f.title}"). Block public access to /.env, /.env.*, /.git/* at the server or CDN, and rotate anything that was exposed. Standard: OWASP WSTG configuration testing.`,
  tls_hsts: (f) => `Fix transport security for "${f.title}". Serve the whole site over HTTPS, 301-redirect http->https, and send Strict-Transport-Security. Standard: OWASP Secure Headers / Mozilla TLS.`,
  seo: (f) => `Fix the SEO/structured-data gap in "${f.title}". Add a real <title> (50-60 chars), a meta description, a canonical link, Open Graph tags, and valid Schema.org JSON-LD; make sure the page is not accidentally noindex. Standard: Google Search Central.`,
  accessibility: (f) => `Fix the accessibility violations in "${f.title}". Address the axe-core findings (color contrast >= 4.5:1, form labels, ARIA roles/names, keyboard focus). Standard: WCAG 2.2 AA.`,
  performance: (f) => `Improve the failing Core Web Vital in "${f.title}". Optimize LCP (largest image/server response), CLS (set explicit media dimensions), and INP (reduce main-thread work). Standard: web.dev Core Web Vitals.`,
  content_integrity: (f) => `Fix placeholder / unbound content in "${f.title}". Replace lorem/placeholder copy and fix any undefined/NaN values leaking to the page; remove hardcoded localhost URLs. Standard: real-content / data-binding hygiene.`,
  funnel: (f) => `Fix the broken funnel step "${f.title}". Make sure every CTA link resolves (no 404), the thank-you/confirmation step loads, the conversion pixel fires, the payment/upsell step works, and the landing page fits and is fast on a 390px phone.`,
  roles_permissions: (f) => `Lock down the admin/RBAC surface in "${f.title}". Enforce the role check server-side so anonymous users and normal users cannot reach admin routes or admin APIs (not just hide the link). Standard: OWASP WSTG authorization.`,
};

export function buildFixPrompt(f: Finding): string {
  const body = FIX_TEMPLATES[f.category]?.(f) ?? `Fix: ${f.summary}`;
  return `${body}\n\nThen re-run: npx launchaudit --reverify to confirm this specific check now passes.`;
}

/** The launch-blockers that lead the report: highest-severity findings first, max 3. */
export function fixTheseThree(findings: Finding[]): Finding[] {
  return [...findings]
    .sort((a, b) => (SEVERITY_RANK[a.severity.toLowerCase()] ?? 9) - (SEVERITY_RANK[b.severity.toLowerCase()] ?? 9))
    .slice(0, 3);
}
