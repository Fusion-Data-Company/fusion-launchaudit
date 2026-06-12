# LaunchAudit — Gap Analysis & Expansion Plan

> Goal: be provably **deeper and more honest than TestSprite** so one audit → one round of fixes → deploy → hand to client at 100%.
> Date: 2026-06-12. Inputs: this repo's 4 generators + `competitor-coverage.md`, `security-standards.md`, `quality-standards.md`, `agentic-testing-state-of-art.md`.

## 1. Verified baseline — what we test TODAY

Four generators (`src/lib/generators/`), now repo-aware after wiring the scan into generation:

| Generator | Checks it emits | Depth |
|---|---|---|
| `frontend.ts` | app-shell render, page reachability, responsive overflow (390/768), console+5xx clean | shallow (TestSprite parity) |
| `backend.ts` | malformed-input → not-5xx + no stack-trace leak; GET API responds | medium |
| `admin-rbac.ts` | anon blocked from admin route/API; (+ user/admin if creds) | **the differentiator** |
| `middleware.ts` | 3 security headers present; HSTS | partial |

**Proven impact of the scan→generator wiring (this session):** Quarry went 10 → **35 checks**; caught 11 admin-anon-access exposures + a backend 500 + missing CSP that the baseline missed entirely.

## 2. The market white space (from `competitor-coverage.md`)

No functional-QA competitor (TestSprite, Mabl, QA Wolf, Momentic, Ranger, Reflect, Autify, Checkly…) tests **authorization**. Confirmed empty columns across 23 tools:
1. RBAC multi-role matrix (anon/user/admin × allow/deny)
2. Admin-panel auditing (session-recording tools are structurally blind — admins never appear in recorded user flows)
3. Server-side authz vs UI-hidden-only (the Clerk "admin access granted but never checks role" class)
4. IDOR / BOLA (owned only by security scanners that do no functional QA)
5. Security headers + middleware correctness
6. Honest "blocked / needs-human" + provenance-grade evidence (the trust wedge)

**LaunchAudit's lane:** self-serve, pre-launch, repo-aware, and the *only* tool auditing RBAC/admin/server-authz/IDOR with evidenced results.

## 3. Coverage matrix — families × status

Legend: ✅ have · 🟡 partial · ❌ missing

| Check family | Status | Source catalog | Notes |
|---|---|---|---|
| App load / page reachability / responsive | ✅ | quality | keep |
| Console + 5xx on load | 🟡 | quality | add pageerror, requestfailed, mixed-content, 404 assets, broken images, hydration |
| Malformed input → not-5xx, no stack leak | ✅ | security | extend to all methods (not just POST) |
| **Security headers (full set + correct values)** | 🟡 | security | have 3 present-checks; need CSP value quality, Referrer-Policy, Permissions-Policy, COOP/COEP/CORP, HSTS preload, banner removal |
| **RBAC: anon blocked (route + API)** | ✅ | security | proven on Quarry |
| **RBAC: user-denied / admin-allowed (positive+negative)** | 🟡 | security | needs captured creds (hints) |
| **RBAC: privileged mutation → verify NO state change** | ❌ | security | LA-AC matrix: assert 403 *and* re-read shows no change |
| **IDOR / object-id swap** | ❌ | security | user A cannot read/edit user B's object by id |
| **Secrets / exposure** | ❌ | security | served `.env`, source maps, `NEXT_PUBLIC_*_SECRET`, secrets in client bundle, dir listing |
| **Middleware bypass (CVE-2025-29927)** | ❌ | security | `x-middleware-subrequest` header bypass, version floors |
| Auth / session / transport | ❌ | security | cookie flags (HttpOnly/Secure/SameSite), logout invalidation, no creds in URL |
| API hygiene depth | 🟡 | security | status-code correctness, error shape (JSON not stack), CORS wildcard+credentials, method allowlist, rate limiting |
| **Accessibility (axe-core, WCAG 2.2 AA)** | ❌ | quality | 18 checks; one `axe.run` powers ~13 |
| **Performance (Core Web Vitals / Lighthouse)** | ❌ | quality | LCP/INP/CLS + TBT, render-blocking, image sizing, fonts — mark "lab estimate, single run" |
| **SEO + structured data** | ❌ | quality | title/meta/canonical/robots/sitemap, OG, Schema.org JSON-LD validity, broken links |
| **Failure classification + retry + self-healing** | ❌ | agentic | product_bug / test_bug / flaky / needs_input with confidence + evidence; fixes the TC-FE-001 false-fail |
| **Dev-stub-auth context awareness** | ❌ | (this session) | when auditing a dev server with bypassed auth, RBAC fails → "verify against real auth", not "critical" |
| Self-improvement eval loop | ❌ | agentic | `launchaudit-evals/` locked corpus + scored gates |

## 4. Prioritized build order

**P0 — trust + cheap high-signal, no creds needed**
1. **Failure classification + bounded retry + evidence bundle** (`runner/classify.ts`). Deterministic shortcuts first (blocked-leak → product_bug; flake on retry → flaky). Confidence-tagged, never ground truth (OOPSLA 2025: best classifier ~67.5% F1 — stay humble). Fixes the TC-FE-001 false-fail class.
2. **Security headers (full) + secrets/exposure** generators. No creds, no state change, high signal.
3. **Dev-stub-auth detector** → reclassify RBAC fails as `needs_verification` when auth is bypassed.

**P0 — the moat**
4. **RBAC role matrix + IDOR + privileged-mutation state-verify** (extend `admin-rbac.ts`). The #1 market white space.

**P1 — depth + parity**
5. **axe-core accessibility** generator (add `axe-core` dep).
6. **Core Web Vitals / perf** generator (lab-estimate honesty).
7. **SEO / schema** generator.
8. **API hygiene depth** (CORS, methods, rate limit, error shape) + **middleware CVE-2025-29927** + **auth/session/transport**.
9. **Correctness depth** (broken images, mixed content, 404 assets, hydration) into `frontend.ts`.

**P2 — compounding**
10. **Self-improvement loop** — `launchaudit-evals/` locked fixture corpus + binary scorer; scheduled Claude Code job proposes ONE generator/skill at a time, gated behind eval deltas (recall↑ AND false-positive↛↑, pass^k stable), branch-isolated, human-approved before a skill goes live. Self-healing locators via the accessibility tree.

## 5. Truth-Protocol notes baked into the design
- Core Web Vitals from a headless single run = **lab estimate**, never a field/CrUX pass.
- Presence-only checks (alt text, meta tags) stay out of `blocker` severity — automation can't judge meaningfulness (axe catches ~57%).
- RBAC failures on a dev/stub-auth environment are **needs_verification**, not critical.
- Every status comes from a real browser/HTTP run with an evidence artifact; blocked/needs-input are first-class, never silently passed.
