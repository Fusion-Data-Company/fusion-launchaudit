# LaunchAudit — agent orientation

LaunchAudit is a deep, automated launch-readiness auditor for web apps. It drives a
real Chromium browser + direct HTTP checks against a running app, classifies every
finding for honesty, and produces a 0–100 readiness report. It runs locally inside
the developer's own Claude Code (MCP + skill) — no API key, no hosted backend
required. The wedge competitors don't cover: **authorization depth** (admin/RBAC,
write-authz, server-side guards) plus breadth (a11y, perf, SEO, security headers,
content integrity, ElevenLabs voice agents).

## Stack
- Node 22.6+ with `--experimental-strip-types` (TypeScript, no build step for the runner).
- Playwright (Chromium) for browser cards; `fetch` for HTTP cards.
- MCP SDK (`runner/mcp-server.ts`), esbuild (bundles `server/api-src/*` → `api/*` for the optional dashboard).
- Optional dashboard: plain HTML/CSS/JS in `public/`, optional Neon Postgres + Vercel Blob.
- Tests: `npm test` (Node's built-in `node:test`, no extra deps).

## How an audit runs (`runner/audit.ts`)
scan repo (`runner/repo-scanner.ts`) → crawl app (`runner/crawler.ts`) → generate
test cards (`src/lib/card-generator.ts`) → execute (`runner/execute-core.ts`) →
classify (`runner/classify.ts`) → score + render report (`runner/render-report.ts`).

## Detectors (the test generators)
`src/lib/generators/*.ts` — each exports `generate<X>(scan, crawl, hints, counter)`
returning `GeneratedCard[]`. Current: frontend, backend, admin-rbac, middleware,
security, write-authz, seo, content-integrity, accessibility, performance, elevenlabs.
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

## ⭐ The test research catalog — use this as the build spec
**`docs/research/test-catalog/`** is the sourced universe of **~1,485 tests** across 9
domains (web security, API/authz, accessibility, performance, SEO, functional, HTTP/
TLS/headers, reliability/privacy, mobile/AI-voice). Every row cites a real standard
(OWASP WSTG/API-Top-10/ASVS/MASVS/LLM-Top-10, WCAG 2.2, Lighthouse, Schema.org,
PCI-DSS, NIST, RFCs…) — nothing invented; unsourced items are tagged `[UNVERIFIED]`/
`[MODEL-SUGGESTED]`. Raw evidence is in `docs/research/test-catalog/raw/`.

- **Start at `docs/research/test-catalog/ROLLUP.md`** — it maps what LaunchAudit
  ALREADY runs vs. the biggest unbuilt opportunities (the prioritized build list).
- Each catalog row has an **"Automatable by LaunchAudit?"** column — that's the
  filter for what to turn into a detector.
- `00-SOURCES.md` = where every test comes from. `RESEARCH-PROTOCOL.md` = how to
  extend the catalog (provenance law: no test without a real source).

When asked to "make LaunchAudit cover more / add detectors," read `ROLLUP.md` first,
pick high-leverage automatable rows, and implement them via the detector pattern above.

## Conventions (non-negotiable)
- Truth Protocol: never claim a finding without evidence; honest classification over
  scary-but-wrong. No fake/placeholder data in the dashboard or reports.
- Provenance: catalog rows must carry a real source URL. Don't invent tests or sources.
- Tests must pass (`npm test`) and `npm audit` should stay clean before claiming done.

## Key docs
- `README.md` — product + usage. `docs/PRD.md` — locked requirements.
- `docs/PRODUCTION-HARDENING.md` — the 6-phase hardening log (what was fixed and verified).
- `docs/research/test-catalog/` — the test universe + build roadmap (above).
