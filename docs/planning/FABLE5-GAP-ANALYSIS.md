# 80/20 Launch Audit — Fable 5 Gap Analysis & Action Plan

> Date: 2026-07-02. Method: read the engine (not the roadmaps) — 4 parallel
> subsystem explorers over crawler/scanner, watchdog/verify spine, delivery/MCP,
> and eval/CI, cross-checked against `classify.ts`, `audit.ts`, `card-generator.ts`
> and the two existing Opus roadmaps (`BEST-IN-CLASS-ROADMAP.md`,
> `COMPETITIVE-EDGE-4-MOVES.md`). Every finding cites a file:line verified this session.

---

## The reframe (why this list is different from the two existing roadmaps)

Opus already produced 20 "best-in-class" moves and 4 "competitive-edge" moves. Read
them again: **both chase BREADTH — more detectors, more categories, more standards
coverage.** They take the engine's four foundations as solid and optimize the
superstructure on top.

This analysis went underneath that assumption and read the foundations themselves.
**All four are cracked in ways neither roadmap audits** — because auditing them
requires questioning the premises baked into the engine, not extending its surface:

| Foundation | Roadmap assumption | What the code actually does |
|---|---|---|
| **Surface** (what gets tested) | "the crawl finds the app" | homepage-only, ≤10 links, tests 6; blind to Vite/React SPA, Svelte, tRPC, GraphQL |
| **Verification** (the moat) | "Watchdog + Truth Protocol are already on the right side of this" (COMPETITIVE-EDGE l.6) | watchdog skips ALL browser cards; no `pass^k`; score is ±3–5% non-reproducible |
| **Proof** (catch-rate) | "catches all 5, verified end-to-end" (README l.125) | no CI gate proves it; the 5 detectors that catch the 5 bugs have ZERO tests |
| **Loop closure** (find→fix) | "one audit → one round of fixes → deploy" (GAP-ANALYSIS l.3) | no fix tool, no SARIF, no PR-gate; `--reverify` is CLI-only |

**The single most important sentence in this document:** you can build all 24 remaining
roadmap detectors and the tool will still only ever look at 6 pages, still can't prove
its own honesty claim run-to-run, and still can't prove it catches what it says it
catches. Breadth is the wrong axis until the foundation holds. Fix the foundation and
every existing detector — and every future one — gets more valuable for free.

The engine itself is genuinely strong: `classify.ts` is the most honest failure
classifier I've seen in this class of tool, the wedge (RBAC/IDOR/write-authz/server-guard)
is real and defensible, and the deterministic no-LLM design is the right call. This is
not a teardown. It's the load-bearing repair list the breadth-first planning skipped.

---

## FINDING 1 — The crawler is homepage-only. Every detector is surface-starved. `[CRITICAL]`

**Evidence:** `runner/crawler.ts:61-71` extracts `a[href]` from the homepage only, caps
at 10 links; `src/lib/generators/frontend.ts:22-25` then tests the first 6 (`.slice(0,6)`).
No recursion, no auth session during crawl, no XHR/fetch capture for route discovery.

**Why it's the #1 gap:**
- A Next.js/React SPA with `/dashboard`, `/dashboard/users`, `/dashboard/users/[id]`
  surfaces **zero** of them from the crawl — they aren't `href`-linked on the homepage.
- SaaS apps that redirect `/` → `/login` give the crawler the *login page's* links. The
  entire authenticated surface — where the wedge lives — is dark (`crawler.ts:22-97`, no
  session).
- Dynamic segments are always sampled as literal `"42"` (`repo-scanner.ts:300-304`), so
  `/products/[id]` → `/products/42`, 404s on a real store, and the positive-control RBAC
  test (`/admin/users/42`) fails *because the record doesn't exist*, not because of a bug.
- API routes hardcoded in a React hook (`fetch('/api/current-user')`) are invisible:
  network traffic is recorded for debugging but **never mined for route discovery**
  (`execute-core.ts`).

**This caps the value of all 24 current detectors and all 20 roadmap detectors.** It is
the binding constraint on the whole product.

---

## FINDING 2 — The repo scanner is framework-blind to your own stack. `[CRITICAL]`

