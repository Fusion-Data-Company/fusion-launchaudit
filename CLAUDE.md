# 80/20 Launch Audit — agent orientation

80/20 Launch Audit (technical id: `launchaudit`) is a deep, automated launch-readiness
auditor for web apps. It drives a real Chromium browser + direct HTTP checks against a
running app, classifies every finding for honesty, and produces a 0–100 readiness report.
It runs locally inside the developer's own coding agent — Claude Code, Cursor, or Codex
(MCP + skill) — no API key, no hosted backend required. The wedge competitors don't cover:
**authorization depth** (admin/RBAC, write-authz, server-side guards) plus breadth (a11y,
perf, SEO, security headers, content integrity, ElevenLabs voice agents).

> Brand: the public display name is **"80/20 Launch Audit."** The code identifier, MCP
> server name, npm scripts, file paths, and the `launchaudit` command stay lowercase
> `launchaudit` — do not rename those.

## Stack
- Node 22.6+ with `--experimental-strip-types` (TypeScript, no build step for the runner).
- Playwright (Chromium) for browser cards; `fetch` for HTTP cards.
- MCP SDK (`runner/mcp-server.ts`), esbuild (bundles `server/api-src/*` → `api/*` for the optional dashboard).
- Optional dashboard: plain HTML/CSS/JS in `public/`, optional Neon Postgres + Vercel Blob.
- Tests: `npm test` (Node's built-in `node:test`, no extra deps). CI runs `npm test` + `npm audit` on every push/PR (`.github/workflows/ci.yml`).
- Live: repo `github.com/Fusion-Data-Company/fusion-launchaudit`; dashboard + free grader at `launch-audit-platform.vercel.app`.

## How an audit runs (`runner/audit.ts`)
scan repo (`runner/repo-scanner.ts`) → detect platform (`src/lib/platform/detect.ts`) →
crawl app (`runner/crawler.ts`) → generate test cards (`src/lib/card-generator.ts`) →
execute in Chromium + HTTP (`runner/execute-core.ts`) → **watchdog re-verifies every
no-browser pass** → classify (`runner/classify.ts`) → score + render report
(`runner/render-report.ts`).

**Scoring:** `readiness = passed / (passed + product_bugs + needs_verification) * 100`
— "of the checks we could actually RUN, what fraction is launch-ready." `needs_verification`
items sit in the denominator (they ran, but are an unresolved question you must answer —
not a pass, not a scary "product bug": honest middle ground). Two things are EXCLUDED from
the denominator because they are not evidence about the app: `test_bug` (our own tooling
hiccup, e.g. OSV/network — surfaced as a "tooling" note) and `blocked` (a check we couldn't
run for lack of creds/https/lockfile — surfaced separately as coverage gaps, and any blocked
security/authz check is called out by the Launch Gate so an excluded-blocked score can't be
gamed). Bands: Green ≥80 · Yellow 50–79 · Red <50.

## Detectors (the test generators)
`src/lib/generators/*.ts` — each exports `generate<X>(scan, crawl, hints, counter)`
returning `GeneratedCard[]`. Current: frontend, backend, admin-rbac, middleware,
security, write-authz, seo, content-integrity, accessibility, performance, elevenlabs,
plus the platform check-sets (`platform-checks.ts`) and Component B (DB / MCP-server).
Execution actions live in `runner/executor.ts` (the `ExecStep` union) + are dispatched
in `runner/execute-core.ts`. Every failure is labeled by `runner/classify.ts` as
`product_bug | needs_verification | test_bug | flaky | needs_input` — never over-claim.

### To add a detector (the established pattern)
1. New generator in `src/lib/generators/<name>.ts` (category string + cards).
2. If it needs a new execution action, add it to the `ExecStep` union in
   `runner/executor.ts` and dispatch it in `runner/execute-core.ts` (add to
   `NO_BROWSER_ACTIONS` if it's pure HTTP/no-browser).
3. Add a branch in `runner/classify.ts` for the new category (bug vs verify).
4. Wire the generator into `src/lib/card-generator.ts`.
5. Add tests in a `*.test.ts` next to it; run `npm test`.
(See the content-integrity, accessibility, and performance detectors as worked examples.)

## Honesty rules already encoded (don't regress these)
- **SPA shells:** an `expectBlocked` route that returns a 200 client-rendered shell
  (same skeleton as the homepage / empty mount node) is downgraded to
  `needs_verification`, NOT a critical "exposed admin" — HTTP can't prove a client-gated
  route is exposed; the API is the real gate (tested separately). See `isClientShellBody`
  in `runner/execute-core.ts` and the `[SPA_SHELL]` branch in `runner/classify.ts`.
- **Stubbed/bypassed dev auth:** RBAC exposures against a local dev-bypass env are
  `needs_verification`, not confirmed vulns.
- **Payment processors ≠ e-commerce:** Stripe/PayPal alone don't classify a site as a
  store (`src/lib/platform/detect.ts`) — they power SaaS/LMS/donations too.
- **Flakes:** browser cards retry up to 3×; a pass on retry is `flaky`-recovered, not a bug.

## The standalone CLI + MCP
- CLI: `node --experimental-strip-types runner/audit.ts --name … --app-url … [--repo …] [--hints …] [--out …]`.
- MCP: `runner/mcp-server.ts` exposes 10 tools incl. `launchaudit_run_audit`. The engine
  makes **zero LLM calls** — the host agent does the reasoning on the user's own subscription.
- The audit-and-fix loop (skill + slash command) lives in `claude-code/`.

## Fixtures (ground truth — validate generator/classifier changes against BOTH)
- `fixtures/buggy-shop` — zero-dep Node app with 5 planted bugs (`BUGS.md`). The audit
  must catch all 5 and must NOT flag the routes marked intentionally-correct.
- `fixtures/shop-fixed` — corrected variant; must score 100/100.
Recall must not drop on buggy-shop and false positives must not appear on shop-fixed.

## ⭐ The test research catalog — use this as the build spec
**`docs/research/test-catalog/`** is the sourced universe of **~1,485 tests** across 9
domains (web security, API/authz, accessibility, performance, SEO, functional, HTTP/
TLS/headers, reliability/privacy, mobile/AI-voice). Every row cites a real standard
(OWASP WSTG/API-Top-10/ASVS/MASVS/LLM-Top-10, WCAG 2.2, Lighthouse, Schema.org,
PCI-DSS, NIST, RFCs…) — nothing invented; unsourced items are tagged `[UNVERIFIED]`/
`[MODEL-SUGGESTED]`. Raw evidence is in `docs/research/test-catalog/raw/`.

- **Start at `docs/research/test-catalog/ROLLUP.md`** — it maps what 80/20 Launch Audit
  ALREADY runs vs. the biggest unbuilt opportunities (the prioritized build list).
- Each catalog row has an **"Automatable by 80/20 Launch Audit?"** column — that's the
  filter for what to turn into a detector.
- `00-SOURCES.md` = where every test comes from. `RESEARCH-PROTOCOL.md` = how to
  extend the catalog (provenance law: no test without a real source).

When asked to "make it cover more / add detectors," read `ROLLUP.md` first, pick
high-leverage automatable rows, and implement them via the detector pattern above.

## Image generation (when the Boss asks for an image)
Image generation runs through **OpenRouter** on a single key. The key is **NOT in this
file** (this file is public) — it lives in `CLAUDE.local.md` and/or `.env.local`, both
gitignored and local-only. When asked to generate or edit an image:
- Read `OPENROUTER_API_KEY` from `.env.local` / `CLAUDE.local.md` (local env), never hardcode it.
- Use an OpenRouter image model — default **`google/gemini-3-pro-image-preview`**
  ("Nano Banana Pro", text-in-image + 2K/4K); alternatives: `google/gemini-3.1-flash-image-preview`
  (fast), `black-forest-labs/flux.2-klein-4b` (cheap), `bytedance-seed/seedream-4.5` (editing).
- POST to `https://openrouter.ai/api/v1/chat/completions` with the model + prompt; save
  the returned image bytes to disk. Never commit the key or log it.
If the key isn't present locally, ask the Boss to drop it in `CLAUDE.local.md` — don't
put it in a tracked file.

## Conventions (non-negotiable)
- Truth Protocol: never claim a finding without evidence; honest classification over
  scary-but-wrong. No fake/placeholder data in the dashboard or reports.
- Provenance: catalog rows must carry a real source URL. Don't invent tests or sources.
- Tests must pass (`npm test`) and `npm audit` should stay clean before claiming done.
- No secrets in tracked files. Keys live in `.env.local` / `CLAUDE.local.md` (gitignored).
- Type-stripping limits: no TS enums, namespaces, or parameter properties in runner code.

## Key docs
- `README.md` — product + usage (public-facing). `docs/PRD.md` — locked requirements.
- `CLAUDE.local.md` — local-only context + keys (gitignored; create from the template note inside).
- `docs/PRODUCTION-HARDENING.md` — the hardening log (what was fixed and verified).
- `docs/research/test-catalog/` — the test universe + build roadmap (above).
- `docs/planning/` — launch planning notes.
