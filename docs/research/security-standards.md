# LaunchAudit — Security & Launch-Readiness Check Catalog

> **Purpose.** This is the concrete, executable check catalog that powers LaunchAudit's
> security and launch-readiness auditing. Every entry is an assertion the runner can
> actually execute against a **live URL** (HTTP probe / Playwright) and/or detect as a
> **repo signal** (file/grep/AST scan). The catalog is deliberately deeper than TestSprite
> on **admin / RBAC / middleware / backend authorization** — that depth is the product's
> reason to exist (see `docs/PRD.md`).
>
> **How the runner uses this.** Each row maps to a `test_card` (`docs/production-architecture.md`).
> `category` → card category; `severity` → finding severity; `how to test` → the runner's
> execution recipe; `pass criteria` → the structured assertion. A failing assertion becomes a
> `finding`; product-bug findings spawn `repair_tasks`.
>
> **Execution model.** Two signal sources, used together:
> - **LIVE** — HTTP requests with controlled credentials/headers and/or Playwright DOM crawl
>   against the running app (local or staging). This is ground truth.
> - **REPO** — static signal from the repository (file presence, grep, dependency manifest,
>   route/handler AST). Repo signal *corroborates and localizes* a live finding; it never
>   *replaces* live verification. A repo smell with no live confirmation is reported as
>   `needs-input` / `advisory`, never as a hard fail. (Honesty contract, PRD §Differentiators 5.)
>
> **Role model.** The runner captures up to three local auth states and replays each:
> `ANON` (no session), `USER` (authenticated, non-privileged), `ADMIN` (authenticated, privileged).
> Cross-role checks run the *same* request under each state and compare status/redirect/body.
>
> **Severity scale:** `critical` (exploitable auth/data exposure, ship-blocker) ·
> `high` (security control missing/broken) · `medium` (hardening gap, defense-in-depth) ·
> `low` (advisory / best-practice) · `info` (observation, no fail).
>
> **ID scheme:** `LA-<DOMAIN>-NN`. Domains: `AC` access control/RBAC, `MW` middleware,
> `API` backend/API hygiene, `HDR` security headers, `SEC` secrets/exposure, `AUTH`
> authn/session, `CRYPTO` crypto/transport, `INJ` injection, `DEP` components, `LOG`
> logging/monitoring, `SSRF`, `INTEG` integrity, `DESIGN` insecure design.
>
> Last researched: 2026-06-12. Sources cited inline and in the Sources section.

---

## 0. Quick map: where the depth is

| Block | IDs | What it proves | Live? | Repo? |
|---|---|---|---|---|
| 1. OWASP Top 10 (2021) coverage | LA-AC/CRYPTO/INJ/DESIGN/HDR/DEP/AUTH/INTEG/LOG/SSRF | Each Top-10 risk has ≥1 automatable check | mixed | mixed |
| 2. ASVS L1/L2 testable subset | folded into domain blocks (tagged `ASVS x.y.z`) | Standards-traceable verification | mixed | mixed |
| 3. **Authorization / RBAC matrix** | LA-AC-01 … LA-AC-20 | `{anon,user,admin} × {page,api,mutation,detail,IDOR}` | **yes** | corroborate |
| 4. **Middleware depth** | LA-MW-01 … LA-MW-12 | server-side guards, redirects, header injection, bypass | **yes** | **yes** |
| 5. Security headers | LA-HDR-01 … LA-HDR-12 | full header set + correct values | **yes** | corroborate |
| 6. API hygiene | LA-API-01 … LA-API-14 | status, malformed→4xx, error shape, CORS, rate limit | **yes** | corroborate |
| 7. Secrets / exposure | LA-SEC-01 … LA-SEC-10 | .env, source maps, NEXT_PUBLIC misuse, key leakage | **yes** | **yes** |

The RBAC matrix (block 3) and middleware (block 4) are the differentiators. They are
written first-class and exhaustively; TestSprite stops at "page renders / form submits."

---

## 1. OWASP Top 10 (2021) — automatable check per category