**Evidence:** `runner/repo-scanner.ts:177-195`. Route discovery handles Next.js
App/Pages Router and flat Express `/api/` well. It is blind or near-blind to:
- **Vite + React Router SPA** — routes live in JS/router config, not a file convention.
  *This is FDC's own internal-tool default stack (per CLAUDE.md build doctrine).* Rob's
  own dashboards audit at 0–30% coverage.
- **Svelte Kit** (cursory), **Nuxt/Vue** (misclassified as generic Node), **tRPC**
  (assumed at `/api/trpc` by name), **GraphQL** (no introspection), **Flask/Django/Rails**
  (fail silently — non-Node).
- **Privilege detection is URL-substring-only** (`repo-scanner.ts:343-345`:
  `/(^|\/)(admin|superadmin|internal)(\/|$)/`). A generically-named privileged route
  (`/api/workspace/invite`, `/settings`, `/api/users/me`) is marked public → **no RBAC
  test is generated** → the wedge never fires on it.
- Caps: 4,000-file walk (`repo-scanner.ts:44`) and 250-route extraction
  (`repo-scanner.ts:297,384`), both first-come-first-served with **no privilege
  prioritization** — a Turbo monorepo's `apps/admin/*` can be truncated away entirely.

---

## FINDING 3 — The Truth Protocol is partially fictional. The moat's foundation leaks. `[CRITICAL]`

This is the one that should sting, because honesty *is* the product.

- **Browser cards bypass the watchdog entirely.** `audit.ts:200-216` runs the watchdog
  only over `passedNoBrowser`. Accessibility, performance, responsive, and FE-interaction
  passes are re-verified by nothing but the executor's 3-attempt retry
  (`execute-core.ts:463-484`). The COMPETITIVE-EDGE doc's claim that the Watchdog is
  "already on the right side of" the verification-gap problem is **only half-true** — it
  covers HTTP, not the browser half.
- **`pass^k` is not built.** The watchdog re-runs a passed check exactly **once**
  (`watchdog.ts:49-63`). COMPETITIVE-EDGE Move 3 treats consistency scoring as a
  net-new idea to add; my read confirms it does not exist yet. A check that is authorized
  7/8 times and open 1/8 is reported as a clean pass — the single most dangerous
  authorization failure mode is invisible.
- **The readiness score is non-reproducible ±3–5% run-to-run.** Browser timing, network
  arrival order, and font-render viewport measurement all feed pass/fail with no
  consistency gate. "A number" is sold as "a verified number"; it isn't yet reproducible.
- **The denominator conflates "attempted" with "verified," and counts tooling failures
  against the app.** `audit.ts:235` folds `test_bug` into `productBugs`; `audit.ts:239`
  puts that in `executedDenom`. So when the OSV.dev lookup blips (network), the app's
  readiness score **drops** and a "failure" is rendered — a tooling problem lowering the
  customer's grade. That is a Truth-Protocol violation in the scorer itself.
- `devStubAuth` detection is a hardcoded env-name list (`audit.ts:~219`:
  `DEV_ORG_ID, SUPERADMIN_DEV, AUTH_BYPASS, SKIP_AUTH, NEXT_PUBLIC_DEV`). A project that
  names its bypass `DEV_MODE`/`BYPASS_AUTHZ` gets its stubbed-auth exposure **over-claimed
  as a confirmed product bug**.

---

## FINDING 4 — The catch-rate claim is unverified, and the load-bearing detectors are untested. `[CRITICAL]`

**Evidence:** README l.125 asserts "catches all 5 (verified end-to-end)."
`.github/workflows/ci.yml:10-28` runs only `npm test` + `npm audit`. There is **no CI
step that runs the audit against `fixtures/buggy-shop` and asserts 5/5 caught + 0 false
positives on `shop-fixed`.** The proof is a manual procedure in CONTRIBUTING.md that CI
never runs.

Worse: **17 of 34 generators have no test file**, and the five that catch the five
planted bugs — `frontend.ts`, `backend.ts`, `middleware.ts`, `security.ts`,
`accessibility.ts` — are all in the untested set. A regression that makes `middleware.ts`
stop checking `X-Frame-Options` ships green today. The mutation harness (Move 4) and the
locked eval corpus (Move 12) are roadmap prose, not code.

