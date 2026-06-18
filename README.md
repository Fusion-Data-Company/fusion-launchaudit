# 80/20 Launch Audit

[![CI](https://github.com/Fusion-Data-Company/fusion-launchaudit/actions/workflows/ci.yml/badge.svg)](https://github.com/Fusion-Data-Company/fusion-launchaudit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%E2%89%A522.6-339933?logo=node.js&logoColor=white)
![Runs in your agent](https://img.shields.io/badge/runs%20in-Claude%20Code%20%C2%B7%20Cursor%20%C2%B7%20Codex-7c83ff)

**Your AI built the easy 80%. This finds the 20% that ships broken — with proof — before your users do.**

A deep, automated launch-readiness audit for web apps. Point it at a running app (and optionally its repo); it drives the app in a real Chromium browser plus direct HTTP probes, and hands back a 0–100 readiness score, evidence for every check, and a plain-English list of exactly what to fix. It runs **inside your own coding agent on your own subscription** — no API key to buy, no hosted backend, your code never leaves your machine.

---

## Why I built this

I'm Rob. I run [Fusion Data Company](https://fusiondataco.com) — we build and ship AI-assisted web and mobile apps for real clients, every week.

Here's the pattern that kept biting me: the AI gets an app to about 80%. The happy path works, the demo looks great, everyone's happy. Then it ships — and someone changes one id in the URL and reads another customer's data. The admin button is gone from the UI but the endpoint still fires for anyone who calls it. A malformed request 500s with a stack trace. A `.env` rode along into the client bundle. The build *looked* done. It wasn't.

The other 80% of the real work — access control, the unhappy paths, security, the senior-dev finish — is the part the model skips unless you force it. And when you ask your AI "is this ready?", it wants to help, so it tells you what you're hoping to hear. It won't log in as a stranger to read your own data. It won't hammer its own API until it leaks. It doesn't double-check its own "looks fine."

So I built the thing that does. 80/20 Launch Audit doesn't crawl the happy path — it tries to break in, and it refuses to call anything "done" without evidence. That's the whole point: **your builder says ship it; this says prove it — and does.**

---

## 60-second quick start

Clone, install, register it with the agent you already pay for, and boot your dashboard. Then just tell the agent: **"audit my site at `<url>`."**

**Claude Code:**

```bash
git clone https://github.com/Fusion-Data-Company/fusion-launchaudit.git && cd fusion-launchaudit && npm install && npx playwright install chromium && claude mcp add launchaudit -- node --experimental-strip-types ./runner/mcp-server.ts && npm run dashboard
```

That last step (`npm run dashboard`) opens your **home base** at `http://localhost:3010` — a local dashboard backed by an on-disk database. Every audit you run lands there, and it's all remembered across sessions (your projects, runs, and scores). Nothing is hosted; the data never leaves your machine. Leave it running; run audits from your agent and watch them show up.

**Cursor / Codex** — clone + install the same way, then register the MCP server in your agent's config:

```json
{ "mcpServers": { "launchaudit": { "command": "node", "args": ["--experimental-strip-types", "./runner/mcp-server.ts"] } } }
```

No agent? Run the standalone CLI (below). Want to see what it produces first? Paste your URL into the free instant grader at **[launch-audit-platform.vercel.app/landing](https://launch-audit-platform.vercel.app/landing)**.

## Requirements

- Node.js 22.6.0 or newer. Every command passes `--experimental-strip-types` explicitly (Node added it in 22.6.0), so any Node from 22.6 on works (verified on 22.22; on 22.18+/23.6+ type stripping is on by default and the flag is simply redundant).
- npm (ships with Node).
- A coding agent (Claude Code, Cursor, or Codex) if you want the agent-driven audit-and-fix loop or the MCP server. The standalone CLI works without one.

## Usage

### 1. Standalone CLI audit

No agent required. Point it at a running app:

```bash
node --experimental-strip-types runner/audit.ts \
  --name "My App - launch audit" \
  --app-url http://localhost:3000 \
  --repo /path/to/the/app/repo
```

Flags:

- `--name` (required) — human-readable audit name.
- `--app-url` (required) — the running app to audit. Local or deployed.
- `--repo` (optional) — path to the app's source. Enables the repo scanner, which finds routes, API endpoints, and middleware so the audit generates far more checks than a blind crawl.
- `--hints` (optional) — path to a JSON hints file listing protected routes, protected APIs, POST endpoints, a login path, and admin/user credentials. With credentials, the audit captures sessions locally and runs the same surface as each role. Credentials never leave your machine. See `fixtures/buggy-shop/launchaudit-hints.json` for the shape.
- `--out` (optional) — output directory. Default: `launchaudit-report/`.

The pipeline: scan repo → crawl the running app → generate test cards → execute them in Chromium and over HTTP → collect evidence → classify failures → compute readiness → render the report.

### 2. MCP server (Claude Code, Cursor, or Codex)

The audit engine makes **no LLM calls of its own** — it's deterministic code (scan, crawl, real-browser + HTTP checks, watchdog). Any MCP-capable agent can drive it on your own subscription; you're not tied to one model or vendor. Registration is in the quick start above. It registers 10 MCP tools, including `launchaudit_run_audit`, which runs the full pipeline in a single call.

### 3. Skill and slash command (the audit-and-fix loop)

The `claude-code/` directory contains a skill and command that teach Claude Code the full loop: audit, read the findings, fix the failing code, re-run to prove the fix. See [claude-code/README.md](claude-code/README.md). Once installed:

```
/launch-audit http://localhost:3000 ~/projects/mysite
```

## What you get

When a run finishes it **opens a dashboard in your browser automatically** — the same command-center UI you see in the demo, but a single self-contained local file with your results baked in. No server, no signup, your data never leaves your machine. Everything is written to the output directory (default `launchaudit-report/`):

- `dashboard.html` — the interactive dashboard that auto-opens: readiness gauge, coverage by category, the filterable test-results list, and findings with paste-ready fixes. Run again and it tracks your score across runs (`history.json`). Pass `--no-open` to skip launching the browser.
- `launch-audit-<timestamp>.html` — a self-contained static report you can hand to a client.
- `launch-audit-<timestamp>.json` — the same data, machine-readable.
- `evidence/` — artifacts (network logs, screenshots) backing each result.

Readiness is passed checks over executed checks, 0–100. Checks that couldn't run are reported as needing input or verification — **never silently counted as passes.**

## What it tests

Generator families, made repo-aware when you pass `--repo`:

- **Frontend** — app shell renders, pages reachable, no horizontal overflow at 390/768 px, no console errors or 5xx on load.
- **Backend** — malformed input returns a clean 4xx (not a 500), no stack-trace leaks in error bodies, GET APIs respond.
- **Admin / RBAC** — anonymous users blocked from admin routes and APIs; with captured credentials, normal users are denied and admins pass (positive control); direct-URL access to admin detail pages is blocked.
- **Write authorization** — anonymous state-changing writes (POST/PUT/PATCH/DELETE) to privileged endpoints must be rejected (401/403); other mutating endpoints are flagged only if they silently accept an anonymous write (needs_verification).
- **Middleware & security** — security headers present with safe values (X-Frame-Options, X-Content-Type-Options, CSP, HSTS, Referrer-Policy, Permissions-Policy), no X-Powered-By banner, and secret/VCS files (`/.env`, `/.git/config`, …) not publicly downloadable.
- **SEO & structured data** — real `<title>`, mobile viewport, meta description, canonical, Open Graph, valid Schema.org JSON-LD, no accidental `noindex`.
- **Content integrity** — no lorem/placeholder copy, no unbound `undefined`/`NaN` on the page, no hardcoded `localhost` URLs on a deployed site.
- **Accessibility** — axe-core (WCAG 2.0/2.1 A + AA), serious/critical violations only.
- **Core Web Vitals** — a cold-load LCP/CLS/FCP/TTFB smoke check (poor-range only, reported as needs_verification — one headless run isn't a lab benchmark).
- **ElevenLabs voice agents** (when agent IDs + an API key are supplied) — config reachable, real system prompt, tools not wiped, HTTPS webhooks, voice + TTS set.

Every failure is classified before it reaches the report — `product_bug`, `test_bug`, `flaky`, `needs_verification`, or `needs_input` — each with a confidence level and a reason. Timing flakes are retried and recovered, not reported as bugs. If the target serves a **client-rendered SPA shell** on a protected route, the route check is downgraded to `needs_verification` (HTTP can't prove the page is exposed; the API is the real gate) instead of crying wolf. Same honesty rule for stubbed/bypassed dev auth.

Coverage grows from the sourced catalog (`docs/research/test-catalog/`, ~1,485 tests across 9 domains). Start at [`docs/research/test-catalog/ROLLUP.md`](docs/research/test-catalog/ROLLUP.md) for what runs today vs. the highest-leverage detectors still to build.

## The Truth Protocol

A security tool that cries wolf is worse than none. So a **watchdog independently re-verifies every "pass"** against fresh evidence — re-running the interaction, re-fetching the response, re-reading the state. Anything it can't reproduce is flagged, never silently passed. The score you get is the truth, not a hopeful guess.

## How it compares

Functional-QA tools cover frontend rendering and basic flows. 80/20 Launch Audit overlaps there and adds the authorization and middleware checks those tools generally don't run: multi-role RBAC, admin-panel access control, server-side guards on privileged APIs, and security-header correctness. A survey of 23 functional-QA tools ([`docs/research/competitor-coverage.md`](docs/research/competitor-coverage.md)) found **none of them test authorization**. On top of that wedge it runs the breadth a launch needs in one pass — accessibility, SEO/structured data, Core Web Vitals, fake-data detection, voice-agent config — each finding classified for honesty rather than dumped as a bug.

Measured on the included fixture: `fixtures/buggy-shop` has 5 planted bugs (an RBAC direct-URL leak, an unguarded admin API, a 500 with stack-trace leak, a mobile overflow, and missing security headers). The audit catches all 5 (verified end-to-end). `fixtures/shop-fixed` is the corrected version used to confirm the fixes clear those findings.

## Optional: hosted dashboard

The repo also contains a web command center (`public/`, `api/`) deployable to Vercel, with optional Postgres persistence via `POSTGRES_URL` (Neon). Set `LAUNCHAUDIT_API_URL` when running an audit and results sync there too. Entirely optional — the core product needs nothing hosted.

```bash
npm run dev        # local dashboard at http://127.0.0.1:3010
```

## Development

```bash
npm test           # Node's built-in test runner, no extra deps
```

Covers the scanner's HTTP-method extraction, the failure classifier (the honesty rules), the write-authz tiers, SPA-shell detection, platform detection, card generation, and the content-integrity / accessibility / SEO / web-vitals detectors. CI runs the suite plus `npm audit` on every push and PR. See [CONTRIBUTING.md](CONTRIBUTING.md) for the other scripts and how to run the fixture tests, and `CLAUDE.md` for the full architecture orientation.

## Who's behind it

Built and maintained by **Rob at [Fusion Data Company](https://fusiondataco.com)** — we ship AI-assisted web and mobile apps for clients, and this is the senior-dev review we run before anything we build goes live. Free and open source because every vibecoder shipping to production needs it. Questions, ideas, or a check you want in the default suite? The contact form on the [landing page](https://launch-audit-platform.vercel.app/landing) comes straight to me.

## License

MIT — free for everyone, forever. See [LICENSE](LICENSE).
