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
  auth: (f) => `Enforce authentication server-side for "${f.title}". Every protected route/API must reject anonymous requests with 401/403 in the handler (or shared middleware) — never rely on the UI hiding a link. To fully verify role-based access, provide two test logins (admin + user) so the wedge can run. Standard: OWASP WSTG authentication/authorization / CWE-306.`,
  privilege_gradient: (f) => `Fix the broken authorization gradient in "${f.title}". A lower-privilege identity (anonymous or a normal user) received nearly as much as an admin on a protected resource. Enforce the role/ownership check server-side so each identity sees strictly less than the tier above it — never the same content. Standard: WSTG-ATHZ / CWE-285.`,
  write_authz: (f) => `Add server-side write authorization to "${f.title}". An unauthenticated, well-formed write was accepted on a privileged endpoint. Require an authenticated, authorized caller and reject with 401/403 BEFORE any state change. Standard: OWASP API5 / CWE-306 (missing authentication for a critical function).`,
  data_exposure: (f) => `Stop leaking sensitive properties in "${f.title}". A JSON response served to a low-privilege user carried a credential/secret/PII field (password/passwordHash/ssn/apiKey/card_number/…). Strip these server-side: return an explicit allowlist of safe fields (a DTO/serializer), never the raw record. Standard: OWASP API3:2023 (BOPLA) / API6 / CWE-213.`,
  supply_chain: (f) => `Handle the supply-chain signal in "${f.title}". If it's a malicious install-script (pre/postinstall piping to a shell, reading NPM/AWS/CI tokens, or fetching a bundle.js loader), remove/replace the package immediately and rotate any exposed tokens — this is the Shai-Hulud attack pattern. If it's a typosquat, confirm the package name is the one you intended. If it resolved off the official registry, pin it to registry.npmjs.org. Standard: OWASP, CISA (Shai-Hulud).`,
  race_condition: (f) => `Serialize the state-changing action in "${f.title}". Concurrent identical requests all succeeded, so a single-use/quota-limited action (coupon, redeem, transfer, vote) can be double-spent via a race (TOCTOU). Protect it with a database unique constraint, a row lock (SELECT … FOR UPDATE), an atomic conditional update, or an idempotency key. Standard: OWASP race conditions / API6:2023.`,
  ai_security: (f) => `Harden the AI feature in "${f.title}". If it obeyed an injected instruction or leaked its system prompt, add input/output guardrails, keep untrusted content out of the system prompt, and give the model least-privilege tools with human approval for high-risk actions. If it returned unescaped active content (<script>), escape/​sanitize the model output before rendering — treat LLM output as untrusted user input. Standard: OWASP LLM Top 10 (LLM01/LLM02/LLM06).`,
  code_smell: (f) => `Fix the dangerous code sink in "${f.title}". Remove or guard the flagged pattern (eval/new Function on input, child_process with interpolated input, unparameterized SQL, dangerouslySetInnerHTML with untrusted data). Standard: CWE-94 (code injection) / CWE-78 (command injection).`,
  info_disclosure: (f) => `Stop the information disclosure in "${f.title}". Return generic error messages (no stack traces / framework versions / internal paths), remove verbose server banners (X-Powered-By), and don't expose debug endpoints in production. Standard: OWASP WSTG-ERRH / CWE-200.`,
  api_contract: (f) => `Fix the API contract failure in "${f.title}". Handle malformed input with a clean 400 (never a 500/stack trace), validate the request body/params server-side, and return the documented status + shape. Standard: OWASP API8:2023 (security misconfiguration) / robust input handling.`,
  secret_exposure: (f) => `Remove the exposed secret in "${f.title}" and ROTATE it immediately (assume it's compromised). Move it to a gitignored env var / secret manager, purge it from git history (git filter-repo), and add a .gitignore rule so it can't be re-committed. Standard: OWASP WSTG configuration / CWE-798 (hardcoded credentials).`,
  dependency_cve: (f) => `Update the vulnerable dependency in "${f.title}" to a patched version (start with the KEV / high-EPSS items called out first). If no fix exists, pin/replace it or apply the advisory's mitigation. Then re-run to confirm the advisory clears. Standard: OSV/GHSA advisories, CISA KEV, EPSS.`,
  focus_order: (f) => `Fix the focus order in "${f.title}". Remove positive tabindex values — they override the natural DOM order and trip keyboard/screen-reader users. Order the DOM as it should be read and use tabindex="0"/"-1" only. Standard: WCAG 2.2 SC 2.4.3.`,
  wcag22: (f) => `Fix the WCAG 2.2 AA issue in "${f.title}". For reflow (1.4.10): ensure content fits at 320px CSS width with no horizontal scroll (wrap wide tables in an overflow-x container, use responsive layout). For target size (2.5.8): make interactive controls at least 24×24 CSS px. Standard: WCAG 2.2 AA, EN 301 549 (EAA).`,
  custom_rule: (f) => `A custom rule-pack assertion failed in "${f.title}". This is a check your team declared in a .rulepack.json — bring the response back in line with the declared expectation (the failing matcher is in the finding detail). Standard: your organization's rule pack.`,
};

export function buildFixPrompt(f: Finding): string {
  const body = FIX_TEMPLATES[f.category]?.(f) ?? `Fix: ${f.summary}`;
  return `${body}\n\nThen re-run: npx launchaudit --reverify to confirm this specific check now passes.`;
}

/** True when a category has a tailored fix template (not the generic fallback). Used by a
 *  guard test so no bug-producing detector ships without an actionable fix for the loop. */
export function hasFixTemplate(category: string): boolean {
  return category in FIX_TEMPLATES;
}

/** The launch-blockers that lead the report: highest-severity findings first, max 3. */
export function fixTheseThree(findings: Finding[]): Finding[] {
  return [...findings]
    .sort((a, b) => (SEVERITY_RANK[a.severity.toLowerCase()] ?? 9) - (SEVERITY_RANK[b.severity.toLowerCase()] ?? 9))
    .slice(0, 3);
}