---

## FINDING 5 — Findings become a pretty report, not an actioned, re-verified fix. `[HIGH]`

**Evidence:** `render-report.ts` emits HTML + JSON only — **no SARIF 2.1.0**, so findings
never reach GitHub code-scanning, PR annotations, or IDEs. The MCP surface
(`runner/mcp-server.ts`, 10 tools) is audit-complete but has **no fix-application tool and
no MCP-exposed re-verify** — `--reverify` exists but only as a CLI flag (`audit.ts:187`).
There is **no GitHub Action / PR-gate** (only `ci.yml` for the repo's own tests) and **no
`init` wizard / hints auto-derivation tool**. Since the wedge only fires at L2 when a
hints file exists (`conductor-playbook.md:38-68`), and most users never hand-author one,
**the best checks in the product never run for most users.**

---

## FINDING 6 — The conductor is the reasoning layer, and it's under-exploited. `[HIGH — and uniquely a Fable-as-orchestrator move]`

The architecture is deliberate and smart: the engine makes zero LLM calls; the host model
is Thinker + Verifier + Synthesizer (`conductor-playbook.md:9-21`). But two capabilities
are left on the table:

- `database.ts:20-48` and `mcp-server.ts` run **one** HTTP check each, then declare the
  interesting checks — RLS, connection pooling, migration status, backups, destructive-tool
  gating — **BLOCKED** with "go connect the Supabase/PlanetScale MCP and inspect."** But
  the host agent frequently *already has* the Neon/Supabase MCP connected this session. The
  conductor should *run* those checks through the connected MCP and return a verified
  verdict, not punt them to a human. Turning BLOCKED-with-guidance into
  verified-via-your-MCP is a capability the deterministic engine structurally cannot have —
  it only exists at the orchestrator layer.
- The playbook's triage/depth-ladder (L0→L3) is prose the agent follows by hand; there's
  no root-cause clustering or auto-escalation primitive the conductor can lean on.

---

# BUILD STATUS (2026-07-02, Fable 5)

The P0 foundation was executed and verified this session. Proof commands: `npm test`
(193 pass), `npm run test:fixtures` (recall 5/5 + 100/100 + 0 FP), `npm run test:mutation`
(8/8 kill-rate). Details per item below.

- **A0-1 — recursive auth-aware crawl** — DONE. `runner/crawler.ts` rewritten to a bounded
  BFS (depth-2, budget-capped) that follows links, re-crawls behind a captured login session,
  mines fetch/XHR for client-only API routes, and harvests real record ids to replace the
  `/42` placeholder. Verified on buggy-shop (`+3 pages behind login`, real id `/admin/users/1`).
- **A0-3 — pass^k consistency** — DONE (no-browser wedge). `runner/watchdog.ts` re-runs each
  no-browser pass k× (default 3); a pass counts only if it holds every time, and an intermittent
  *authorization* pass ("held 2/3") is raised as a loud product-bug the Launch Gate fails on.
  Unit-tested (`runner/watchdog.test.ts`). Boundary: browser cards still rely on the executor's
  3-attempt retry (re-running them k× would triple runtime) — a smaller follow-up.
- **A0-4 — scorer honesty + legit 100/100 clean fixture** — DONE. `test_bug` and `blocked` are
  excluded from the readiness denominator (tooling hiccups / couldn't-run ≠ app-not-ready),
  surfaced separately; the Launch Gate reports blocked-wedge coverage gaps so the score can't be
  gamed. `fixtures/shop-fixed` made genuinely launch-ready (strict CSP, COOP/CORP, full SEO +
  JSON-LD, `.gitignore`) → **legitimate 100/100, 0 false positives**. CLAUDE.md scoring + the
  CONTRIBUTING "100/100" claim corrected to the honest criterion.
- **A0-5 — CI fixture gate + mutation harness** — DONE. `scripts/test-fixtures.ts` asserts
  recall 5/5 + gate-fails on buggy-shop and 100/100 + 0 FP + gate-passes on shop-fixed;
  `scripts/mutation-test.ts` re-breaks the clean fixture per detector (8/8 caught). Both wired
  into `.github/workflows/ci.yml` (new `fixtures` job) + `package.json`.
- **A0-6 — detector unit tests** — DONE. 14 new `*.test.ts` for previously-untested generators
  (frontend, backend, middleware, security, accessibility, cookie-security, cors, injection,
  mass-assignment, mutation-authz, object-authz, tls-hsts, database, mcp-server). 146 → 193 tests.
- **A0-2 — framework route discovery (Vite/React Router, SvelteKit, tRPC)** — DONE.
  `runner/repo-scanner.ts` now parses React Router (JSX `<Route>` trees + `createBrowserRouter`/
  `useRoutes` object form), SvelteKit (`+page.svelte`/`+server.ts` → routes, sibling
  `+page.server.ts` guard detection), and tRPC mounts; privilege detection reads the route's
  source for auth guards (`requireAuth`/`getServerSession`/`role === 'admin'`/guard components),
  not just the URL; truncation keeps privileged routes first. 193 → 205 tests. Honest limit:
  string-scanner, not an AST — routes built by string-concat or config-from-JSON aren't traced.

P1/P2 (two-identity metamorphic authz, MCP-assisted DB checks, fix-loop/SARIF/PR-gate/init
wizard) remain as the next tranche.

---

# ACTION PLAN

Priority = leverage on the actual product. Effort is honest (S/M/L). Every item preserves
the framework: no build step, no TS enums/namespaces, no paid dep, no hosted backend, no
finding we can't prove — and follows the detector pattern in CLAUDE.md.

## P0 — Foundation repairs (the cracks in the moat; do before any new detector)

**A0-1 · Recursive, auth-aware, traffic-mining crawl.** `[Effort: L]` `[Files: crawler.ts,
execute-core.ts, card-generator.ts]`
Replace homepage-only with a bounded BFS (depth 3, budget/time caps like the SCA walk
already has): (a) follow in-page links; (b) crawl **with the captured auth session** so
the authenticated surface is reached; (c) **merge** repo-scanner routes with crawl-found
routes; (d) **harvest real object IDs** from JSON responses to replace the `/42`
placeholder (fixes the false-404 that breaks positive-control RBAC); (e) **mine recorded
XHR/fetch** for hardcoded API routes. *This one change uncaps every existing and future
detector.* Highest leverage on the entire list.

**A0-2 · Multi-framework route discovery (Vite/React Router, Svelte, tRPC, GraphQL).**
`[Effort: M]` `[Files: repo-scanner.ts]`
Add parsers for the frameworks the scanner is blind to — starting with **Vite + React
Router, FDC's own internal-tool stack.** Add metadata/decorator privilege detection so
generically-named privileged routes get RBAC cards. Make the 4k-file / 250-route caps
**privilege-prioritized** so admin surfaces are never the truncated ones.

**A0-3 · `pass^k` consistency scoring + browser-card watchdog.** `[Effort: M]`
`[Files: watchdog.ts, execute-core.ts, verdict.ts, classify.ts]`
Re-run each pass k times under **fixed conditions** (same build/seed/network so reported
variance is the app's, not the harness's); pass only if all k pass. Extend the watchdog to
cover browser cards, not just no-browser. Add an **"intermittent authorization"**
high-severity class that reports the hit rate ("authorized 7/8, exposed 1/8") — turns
flakiness from a footnote into the scariest finding nobody else reports. Makes the 0–100
score reproducible. (This is Move 3 — but the investigation proves it's *unbuilt*, so it's
P0, not a nice-to-have.)

**A0-4 · Fix the scorer's own honesty bugs.** `[Effort: S]` `[Files: audit.ts, classify.ts]`
Remove `test_bug` from the readiness denominator (`audit.ts:235,239`) — a tooling failure
must not lower the app's grade or render as a product failure. Split the numerator so the
score is `verified_passes / attempted`, not `passes / attempted`. Make `devStubAuth`
detection configurable / inferred from the login probe instead of a hardcoded env-name
allowlist (`audit.ts:~219`).

**A0-5 · CI fixture gate + per-detector mutation kill-rate.** `[Effort: M]`
`[Files: scripts/, .github/workflows/ci.yml]`
`npm run test:fixtures`: boot buggy-shop, run the full audit, assert **5/5 caught + 0 false
positives on shop-fixed + deterministic score**, fail CI on any miss. Then the mutation
harness (Move 4): programmatically re-break `shop-fixed` per detector, measure kill-rate,
fail CI on regression, publish the number. This makes README l.125 *true* and gives you the
defensible metric competitors can't fake.

**A0-6 · Unit tests for the 5 load-bearing detectors.** `[Effort: S–M]`
`[Files: frontend/backend/middleware/security/accessibility .test.ts]`
These catch the five planted bugs and have zero tests. Cover them first, then work down the
remaining 12 untested generators (prioritize object-authz, mutation-authz, cors — the wedge).

## P1 — Sharpen the moat + exploit the conductor (Fable's real edge)

**A1-1 · Two-identity metamorphic authorization sequencing.** `[Effort: M]`
`[Files: object-authz.ts, write-authz.ts, admin-rbac.ts, executor.ts, execute-core.ts,
classify.ts]`
Implement the RESTler/SMRL named recipes as a dependency-aware sequence: create-as-admin →
read/update/delete-as-user → reach-after-DELETE → reach-under-wrong-parent. The metamorphic
rule needs no oracle: *a lower-privilege response must never contain more than a
higher-privilege one; stripping auth must never grow the response.* This is Move 1 — the
wedge made deeper, and the thing StackHawk can only do wire-only + spec-dependent.

**A1-2 · MCP-assisted "invisible" checks (turn BLOCKED into verified).** `[Effort: M]`
`[Files: conductor-playbook.md, database.ts, mcp-server.ts, SKILL.md]`
When the session has a Neon/Supabase/Postgres MCP connected, the conductor runs the RLS /
pooling / migration / backup / destructive-tool checks that `database.ts` and
`mcp-server.ts` currently declare BLOCKED — and returns a verified verdict. This capability
lives only at the orchestrator layer; the deterministic engine structurally cannot have it.
Uniquely a Fable-as-conductor move.

**A1-3 · Close the loop: fix-apply + MCP re-verify + triage memory.** `[Effort: M]`
`[Files: mcp-server.ts, audit.ts, verdict.ts]`
Expose `--reverify` as an MCP tool; add a conductor find→fix→re-verify loop so a confirmed
bug becomes a proven-fixed pass with evidence, not just a report line. Add the compounding
triage memory (Move 2): a pattern-keyed accept store so "this admin route is meant to be
public" is remembered across re-audits and sibling repos — never silencing a *confirmed*
security/authz bug without a logged override.

## P2 — Distribution (turn a great engine into an adopted product)

**A2-1 · SARIF 2.1.0 output + GitHub Action PR-gate.** `[Effort: M]`
`[Files: render-report.ts, new .github/action]`
Emit SARIF so findings land as PR annotations / code-scanning; ship a reusable Action that
runs the audit on a PR, posts the Launch Gate PASS/FAIL as a status check, and fails the
build on a confirmed security/authz bug. `launchGate()` already computes the verdict
(`render-report.ts:39-64`) — this is serialization + packaging, not new logic.

**A2-2 · `launchaudit init` wizard + hints auto-derivation MCP tool.** `[Effort: M]`
`[Files: mcp-server.ts, new init flow]`
Scan the repo, crawl the app, and **auto-propose** the hints file (protected routes/APIs,
login path, role capture) so the wedge fires with zero hand-authoring. Biggest single
adoption unlock: today, no hints → no L2 → the best checks never run.

---

## Suggested sequence
1. **A0-1 + A0-2** (surface) — uncaps everything else; nothing downstream is worth more.
2. **A0-3 + A0-4** (verification) — make the honesty claim mechanically true before adding surface.
3. **A0-5 + A0-6** (proof) — lock the catch-rate so the above can't silently regress.
4. **A1-1 → A1-3** (wedge + conductor) — deepen the moat and close the loop.
5. **A2-1 + A2-2** (distribution) — make it adoptable.

## What NOT to do (defend the moat)
No new breadth detector ships until A0-1/A0-2 land — a detector that sees 6 pages is worth
6 pages of coverage no matter how good it is. No hosted backend, no external model calls, no
paid dep. Keep the whole pitch: free + local + in-the-agent + authorization-depth + provable
honesty.