The 2021 list is the stable, widely-referenced baseline (the 2025 edition was in
release at research time; mappings here remain valid as 2025 keeps Broken Access Control
at #1 and folds SSRF into it). Each category gets the *concrete* check an auditor runs.

| ID | OWASP cat | What it verifies | How to test (LIVE + REPO) | Pass criteria | Severity |
|---|---|---|---|---|---|
| LA-AC-00 | A01 Broken Access Control | Access is denied by default; enforced server-side, not UI-hidden | LIVE: full block 3 matrix below. REPO: every protected route/handler has a server-side auth check near data. | All block-3 assertions pass; no protected resource reachable cross-role | critical |
| LA-CRYPTO-01 | A02 Cryptographic Failures | Transport is HTTPS; secrets not sent/stored in clear; no weak hashing of passwords | LIVE: `http://` request to app → must 301/308 to `https://`; check cookies are `Secure`. REPO: grep for `md5(`/`sha1(` on passwords, hardcoded keys, `crypto.createCipher` (deprecated). | http→https redirect present; auth cookies `Secure`+`HttpOnly`; no weak password hashing in repo | high |
| LA-INJ-01 | A03 Injection | Untrusted input cannot alter SQL/command/template semantics | LIVE: submit `'`, `" OR 1=1--`, `${7*7}`, `<svg onload=alert(1)>` into form fields & query params → response must not 500, must not reflect unencoded, must not return DB error text. REPO: grep raw string concatenation into SQL (`query(\`...\${`), `child_process.exec(` with input, `dangerouslySetInnerHTML`, missing parameterization (Drizzle/Prisma OK). | No 500 / no SQL error leakage / no unescaped reflection; repo uses parameterized queries | critical |
| LA-DESIGN-01 | A04 Insecure Design | Sensitive flows have rate limits, lockout, and server-side business rules | LIVE: covered by LA-API-11 (rate limit) + LA-AC mutations. REPO: presence of rate-limit middleware on auth/mutation routes; server-side validation (Zod/Yup) at boundaries. | Sensitive endpoints rate-limited; validation exists server-side | medium |
| LA-HDR-00 | A05 Security Misconfiguration | Hardening headers present; debug/listing disabled; defaults removed | LIVE: full block 5 header set; verify directory listing off; `X-Powered-By`/`Server` minimized. REPO: framework debug/telemetry flags, `app.set('x-powered-by')` disabled. | Block-5 headers pass; no directory listing; no verbose tech banners | high |
| LA-DEP-01 | A06 Vulnerable & Outdated Components | No known-vulnerable dependencies; framework patched | REPO: parse `package-lock.json`/`package.json`; run `npm audit --json`; flag Next.js < patched (see LA-MW-10 / CVE-2025-29927). LIVE: fingerprint version banners if exposed. | Zero `high`/`critical` advisories from `npm audit`; framework ≥ patched version | high |
| LA-AUTH-01 | A07 Identification & Authentication Failures | Auth enforced; weak-password & session handling sound | LIVE: block 8 (session/cookie flags, logout invalidation, no creds in URL). REPO: password policy (min length/complexity), session library usage. | Block-8 assertions pass | high |
| LA-INTEG-01 | A08 Software & Data Integrity Failures | No untrusted deserialization / unsigned auto-update / unverified CI artifacts | REPO: grep `eval(`, `Function(`, untrusted `JSON`/`node-serialize`, CDN `<script>` without `integrity=` (SRI). LIVE: third-party scripts loaded over https with SRI where applicable. | No untrusted deserialization; external scripts use SRI or first-party | medium |
| LA-LOG-01 | A09 Security Logging & Monitoring Failures | Auth failures / access-control denials are logged; errors don't silently pass | REPO: logging on auth failure paths & 403/401 branches; error monitoring (Sentry/console) wired. LIVE: repeated failed logins still return correct status (proxy for lockout/log). | Access-control-failure logging present in repo; no silent catch-and-200 | low |
| LA-SSRF-01 | A10 SSRF | Server-side fetchers can't be steered to internal/metadata hosts | LIVE: if app has a "fetch URL / import from URL / webhook" feature, submit `http://169.254.169.254/`, `http://localhost:<port>`, `file:///etc/passwd` → must be rejected/allowlisted, not fetched. REPO: grep server-side `fetch(`/`axios(` on user-supplied URL without allowlist. | User-controlled server-side fetch is allowlisted; metadata/internal hosts blocked | high |

> **Note on A03/A10 live tests:** these are *safe, non-destructive* probes (canary payloads,
> read-only). The runner must never run destructive injection (no `DROP`, no write SSRF) — it
> asserts on the *response shape*, not on causing damage. (Aligns with `careful`-mode doctrine.)

---

## 2. OWASP ASVS L1/L2 — testable items for a Next.js/Node SaaS

ASVS 4.0 chapters used: V1 Architecture, V2 Authentication, V3 Session, V4 Access Control,
V5 Validation/Encoding, V7 Error/Logging, V8 Data Protection, V9 Communication, V13 API,
V14 Configuration. The relevant **L1 (and key L2)** items are folded into the domain blocks
below and tagged inline as `[ASVS x.y.z]`. The high-value testable set:

| ASVS item | Requirement (paraphrased, testable) | Implemented as |
|---|---|---|
| V4.1.1 (L1) | Enforce access-control rules on a trusted server-side layer, not client | LA-AC-04, LA-AC-09, LA-MW-02 |
| V4.1.2 (L1) | User/data attributes used for access decisions can't be manipulated by client | LA-AC-12, LA-AC-13 |
| V4.1.3 (L1) | Principle of least privilege — features enforce specific authorization | LA-AC-05..08 |
| V4.1.5 (L1) | Access controls fail securely (deny by default) | LA-AC-01, LA-MW-02 |
| V4.2.1 (L1) | Sensitive records protected from IDOR / unauthorized direct reference | LA-AC-14, LA-AC-15 |
| V4.3.1 (L1) | Admin interfaces enforce stronger/multi-step access control | LA-AC-06, LA-AC-10 |
| V2.1.x (L1) | Password length/complexity & breach checks | LA-AUTH-02 (repo) |
| V3.2.1 / V3.4.x (L1) | Session tokens random; cookies `Secure`,`HttpOnly`,`SameSite` | LA-AUTH-03, LA-AUTH-04 |
| V3.3.1 (L1) | Logout invalidates the session server-side | LA-AUTH-05 |
| V5.1.3 (L1) | All input validated (allowlist) server-side | LA-API-05, LA-DESIGN-01 |
| V5.2.x (L1) | Output encoding / no unsanitized HTML sink | LA-INJ-01 |
| V7.4.1 (L1) | Generic error messages; no stack traces/internal detail to client | LA-API-06, LA-API-07 |
| V8.3.x (L1) | Sensitive data not in URL/query/logs | LA-AUTH-06, LA-SEC-07 |
| V9.1.1 (L1) | TLS for all connections; HTTP redirects to HTTPS | LA-CRYPTO-01, LA-HDR-03 |
| V13.1.x (L1) | API enforces same access control as the UI | LA-AC-07, LA-AC-08 |
| V13.2.x (L1) | Correct HTTP verbs; reject unexpected methods | LA-API-03, LA-API-04 |
| V14.2.x (L1) | No vulnerable/outdated components; deps patched | LA-DEP-01 |
| V14.3.x (L1) | No debug/diagnostic features in production; no info leakage | LA-HDR-00, LA-SEC-02, LA-API-07 |
| V14.4.x (L1) | Security headers (CSP, X-Content-Type-Options, HSTS) sent | block 5 |
| V14.5.x (L2) | Reject content types other than expected; verify Origin on state-changing requests | LA-API-08, LA-API-12 |

---

## 3. Authorization / RBAC test matrix — the full cross product

This is the heart of LaunchAudit. The runner takes the discovered surface and replays the
**same request under each role**, asserting the difference. Discovery feeds two lists:
- **Protected page routes** (e.g. `/dashboard`, `/admin`, `/admin/users`) — from route scan + crawl.
- **Protected API routes** (e.g. `GET /api/admin/users`, `POST /api/users/:id/role`) — from handler scan.

Core principle (OWASP Authorization Cheat Sheet): **deny by default; validate every request
server-side; verify object ownership; never rely on client-side hiding.** Each cell is a
pass/fail assertion. `→` denotes "expected response."

### 3a. Page routes × role

| ID | What it verifies | How to test (LIVE) | Pass criteria | Severity |
|---|---|---|---|---|
| LA-AC-01 | Anonymous cannot view a protected page | `GET <protected_page>` with **no** session, no-follow-redirects | Status ∈ {301,302,307,308} to login **OR** 401/403. **Never 200 with protected content.** `[ASVS 4.1.5]` | critical |
| LA-AC-02 | Anonymous redirect lands on auth, not the page | Follow the redirect from LA-AC-01 | Final URL is the login/sign-in route; protected DOM not rendered | high |
| LA-AC-03 | Normal user cannot view an **admin** page | `GET <admin_page>` with **USER** session | Status 403 **OR** redirect away from admin. Not 200-with-admin-UI. `[ASVS 4.3.1]` | critical |
| LA-AC-04 | Admin page is *server-guarded*, not just nav-hidden | Request `<admin_page>` directly by URL as USER (bypassing nav) | Same as LA-AC-03 — direct URL entry is blocked, proving server-side enforcement. `[ASVS 4.1.1]` | critical |
| LA-AC-05 | Admin **can** view admin page (no false-positive lockout) | `GET <admin_page>` with **ADMIN** session | Status 200, admin content renders | info (regression guard) |
| LA-AC-06 | Normal user view of admin reveals **no** admin data even if page shell loads | As USER, inspect rendered DOM/network for admin-only data | No admin records, counts, or controls present in payload | critical |

### 3b. API routes × role

| ID | What it verifies | How to test (LIVE) | Pass criteria | Severity |
|---|---|---|---|---|
| LA-AC-07 | Protected API rejects anonymous | `GET <protected_api>` with no auth header/cookie | Status 401 (or 403). **Not 200, not 500.** `[ASVS 13.1.x]` | critical |
| LA-AC-08 | Admin API rejects normal user | `GET <admin_api>` with **USER** token | Status 403. Body contains no admin data. `[ASVS 4.1.3, 13.1.x]` | critical |
| LA-AC-09 | API auth is enforced at the route, not only by the page that calls it | Call `<admin_api>` directly (no Referer/Origin of admin page) as USER | Still 403 — proves enforcement lives in the handler, not the caller. `[ASVS 4.1.1]` | critical |
| LA-AC-10 | Admin API serves admin (regression guard) | `GET <admin_api>` with **ADMIN** token | 200 with expected shape | info |
| LA-AC-11 | Unauthenticated API never 500s the auth check | `GET <protected_api>` with malformed/blank token | 401/403 (graceful), never 500 (auth code crash = bypass risk) | high |

### 3c. Privileged mutations × role

| ID | What it verifies | How to test (LIVE) | Pass criteria | Severity |
|---|---|---|---|---|
| LA-AC-12 | Anonymous cannot perform privileged mutation | `POST/PUT/PATCH/DELETE <privileged_mutation>` with no auth | 401/403; no state change | critical |
| LA-AC-13 | Normal user cannot perform admin mutation (e.g. change role, delete user) | As USER, `POST <admin_mutation>` (e.g. `/api/users/:id/role` body `{"role":"admin"}`) | 403; **verify no state change** (re-read the object after) — UI hiding is not enough. `[ASVS 4.1.1, 4.1.2]` | critical |
| LA-AC-14 | Self-privilege-escalation blocked | As USER, attempt to set **own** role to admin via any mutation/metadata endpoint | Rejected; role unchanged on re-read. `[ASVS 4.1.2]` | critical |
| LA-AC-15 | Mass-assignment can't inject privileged fields | As USER, send extra fields (`isAdmin:true`, `role:"admin"`, `verified:true`) to a normal update endpoint | Privileged fields ignored/rejected; not persisted | high |

### 3d. Direct-URL / detail-page access (forced browsing)

| ID | What it verifies | How to test (LIVE) | Pass criteria | Severity |
|---|---|---|---|---|
| LA-AC-16 | Admin **detail** pages blocked by direct URL for non-admin | As USER, `GET /admin/users/<id>` (and other deep admin URLs) directly | 403/redirect; detail content not rendered. (OWASP A01 forced-browsing scenario.) | critical |
| LA-AC-17 | "Hidden" routes aren't security | Enumerate routes from JS bundle / sitemap / build manifest; request the non-linked ones as ANON/USER | Each still enforces auth per its sensitivity (no security-by-obscurity) | high |

### 3e. IDOR / object-id swap (record ownership)

| ID | What it verifies | How to test (LIVE) | Pass criteria | Severity |
|---|---|---|---|---|
| LA-AC-18 | User A cannot read User B's object by id swap | With **USER-A** session, take a known owned id, request a **different** id on the same resource (`/api/orders/<B_id>`, `/api/users/<B_id>`) | 403/404; **never** returns B's data. Ownership verified server-side (A01 IDOR / `[ASVS 4.2.1]`). | critical |
| LA-AC-19 | User A cannot mutate User B's object by id swap | USER-A `PATCH/DELETE` on B's object id | 403/404; B's object unchanged on re-read | critical |
| LA-AC-20 | Sequential/guessable ids don't widen exposure | Probe `id-1`, `id+1`, adjacent ids as USER-A | Each non-owned id denied; no enumeration leak (existence not distinguishable via differing status/body where sensitive) | high |

**REPO corroboration for block 3 (localizes the fix):**
- Next.js App Router: a **Data Access Layer** (`verifySession()` / `getUser()`) is called inside
  Route Handlers, Server Actions, and data fetchers — **not** auth-by-layout. Authorization
  "should be performed as close as possible to your data source," and middleware "should not be
  your only line of defense." Grep: `verifySession`, `auth()`, `currentUser()`, `getServerSession`,
  per-handler role checks returning `403`/`401`. *Absence beside a protected route = high-risk smell.*
- Layout trap: auth check **only** in `layout.tsx` is insufficient (partial rendering doesn't re-run
  on navigation) — flag protected segments whose only guard is a layout. (Next.js auth guide.)
- Server Actions: every `'use server'` function that mutates must independently `verifySession()` +
  role-check — "Treat Server Actions with the same security considerations as public-facing API
  endpoints." Flag `'use server'` mutations with no session/role check.
- Clerk apps: `clerkMiddleware()` + `createRouteMatcher()` is necessary but **not sufficient** —
  each sensitive page/handler/action must also call `auth()` / `has({ role })` / check
  `sessionClaims.metadata.role`. Roles must live in `publicMetadata` (browser-readable, not
  writable). Grep: `clerkMiddleware`, `createRouteMatcher`, `auth()`, `has(`, `protect(`,
  `sessionClaims`, `publicMetadata`. Middleware-only protection with bare pages = high finding.

---

## 4. Middleware depth — server-side guards, redirects, header injection, bypass

TestSprite doesn't probe the middleware layer. LaunchAudit does. These verify that the
route-guarding / header-injecting / redirecting middleware actually does its job *server-side*,
and isn't bypassable.

| ID | What it verifies | How to test (LIVE + REPO) | Pass criteria | Severity |
|---|---|---|---|---|
| LA-MW-01 | Unauthenticated request to a protected path gets the correct redirect | LIVE: `GET <protected>` no session, no-follow → assert 3xx `Location` = login | 307/308/302 to the sign-in route (block 3 LA-AC-01/02 reuse) | critical |
| LA-MW-02 | Protected paths are *actually* protected (matcher covers them) | LIVE: enumerate every protected route incl. nested/deep ones; confirm each is guarded. REPO: read `middleware.ts`/`proxy.ts` `matcher`/`createRouteMatcher` config and diff against the protected-route list. | No protected route falls outside the matcher; no gap. `[ASVS 4.1.1]` | critical |
| LA-MW-03 | Public assets/routes are *not* over-blocked (no false lockout) | LIVE: request public routes (`/`, `/login`, static) as ANON | 200; matcher correctly excludes public/static | medium |
| LA-MW-04 | Security headers are injected by middleware/config on all responses | LIVE: full block 5 on a sample of routes incl. API | Headers present on app + API responses (block 5) | high |
| LA-MW-05 | HTTP → HTTPS upgrade enforced | LIVE: `http://<host>/<path>` → 301/308 to https; HSTS present | Redirect to https + `Strict-Transport-Security` set (LA-HDR-03) | high |
| LA-MW-06 | Rate limiting on sensitive endpoints (login/reset/mutations) | LIVE: N rapid `POST /login` (or reset) → eventually 429. REPO: rate-limit middleware present on those routes. | 429 after threshold; or documented limiter present. `[A04 / ASVS]` | medium |
| LA-MW-07 | Middleware doesn't trust client-supplied identity headers | LIVE: send forged `X-User-Id`, `X-Role: admin`, `X-Forwarded-User` to a protected route as USER/ANON | No elevation — headers ignored; access decision unchanged. `[ASVS 4.1.2]` | high |
| LA-MW-08 | **CVE-2025-29927 middleware bypass** is not exploitable | LIVE: `GET <protected>` as ANON with header `x-middleware-subrequest: middleware` **and** the v15 form `x-middleware-subrequest: middleware:middleware:middleware:middleware:middleware` (also `src/middleware:...`) | Response is **not** 200-with-protected-content — middleware still enforces. (If 200 → critical bypass.) | critical |
| LA-MW-09 | Internal/spoofable framework headers are stripped at the edge | LIVE: confirm LA-MW-08 vectors blocked; REPO: edge/proxy config drops `x-middleware-subrequest`; or Next.js ≥ patched. | Bypass header rejected at edge OR framework patched | high |
| LA-MW-10 | Next.js version is at/after the CVE-2025-29927 fix | REPO: read Next version — must be ≥ 12.3.5 / 13.5.9 / 14.2.25 / 15.2.3 for its major. | Version ≥ patched floor for its major line | high |
| LA-MW-11 | Auth redirect has no open-redirect param | LIVE: hit protected route with `?redirect=https://evil.com` (or `next=`,`returnTo=`) → after login the redirect target is validated | External redirect target rejected/normalized to same-origin | medium |
| LA-MW-12 | Middleware fails closed on error | LIVE: send input that could throw in the guard (malformed cookie/JWT) → must deny, not allow | Errors in the guard path result in 401/redirect, never 200 access | high |

---

## 5. Security headers — complete set, correct values

Values below are the **OWASP Secure Headers Project** recommendations (authoritative). The
runner reads response headers on the document, a sample of sub-routes, **and** API responses.
"Pass" = header present with a value at least as strict as shown (CSP/HSTS allow stricter).

| ID | Header | What it verifies | How to test (LIVE) | Pass criteria | Severity |
|---|---|---|---|---|---|
| LA-HDR-01 | Content-Security-Policy | Restricts script/object/frame origins → mitigates XSS & clickjacking | Read `Content-Security-Policy` on document responses | Present and non-trivial. Baseline OWASP value: `default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests`. **Fail if absent or contains `unsafe-inline`/`unsafe-eval` in `script-src` without nonce/hash.** `[ASVS 14.4.x]` | high |
| LA-HDR-02 | X-Frame-Options | Anti-clickjacking for legacy UAs | Read header | `DENY` (or `SAMEORIGIN` if framing needed). Redundant with CSP `frame-ancestors` but expected. | medium |
| LA-HDR-03 | Strict-Transport-Security | Forces HTTPS, prevents SSL-strip | Read header on an HTTPS response | Present; `max-age` ≥ 15552000 (OWASP rec `max-age=63072000; includeSubDomains`). `[ASVS 9.1.1]` | high |
| LA-HDR-04 | X-Content-Type-Options | Stops MIME-sniffing | Read header | `nosniff` exactly. `[ASVS 14.4.x]` | medium |
| LA-HDR-05 | Referrer-Policy | Limits referrer leakage | Read header | Present; one of `no-referrer` / `strict-origin-when-cross-origin` (OWASP rec `no-referrer`). | low |
| LA-HDR-06 | Permissions-Policy | Disables unused powerful features (camera, mic, geo, etc.) | Read header | Present; powerful features `()`-denied (e.g. `camera=(), microphone=(), geolocation=()` …). | low |
| LA-HDR-07 | Cross-Origin-Opener-Policy | Process isolation, blocks cross-window attacks | Read header | `same-origin` (OWASP rec). | low |
| LA-HDR-08 | Cross-Origin-Embedder-Policy | Required-CORP isolation | Read header | `require-corp` where cross-origin isolation intended; else advisory only (can break embeds) | low |
| LA-HDR-09 | Cross-Origin-Resource-Policy | Limits who can embed your resources | Read header | `same-origin` (or `same-site`) per OWASP. | low |
| LA-HDR-10 | Cache-Control (sensitive responses) | Auth'd/sensitive responses not cached | Read header on authenticated pages & API | `no-store` (OWASP rec `no-store, max-age=0`) on sensitive/authenticated responses. `[ASVS 8.x]` | medium |
| LA-HDR-11 | X-Powered-By / Server (removal) | No tech-stack disclosure | Read headers | `X-Powered-By` absent; `Server` absent or generic. (OWASP: remove these.) `[ASVS 14.3.x]` | low |
| LA-HDR-12 | X-Permitted-Cross-Domain-Policies | Blocks Adobe cross-domain policy abuse | Read header | `none` (OWASP rec) — advisory for most SaaS | info |

> CSP nuance for Next.js: inline scripts are common; a passing CSP should use **nonces/hashes**
> rather than `unsafe-inline`. The runner flags `unsafe-inline`/`unsafe-eval` in `script-src` as a
> `medium` weakening even when the header is present.

---

## 6. API hygiene — status, malformed input, error shape, CORS, rate limit

OWASP REST Security Cheat Sheet is the authority for these. The runner exercises each
discovered API route.

| ID | What it verifies | How to test (LIVE + REPO) | Pass criteria | Severity |
|---|---|---|---|---|
| LA-API-01 | Route is reachable and returns the correct success code | `GET/POST` a valid request to each known route | 200/201 as appropriate; 201 includes `Location` on resource create | info |
| LA-API-02 | Unknown route returns 404 (not 200/500) | `GET /api/<nonexistent>` | 404; not a 200 catch-all, not 500 | low |
| LA-API-03 | Wrong HTTP method is rejected | Send a method not in the route's allowlist (e.g. `DELETE` on a read-only route) | 405 Method Not Allowed (allowlist enforced). `[ASVS 13.2.x]` | medium |
| LA-API-04 | Unsupported `Content-Type` rejected | `POST` JSON endpoint with `Content-Type: text/plain` or missing | 415 Unsupported Media Type (or 400) — not 500. (OWASP: reject unexpected content type.) | medium |
| LA-API-05 | **Malformed input → 4xx, never 5xx** | For each body/param: send wrong type, oversized, missing-required, junk JSON, huge payload | 400 (or 413 for oversized); **a 500 here is a finding** (validation gap / unhandled throw). `[ASVS 5.1.3]` | high |
| LA-API-06 | Error responses are **structured JSON**, not HTML/stack | Trigger the LA-API-05 errors; inspect body & content-type | `application/json` error object; **no HTML error page, no stack trace** | high |
| LA-API-07 | No stack-trace / secret / internal-path leakage in any error body | Inspect all error bodies for `at Object.<anonymous>`, file paths, SQL text, env values, library versions | None present (generic message only). `[ASVS 7.4.1, 14.3.x]` | high |
| LA-API-08 | State-changing requests verify Origin/CSRF | `POST` a mutation with foreign/blank `Origin` & no CSRF token | Rejected (403) unless same-origin/token present. (Server Actions / cookie-auth APIs.) `[ASVS 14.5.x]` | high |
| LA-API-09 | CORS `Access-Control-Allow-Origin` is not wildcard-with-credentials | Send `Origin: https://evil.com`; read `ACAO` + `Access-Control-Allow-Credentials` | **Not** `ACAO: *` together with `ACAC: true`; reflected origins are allowlisted, not echoed blindly. (OWASP REST.) | high |
| LA-API-10 | CORS preflight is scoped | `OPTIONS` with `Access-Control-Request-Method` | Allowed methods/headers are a tight allowlist, not `*` for a credentialed API | medium |
| LA-API-11 | Rate limiting on auth & abuse-prone endpoints | Burst requests to login/reset/expensive endpoints | 429 after threshold (also LA-MW-06). `[A04]` | medium |
| LA-API-12 | Auth enforced on every API (no "forgot to guard one") | Cross-reference block 3 results across **all** discovered API routes, not a sample | Every protected route enforces 401/403 cross-role; zero unguarded protected routes | critical |
| LA-API-13 | Sensitive data not returned to under-privileged callers (DTO discipline) | As USER, inspect responses for over-fetching (password hashes, other users' PII, internal flags) | Responses contain only caller-appropriate fields (DTO/least-data). `[A01 / Next.js DTO guidance]` | high |
| LA-API-14 | No credentials/secrets accepted or echoed in URL/query | Check that auth tokens/keys are required in header/body, and never reflected in responses or redirects | Creds in headers/body only; never in query string or response body. `[ASVS 8.3.x]` | medium |

---

## 7. Secrets / exposure — .env, source maps, public keys, NEXT_PUBLIC misuse

| ID | What it verifies | How to test (LIVE + REPO) | Pass criteria | Severity |
|---|---|---|---|---|
| LA-SEC-01 | `.env` / env files are not web-served | LIVE: `GET /.env`, `/.env.local`, `/.env.production`, `/config.json`, `/.git/config` | 404 for all; no env contents returned | critical |
| LA-SEC-02 | Source maps not exposed in production | LIVE: for each `*.js` bundle, request `<bundle>.js.map`; also check DevTools Sources for original filenames. REPO: `productionBrowserSourceMaps` not enabled for prod; build doesn't ship `.map`. | `.map` requests 404 in production (or maps are access-controlled). | high |
| LA-SEC-03 | No secrets embedded in client JS | LIVE: fetch client bundles; regex-scan for `sk_live`, `sk_test`, AWS `AKIA`, `-----BEGIN ... PRIVATE KEY-----`, `Bearer <jwt>`, OpenRouter/Anthropic/Stripe key shapes, DB connection strings. | No private/server secret patterns in any client-delivered asset | critical |
| LA-SEC-04 | `NEXT_PUBLIC_*` holds only non-secrets | REPO: enumerate `NEXT_PUBLIC_` vars; flag any whose name/value implies a server secret (`*_SECRET`, `*_PRIVATE`, service-role keys, DB URLs). | Every `NEXT_PUBLIC_*` is safe-to-publish (publishable keys, public URLs only). `[A05/A02]` | critical |
| LA-SEC-05 | Server-only secrets are not imported into client components | REPO: grep `process.env.<SECRET>` referenced in files that are client (`'use client'`) or in the browser bundle. | Server secrets only referenced in server code (RSC/route handlers/server actions) | high |
| LA-SEC-06 | No secrets committed to the repo | REPO: scan tracked files for key patterns + committed `.env*` not gitignored; check `git ls-files` for env files. | No secret-bearing files tracked; `.env*` gitignored. | high |
| LA-SEC-07 | No secrets in logs / error output | LIVE+REPO: confirm LA-API-07 (no secrets in error bodies); grep `console.log(process.env`, logging of tokens/headers. | No secret values logged or returned. `[ASVS 8.3.x]` | medium |
| LA-SEC-08 | Backup/temp/source artifacts not served | LIVE: `GET /index.js.bak`, `/.DS_Store`, `/server.zip`, `/package.json`, `/Dockerfile`, `/.git/HEAD` | 404 for sensitive artifacts; no repo internals served. (OWASP A01: remove backup files from web roots.) | medium |
| LA-SEC-09 | Directory listing disabled | LIVE: `GET /uploads/`, `/static/`, `/_next/` style dirs | No autoindex / file listing returned | medium |
| LA-SEC-10 | Public API keys are domain/scope-restricted (advisory) | REPO/notes: publishable keys (maps, analytics, Clerk pub key) flagged for referrer/domain restriction | Publishable keys present are scoped where the provider supports it (advisory, not a hard fail) | low |

---

## 8. Authn / session / transport (supporting OWASP A02 / A07)

These back the Top-10 rows and ASVS V2/V3/V9. Mostly cookie/session assertions the runner
can read directly.

| ID | What it verifies | How to test (LIVE + REPO) | Pass criteria | Severity |
|---|---|---|---|---|
| LA-AUTH-02 | Password policy enforced server-side | REPO: signup/reset validates min length (≥8) + complexity (Zod/Yup schema). LIVE: submit weak password → rejected. | Weak passwords rejected by server validation. `[ASVS 2.1.x]` | medium |
| LA-AUTH-03 | Session cookie flags correct | LIVE: read `Set-Cookie` on login | `HttpOnly`, `Secure`, `SameSite=Lax|Strict` all present on the session cookie. `[ASVS 3.4.x]` | high |
| LA-AUTH-04 | Session token is opaque/random, not guessable PII | LIVE: inspect cookie value | Not a plain user id/email; signed/encrypted token. `[ASVS 3.2.1]` | medium |
| LA-AUTH-05 | Logout invalidates the session server-side | LIVE: capture session → logout → replay the old cookie on a protected route | Old session no longer authorized (401/redirect). `[ASVS 3.3.1]` | high |
| LA-AUTH-06 | No credentials/tokens in URL | LIVE: inspect login/reset/SSO flows for tokens in query string | Tokens delivered via POST body/headers, not URL (URLs hit logs/referrers). `[ASVS 8.3.x]` | medium |
| LA-AUTH-07 | Auth check never 500s (fails closed) | LIVE: malformed/expired/blank token on protected routes | 401/redirect, never 500 (mirrors LA-AC-11 / LA-MW-12) | high |

---

## 9. Runner implementation notes (so checks stay honest & non-destructive)

- **Three captured states.** The runner stores `ANON` (none), `USER`, `ADMIN` browser/storage
  states locally (never pastes prod creds into the web app — PRD auth contract). Every block-3/4
  assertion is "same request, different state, compare."
- **Discovery feeds the matrix.** Page routes from route files + crawl; API routes + privileged
  mutations from handler/AST scan. The cross product is generated per discovered surface, so the
  matrix scales to the app.
- **Non-destructive by default.** Injection (LA-INJ-01), SSRF (LA-SSRF-01), and mutation
  (LA-AC-12..19) checks assert on **response shape** and use canary/read-or-reversible payloads.
  Destructive verbs against real data run only with explicit opt-in (align with `careful` mode).
  For mutation-authorization, prefer a throwaway target object or assert the 403 *before* any write.
- **Repo signal localizes, never replaces.** A live fail + repo match → repair packet with
  `likely_files` (e.g. the unguarded route handler, the layout-only auth, the `NEXT_PUBLIC_` leak).
  A repo smell with no live confirmation → `advisory` / `needs-input`, surfaced honestly, not failed.
- **Evidence per check.** Each executed assertion stores: request (method/URL/role/headers sent),
  response (status, key headers, redacted body excerpt), and a screenshot for page-level checks —
  matching the `artifacts` contract. Redact secrets in stored bodies.
- **Severity → readiness score.** `critical` fails gate the 80→100 score hardest; the
  "what's left to hit 100%" list is the set of open `critical`/`high` findings.
- **2025 forward-compat.** When OWASP Top 10:2025 is final, re-tag rows (BAC stays #1; SSRF folds
  into BAC; a likely new "Mishandling of Exceptional Conditions" maps to LA-API-05/06/07 and
  LA-MW-12). No check is invalidated by the renumbering.

---

## Sources

Authoritative references used to build this catalog:

- OWASP Top 10:2021 — overview & A01 Broken Access Control:
  https://owasp.org/Top10/2021/ · https://owasp.org/Top10/2021/A01_2021-Broken_Access_Control/
- OWASP Top Ten project (list + 2025 status):
  https://owasp.org/www-project-top-ten/
- OWASP Authorization Cheat Sheet (deny-by-default, server-side, IDOR ownership, no client-side reliance):
  https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- OWASP REST Security Cheat Sheet (status codes, input validation, error handling, CORS, methods, headers):
  https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- OWASP Secure Headers Project (exact recommended header values + headers to remove):
  https://owasp.org/www-project-secure-headers/
- OWASP ASVS 4.0.3 (Application Security Verification Standard):
  https://owasp.org/www-project-application-security-verification-standard/ ·
  https://github.com/OWASP/ASVS
- OWASP WSTG — Review Web Page Content for Information Leakage:
  https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/01-Information_Gathering/05-Review_Web_Page_Content_for_Information_Leakage
- Next.js Authentication guide (DAL > middleware, Server Actions = public endpoints, optimistic vs
  secure checks, layout partial-rendering trap, DTO discipline):
  https://nextjs.org/docs/app/guides/authentication
- Clerk RBAC guide (clerkMiddleware + createRouteMatcher necessary-not-sufficient; per-handler
  `auth()`/`has({role})`; roles in publicMetadata; audit grep signals):
  https://clerk.com/docs/guides/secure/basic-rbac
- CVE-2025-29927 — Next.js middleware authorization bypass via `x-middleware-subrequest`
  (test vectors, patched-version floors 12.3.5 / 13.5.9 / 14.2.25 / 15.2.3, edge-strip mitigation):
  https://nvd.nist.gov/vuln/detail/CVE-2025-29927 ·
  https://securitylabs.datadoghq.com/articles/nextjs-middleware-auth-bypass/ ·
  https://projectdiscovery.io/blog/nextjs-middleware-authorization-bypass
- Source map / secrets exposure (detection of `.js.map`, `.env`, embedded keys):
  https://blog.sentry.security/abusing-exposed-sourcemaps/
