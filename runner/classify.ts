/**
 * Failure classifier — the trust wedge over TestSprite. A failed check is not
 * automatically a product bug. We label every failure as one of:
 *   product_bug | test_bug | flaky | needs_verification | needs_input
 * with a confidence and a plain reason, using deterministic signals only.
 *
 * Honesty rules baked in (Truth Protocol):
 *  - RBAC exposure found against a stubbed/bypassed-auth environment is
 *    needs_verification, NOT a confirmed vuln.
 *  - Front-end timing flakes are caught by retry in the runner and never reach
 *    here as failures; a failure that survived retries is treated as stable.
 */
import type { CardResult } from "./execute-core.ts";

export type FindingType = "product_bug" | "test_bug" | "flaky" | "needs_verification" | "needs_input";
export type Classification = { type: FindingType; confidence: "high" | "medium" | "low"; reason: string };
export type ClassifyContext = { appUrl: string; devStubAuth: boolean };

const has = (s: string | undefined, frag: string) => (s ?? "").toLowerCase().includes(frag.toLowerCase());

export function classifyFailure(result: CardResult, ctx: ClassifyContext): Classification {
  const err = result.error ?? "";
  const cat = result.card.category;
  const isRbac = cat === "roles_permissions";
  const isExposure = has(err, "blocked") || has(err, "exposed");

  // SPA caveat (Truth Protocol): an "expectBlocked" route returned the client app
  // shell, not server-rendered HTML — an HTTP probe can't confirm exposure. The
  // browser guards the page and the API is the real gate (tested separately by
  // the admin-API cards). So this is verify-it, never a confirmed critical hole.
  if (has(err, "[SPA_SHELL]") || has(err, "client-rendered SPA shell")) {
    return {
      type: "needs_verification",
      confidence: "high",
      reason:
        "this route returned a client-rendered SPA shell (HTTP 200, same skeleton as the homepage) instead of server-rendered HTML, so an unauthenticated HTTP probe cannot prove it is exposed — the page is guarded in the browser and the real authorization gate is the API (this audit tests the admin API separately). Verify the API enforces authz, or re-run with an authenticated browser session; not a confirmed hole.",
    };
  }

  // Write-authz, unknown-intent surface: an anonymous well-formed write was
  // ACCEPTED (the only way this card fails). We can't tell from the repo if the
  // route is meant to be public, so a human confirms — never a claimed bug.
  if (cat === "write_authz_unverified") {
    return {
      type: "needs_verification",
      confidence: "medium",
      reason:
        "an unauthenticated, well-formed write was accepted on an API route whose access intent isn't declared — confirm whether this endpoint is intentionally public (e.g. a contact form or public webhook) or is missing server-side write authorization",
    };
  }
  // Write-authz, privileged surface: the anonymous write was not rejected with
  // 401/403. Distinguish an accepted write (confirmed hole) from a shape/method
  // rejection (auth not provably the gate → verify, don't over-claim).
  if (cat === "write_authz") {
    const got = Number((err.match(/got (\d{3})/) ?? [])[1] ?? 0);
    const accepted = got >= 200 && got < 300;
    if (accepted && ctx.devStubAuth) {
      return { type: "needs_verification", confidence: "high", reason: "auth is stubbed/bypassed in this environment, so an accepted anonymous write here does not prove a production hole — re-run against an environment with real auth active" };
    }
    if (accepted) {
      return { type: "product_bug", confidence: "high", reason: "an unauthenticated, well-formed write was ACCEPTED (2xx) on a privileged surface — server-side write authorization is missing (open write)" };
    }
    if (got >= 500) {
      return { type: "product_bug", confidence: "high", reason: "an unauthenticated write triggered a 5xx on a privileged surface — the auth gate is missing and the handler crashed on the input" };
    }
    return { type: "needs_verification", confidence: "medium", reason: `the privileged write was rejected with a ${got || "non-2xx"} (shape/method), not a 401/403 — confirm the auth gate rejects a well-formed anonymous write, not just a malformed one` };
  }

  // Privileged surface reachable, but auth is stubbed here → cannot conclude a real hole.
  if (isRbac && isExposure && ctx.devStubAuth) {
    return {
      type: "needs_verification",
      confidence: "high",
      reason:
        "auth is stubbed/bypassed in this environment (local dev with a dev-bypass key), so anonymous access here does not prove a production hole — re-run against an environment with real auth active",
    };
  }
  // Privileged surface reachable with real auth in play → the high-value finding.
  if (isRbac && isExposure) {
    return {
      type: "product_bug",
      confidence: "high",
      reason: "a privileged surface answered an unauthenticated request — server-side authorization is missing, not just UI-hidden",
    };
  }
  // SEO / structured data. Title + viewport are universal page quality (a real
  // miss); the rest (description, canonical, OG, JSON-LD, noindex) are public-
  // marketing-specific — a gap for a public page, irrelevant to an internal
  // tool — so we verify intent rather than claim a bug.
  if (cat === "seo") {
    if (has(err, "<title>") || has(err, "viewport")) {
      return { type: "product_bug", confidence: "medium", reason: "a universal page-quality element is missing — every page needs a real title and a mobile viewport" };
    }
    return { type: "needs_verification", confidence: "low", reason: "a public-page SEO/structured-data element is missing (or a noindex is present) — a real gap if this is a public/marketing page, not applicable to an internal tool; confirm which this is" };
  }
  // Object-level authorization (IDOR/BOLA). A normal user served another owner's
  // object is a confirmed hole — unless auth is stubbed here (can't conclude).
  if (cat === "object_authz") {
    if (ctx.devStubAuth) return { type: "needs_verification", confidence: "high", reason: "auth is stubbed/bypassed in this environment, so cross-user object access here doesn't prove a production IDOR — re-run with real auth active" };
    return { type: "product_bug", confidence: "high", reason: "an authenticated normal user was served another owner's object by swapping the id — object-level authorization (IDOR/BOLA) is missing (WSTG-ATHZ-04 / CWE-639)" };
  }
  // Two-identity privilege gradient (metamorphic authz). A "no baseline" failure is our
  // setup gap (verify), a stubbed-auth env can't conclude, and an actual gradient break —
  // a lower-privilege identity seeing ~all of admin's content — is a confirmed hole.
  if (cat === "privilege_gradient") {
    if (has(err, "admin baseline") || has(err, "[blocked]")) {
      return { type: "needs_verification", confidence: "medium", reason: "the admin baseline for the two-identity gradient couldn't be established (admin session invalid, or the resource wasn't readable as admin) — provide a valid admin session and a real protected resource, then re-run" };
    }
    if (ctx.devStubAuth) return { type: "needs_verification", confidence: "high", reason: "auth is stubbed/bypassed here, so a lower-privilege identity seeing admin content doesn't prove a production hole — re-run with real auth active" };
    return { type: "product_bug", confidence: "high", reason: "a lower-privilege identity received ~the same content an admin sees on a protected resource — the authorization gradient is broken (a lower-privilege response must never contain as much as a higher-privilege one; WSTG-ATHZ / SMRL metamorphic relation / CWE-285)" };
  }
  // Function-level authorization on a privileged mutation by a normal user.
  if (cat === "mutation_authz") {
    if (ctx.devStubAuth) return { type: "needs_verification", confidence: "high", reason: "auth is stubbed/bypassed here, so a normal user reaching this mutation doesn't prove a production hole — re-run with real auth active" };
    return { type: "product_bug", confidence: "high", reason: "a normal user's privileged mutation was not rejected (no 401/403) — function-level authorization is missing; the denial that would prove no state change never happened (OWASP API5 / CWE-285)" };
  }
  if (cat === "cors") {
    return { type: "product_bug", confidence: "high", reason: "CORS reflects an arbitrary Origin together with Access-Control-Allow-Credentials: true — any site can make credentialed cross-origin requests (CWE-942)" };
  }
  if (cat === "cookie_security") {
    return { type: "product_bug", confidence: "medium", reason: "the session cookie is missing a hardening attribute (HttpOnly/Secure/SameSite) — exposes it to XSS theft, cleartext leakage, or CSRF (CWE-1004 / CWE-614)" };
  }
  if (cat === "mass_assignment") {
    if (ctx.devStubAuth) return { type: "needs_verification", confidence: "high", reason: "auth is stubbed/bypassed here, so an accepted privileged field doesn't prove a production escalation — re-run with real auth active" };
    return { type: "product_bug", confidence: "high", reason: "an update endpoint accepted/echoed privileged fields (role/isAdmin) — mass-assignment lets a normal user escalate (OWASP API3 / CWE-915)" };
  }
  // Sensitive-property / excessive-data exposure (READ side of property-level authz).
  // A NEVER-EXPOSE property (credential/secret/PII) reached a low-privilege response.
  if (cat === "data_exposure") {
    if (ctx.devStubAuth) return { type: "needs_verification", confidence: "high", reason: "auth is stubbed/bypassed here, so a sensitive property reaching this session doesn't prove a production leak — re-run with real auth active" };
    return { type: "product_bug", confidence: "high", reason: "a JSON response served to a low-privilege user carried a credential/secret/PII property (password/ssn/apiKey/card_number/…) that must never leave the server — excessive data exposure / BOPLA read (OWASP API3:2023 / API6 / CWE-213)" };
  }
  if (cat === "tls_hsts") {
    return { type: "product_bug", confidence: "medium", reason: "transport security gap — HSTS missing or http does not redirect to https, so credentials/cookies can travel in cleartext or be downgraded" };
  }
  if (cat === "injection") {
    return { type: "product_bug", confidence: "high", reason: "an injection canary was mishandled — the input 500'd the server, leaked a DB/engine error, or was reflected/evaluated unescaped (WSTG-INPV / CWE-89/79)" };
  }
  if (cat === "funnel") {
    return { type: "product_bug", confidence: "high", reason: "a conversion-funnel step is broken — a dead CTA/404, a missing confirmation, no tracking pixel, a broken payment step, or a slow/overflowing mobile landing page costs leads or sales right at the point of conversion" };
  }
  // Accessibility (axe-core). The generator only fails on serious/critical WCAG
  // violations, so a failure here is a real defect — confirmed, not speculative.
  if (cat === "accessibility") {
    return { type: "product_bug", confidence: "high", reason: "axe-core found serious/critical WCAG violations on the rendered page — real users (screen readers, keyboard, low-vision) are blocked, and it carries ADA/legal risk" };
  }
  // WCAG 2.2 AA depth axe can't auto-detect. Reflow (1.4.10) and target size (2.5.8)
  // are DETERMINISTIC measurements → a confirmed failure. (Focus order lives under its
  // own category as a review question.)
  if (cat === "wcag22") {
    return { type: "product_bug", confidence: "high", reason: "a deterministic WCAG 2.2 AA check failed — content overflows horizontally at 320px (SC 1.4.10 Reflow) or an interactive target is below 24×24px (SC 2.5.8) — real users are blocked and it carries EAA/ADA legal risk" };
  }
  // Malicious-package / supply-chain. A high-severity install-script exfil pattern is a
  // confirmed malicious signal (Shai-Hulud class); typosquat/registry signals are strong
  // but a legit name/registry can match → verify, never over-claim.
  if (cat === "supply_chain") {
    if (has(err, "malicious install-script")) {
      return { type: "product_bug", confidence: "high", reason: "a package install-lifecycle script (pre/postinstall) matches an exfil pattern — network-piped-to-shell, secret-reading, or a bundle.js loader — the delivery vector of the Shai-Hulud-class npm attacks; treat as malicious and remove/pin it before install runs anywhere" };
    }
    return { type: "needs_verification", confidence: "medium", reason: "a supply-chain signal (a dependency one edit from a popular package, or resolved from a non-official registry) — a strong typosquat/dependency-confusion indicator; confirm the package name and registry are intended before shipping" };
  }
  // Org-authored custom rule (rule pack). The org declared the expectation, so a failed
  // assertion is a confirmed deviation from THEIR policy — a real finding they asked for.
  if (cat === "custom_rule") {
    return { type: "product_bug", confidence: "high", reason: "a custom rule-pack assertion failed — the response deviates from a check this org declared in its rule pack" };
  }
  // Positive tabindex is a focus-order hazard, not a guaranteed violation → verify.
  if (cat === "focus_order") {
    return { type: "needs_verification", confidence: "medium", reason: "a positive tabindex was found, which overrides the natural focus order (WCAG 2.2 SC 2.4.3 hazard) — confirm the intended keyboard order, then remove positive tabindex values in favor of DOM order" };
  }
  // Core Web Vitals. A single cold headless measurement is a smoke signal, not a
  // lab benchmark — so even a "poor" reading is verify, not a confirmed bug.
  if (cat === "performance") {
    return { type: "needs_verification", confidence: "medium", reason: "a single cold headless load measured a Core Web Vital in the poor range — confirm with a throttled lab run or field (CrUX) data before treating it as a regression" };
  }
  // Defense-in-depth headers (Content-Security-Policy / Cross-Origin-Opener-Policy).
  // Absence or a permissive directive is strong hardening guidance for a public app,
  // but context-dependent (an internal tool or static page may not need it) — so we
  // verify intent rather than over-claim a bug. Hard header requirements (nosniff,
  // X-Frame-Options, no X-Powered-By) still fall through to product_bug below.
  if (cat === "security_headers" && has(err, "defense-in-depth")) {
    return { type: "needs_verification", confidence: "medium", reason: "a defense-in-depth header (Content-Security-Policy / Cross-Origin-Opener-Policy) is missing or carries a permissive directive ('unsafe-inline'/'unsafe-eval') — strong XSS/XS-Leak hardening for a public app, but confirm it applies to this surface before treating it as a defect" };
  }
  // Dependency CVE (SCA / OSV). A pinned version matching a published OSV/GHSA advisory
  // is real and verifiable from the lockfile. An OSV lookup that itself failed is our
  // tooling's problem (test_bug), never a claim about the app.
  if (cat === "dependency_cve") {
    if (has(err, "OSV query failed")) {
      return { type: "test_bug", confidence: "high", reason: "the OSV.dev lookup itself failed (network/API) — this is our tooling, not a finding about the app; re-run with connectivity" };
    }
    // Reachability-lite: a matching advisory on a package your source doesn't import
    // (transitive/unused) is lower priority — upgrade when convenient, but verify
    // reachability before treating it as launch-blocking. Imported → confirmed bug.
    if (has(err, "none imported by your code")) {
      return { type: "needs_verification", confidence: "medium", reason: "a pinned dependency matches a published OSV/GHSA advisory, but your own source does not import it (transitive or unused) — upgrade when convenient; confirm whether anything reaches it before treating it as launch-blocking" };
    }
    return { type: "product_bug", confidence: "medium", reason: "a pinned dependency your code imports matches a published OSV/GHSA advisory — upgrade to a fixed version (reachability here is import-presence, not a full call graph, but this package is actually pulled into your app)" };
  }
  // Dependency licenses. A copyleft/unknown license is a legal/policy decision, not a
  // code defect — surface it for review, never auto-fail it as a bug.
  if (cat === "dependency_license") {
    return { type: "needs_verification", confidence: "medium", reason: "a direct dependency ships a copyleft (GPL/AGPL/SSPL/…) or unknown license — this can impose source-disclosure or other obligations on a proprietary app; have legal review it before launch (a compliance decision, not a code defect)" };
  }
  // SAST-lite code sinks (grep, no taint). A dynamic-code / HTML-injection sink is a
  // place to REVIEW for untrusted input, not a proven exploit → verify, don't claim.
  if (cat === "code_smell") {
    return { type: "needs_verification", confidence: "medium", reason: "a dynamic-code or HTML-injection sink (eval / new Function / interpolated child_process / dangerouslySetInnerHTML / innerHTML=) is present — these are the usual XSS/RCE entry points; confirm each only ever receives trusted, sanitized input (a pattern match, not a proven exploit — pair with a full SAST like Semgrep for taint analysis)" };
  }
  // Secret exposure (repo scan). A known-FORMAT credential (gitleaks "specific" detector:
  // AWS/GitHub/Stripe/Slack/Google/OpenAI/PEM, or a committed .env) sitting in tracked
  // source is real and verifiable from the bytes on disk → confirmed bug. A bare high-
  // entropy generic hit is only a candidate (could be an example/hash) → verify, don't claim.
  if (cat === "secret_exposure") {
    if (has(err, "live-format") || has(err, "live format")) {
      return { type: "product_bug", confidence: "high", reason: "a live-format credential is committed in tracked source — rotate it and purge it from git history (a commit lives forever; anyone with repo access already has the key)" };
    }
    return { type: "needs_verification", confidence: "medium", reason: "a high-entropy string that looks like a secret was found in tracked source — confirm it is a real credential, not an example/placeholder, a hash, or test data, before treating it as a leak" };
  }
  // Served-response info disclosure. A live-FORMAT credential in the delivered body
  // is a real leak (product_bug). A JWT / internal IP / S3 URL is only a candidate
  // (could be an intentional public token or example) → verify, don't over-claim.
  if (cat === "info_disclosure") {
    if (has(err, "served credential")) {
      return { type: "product_bug", confidence: "high", reason: "the response body served a live-format credential (an AWS/Google/Slack/Stripe key or a private key block) in delivered output — a real secret leak; rotate it and stop serving it (OWASP WSTG / CWE-200)" };
    }
    return { type: "needs_verification", confidence: "medium", reason: "the response body contains a sensitive-looking marker (a JWT, an internal RFC1918 IP, or an S3 bucket URL) — confirm it is not an intentional public token or example before treating it as information disclosure (CWE-200)" };
  }
  // Content integrity / fake data. Lorem filler, unbound undefined/NaN, and a
  // hardcoded localhost URL on a deployed page are concrete defects (real bug).
  // A generic placeholder marker might be intentional copy → verify, don't claim.
  if (cat === "content_integrity") {
    if (has(err, "lorem") || has(err, "undefined") || has(err, "nan") || has(err, "localhost")) {
      return { type: "product_bug", confidence: "medium", reason: "the live page rendered placeholder or unbound data (lorem filler, an undefined/NaN value, or a hardcoded localhost URL) — real content/data wiring is missing" };
    }
    return { type: "needs_verification", confidence: "low", reason: "a possible placeholder marker is present — confirm it's intentional (e.g. a genuine stub/coming-soon section) rather than unfinished content" };
  }
  // Server 5xx where a clean 4xx was expected → unhandled exception path.
  if (/status 5\d\d/i.test(err) || has(err, "5xx")) {
    return { type: "product_bug", confidence: "high", reason: "the server threw a 5xx instead of a clean 4xx — an unhandled exception path (DoS / info-leak risk)" };
  }
  // Secret / VCS / stack-trace leak in a response body.
  if (has(err, "leaks")) {
    return { type: "product_bug", confidence: "high", reason: "the response exposed sensitive content (secret, version-control data, or a stack trace)" };
  }
  // Hardening header missing / weak / leaking.
  if (has(err, "missing required header") || has(err, "expected one of") || has(err, "should not be exposed")) {
    return { type: "product_bug", confidence: "medium", reason: "a hardening header is missing, set to a weak value, or leaking the stack" };
  }
  // Front-end expectation that survived retries (timing flakes are filtered out upstream).
  if (cat === "core_workflow" || cat === "responsive_visual" || cat === "console_network") {
    return { type: "product_bug", confidence: "medium", reason: "a user-facing expectation failed on every attempt — not a one-off flake" };
  }
  return { type: "product_bug", confidence: "medium", reason: result.error ?? "check failed" };
}
