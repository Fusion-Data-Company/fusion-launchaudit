# LaunchAudit

LaunchAudit is a deep, automated launch-readiness audit for web apps. You point
it at a running app (and optionally its repo), it drives the app in a real
Chromium browser plus direct HTTP checks, and it produces a self-contained HTML
report with a 0-100 readiness score, evidence for every check, and a
plain-English list of problems to fix.

It is built to run inside your own Claude Code on your own Claude subscription:
Claude Code is the engine, LaunchAudit is the layer. There is no API key to
buy and no hosted backend to sign up for. Everything runs on your machine.

## Requirements

- Node.js 22.6.0 or newer. Every command passes `--experimental-strip-types`
  explicitly, which Node added in 22.6.0, so any Node from 22.6 on works
  (verified working on Node 22.22.2; on Node 22.18+ and 23.6+ type stripping
  is on by default and the flag is simply redundant).
- npm (ships with Node).
- Claude Code, if you want the agent-driven audit-and-fix loop or the MCP
  server. The standalone CLI audit works without it.

## Install

```bash
git clone https://github.com/Fusion-Data-Company/fusion-launchaudit.git
cd fusion-launchaudit
npm install
npx playwright install chromium chromium-headless-shell
```

The Playwright step downloads the browser the audit drives. It is required for
all three usage modes.

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

- `--name` (required) - human-readable audit name.
- `--app-url` (required) - the running app to audit. Local or deployed.
- `--repo` (optional) - path to the app's source. Enables the repo scanner,
  which finds routes, API endpoints, and middleware so the audit generates far
  more checks than a blind crawl.
- `--hints` (optional) - path to a JSON hints file listing protected routes,
  protected APIs, POST endpoints, a login path, and admin/user credentials.
  With credentials, LaunchAudit captures sessions locally and runs the same
  surface as each role. Credentials never leave your machine. See
  `fixtures/buggy-shop/launchaudit-hints.json` for the shape.
- `--out` (optional) - output directory. Default: `launchaudit-report/`.

The pipeline is: scan repo, crawl the running app, generate test cards,
execute them in Chromium and over HTTP, collect evidence, classify failures,
compute readiness, render the report.

### 2. MCP server (use it from Claude Code, Cursor, or Codex)

The audit engine makes **no LLM calls of its own** — it is deterministic code
(scan, crawl, real-browser + HTTP checks, watchdog). So any MCP-capable agent can
drive it on your own subscription; you are not tied to one model or vendor.

**Claude Code:**

```bash
claude mcp add launchaudit -- node --experimental-strip-types ./runner/mcp-server.ts
```

**Cursor** — add to `~/.cursor/mcp.json`:

```json
{ "mcpServers": { "launchaudit": { "command": "node", "args": ["--experimental-strip-types", "./runner/mcp-server.ts"] } } }
```

**Codex** — register the same `launchaudit` MCP server in your Codex config; the
clone + install steps are identical, only the registration differs.

This registers 10 MCP tools, including `launchaudit_run_audit` which runs the
full pipeline in a single tool call. Your agent does the reasoning on your
subscription.

### 3. Skill and slash command (the audit-and-fix loop)

The `claude-code/` directory contains a skill and a command that teach Claude
Code the full loop: audit, read the findings, fix the failing code, re-run to
prove the fix. See [claude-code/README.md](claude-code/README.md) for the
two-step install. Once installed:

```
/launch-audit http://localhost:3000 ~/projects/mysite
```

## What you get

Each run writes to the output directory (default `launchaudit-report/`):

- `launch-audit-<timestamp>.html` - a self-contained report. No server needed;
  open it in a browser or hand it to a client. Shows the readiness score,
  every check with its result, and the problems to fix in plain English.
- `launch-audit-<timestamp>.json` - the same data as machine-readable JSON.
- `evidence/` - artifacts (network logs, screenshots) backing each result.

The readiness score is passed checks over executed checks, 0-100. Checks that
could not run are reported as needing input or verification; they are never
silently counted as passes.

## What it tests

Generator families, made repo-aware when you pass `--repo`:

- Frontend: app shell renders, pages reachable, no horizontal overflow at 390
  and 768 px viewports, no console errors or 5xx responses on load.
- Backend: malformed input returns a clean 4xx (not a 500), no stack-trace
  leaks in error bodies, GET APIs respond.
- Admin / RBAC: anonymous users are blocked from admin routes and admin APIs;
  with captured credentials, normal users are denied and admins pass (positive
  control); direct-URL access to admin detail pages is blocked.
- Write authorization: anonymous state-changing writes (POST/PUT/PATCH/DELETE)
  to privileged endpoints must be rejected (401/403); other mutating endpoints
  are flagged only if they silently accept an anonymous write (needs_verification).
- Middleware and security: security headers present and carrying safe values
  (X-Frame-Options, X-Content-Type-Options, CSP, HSTS, Referrer-Policy,
  Permissions-Policy), no X-Powered-By stack banner, and secret or VCS files
  (`/.env`, `/.env.local`, `/.env.production`, `/.git/config`, `/.git/HEAD`)
  are not publicly downloadable.
- SEO and structured data: real `<title>`, mobile viewport, meta description,
  canonical, Open Graph, valid Schema.org JSON-LD, and no accidental `noindex`.
- Content integrity: no lorem/placeholder copy, no unbound `undefined`/`NaN`
  values leaking to the page, no hardcoded `localhost` URLs on a deployed site.
- Accessibility: axe-core (WCAG 2.0/2.1 A + AA), reporting serious/critical
  violations only.
- Core Web Vitals: a cold-load LCP/CLS/FCP/TTFB smoke check (poor-range only,
  reported as needs_verification since one headless run is not a lab benchmark).
- ElevenLabs voice agents (when agent IDs + an API key are supplied): config
  reachable, real system prompt, tools not wiped, HTTPS webhooks, voice + TTS set.

Every failure is classified before it reaches the report: `product_bug`,
`test_bug`, `flaky`, `needs_verification`, or `needs_input`, each with a
confidence level and a reason. Timing flakes are retried and recovered rather
than reported as bugs. If the audit detects the target is running with
stubbed or bypassed auth (a common dev-server setup), RBAC exposures are
downgraded to `needs_verification` instead of being claimed as confirmed
vulnerabilities.

Coverage grows continuously from the sourced catalog
(`docs/research/test-catalog/`, ~1,485 tests across 9 domains). IDOR / object-id
swaps across user boundaries and privileged-mutation (BFLA) checks now run; see
`docs/research/test-catalog/ROLLUP.md` for what runs today vs. the highest-leverage
detectors still to build.

## How it compares to TestSprite

TestSprite covers frontend rendering and basic user flows. LaunchAudit
overlaps on that surface and adds the authorization and middleware checks
that functional-QA tools generally do not run: multi-role RBAC, admin-panel
access control, server-side guards on privileged APIs, and security-header
correctness. A survey of 23 functional-QA tools (`docs/research/competitor-coverage.md`)
found none of them test authorization. On top of that wedge it also runs the
breadth a launch needs in one pass: accessibility (axe-core), SEO/structured
data, Core Web Vitals, fake/placeholder-data detection, and ElevenLabs voice
agent config — each finding classified for honesty rather than dumped as a bug.

Measured result on the included fixture: `fixtures/buggy-shop` has 5 planted
bugs (an RBAC direct-URL leak, an unguarded admin API, a 500 with stack-trace
leak, a mobile overflow, and missing security headers). The audit caught all
5 (verified end-to-end) and scored it 62/100 on the current check set.
`fixtures/shop-fixed` is the corrected version used to verify the fixes clear
those findings.

## Optional: hosted dashboard

The repo also contains a web command center (`public/`, `api/`) deployable to
Vercel, with optional Postgres persistence via `POSTGRES_URL` (Neon). If you
set `LAUNCHAUDIT_API_URL` when running an audit, results also sync there.
This is entirely optional; the core product needs nothing hosted.

```bash
npm run dev        # local dashboard at http://127.0.0.1:3010
```

## Development

The engine has a unit-test suite (Node's built-in test runner, no extra deps):

```bash
npm test
```

It covers the scanner's HTTP-method extraction, the failure classifier (the
honesty rules), the write-authz tiers, card generation, and the content-integrity,
accessibility, SEO, and web-vitals detectors. See [CONTRIBUTING.md](CONTRIBUTING.md)
for the other npm scripts and how to run the fixture tests.

### Test research catalog (the build roadmap)

`docs/research/test-catalog/` is a sourced catalog of ~1,485 tests across 9 domains
(security, API/authz, a11y, performance, SEO, functional, headers/TLS, reliability/
privacy, mobile/AI) — every row cites a real standard (OWASP, WCAG, Lighthouse,
Schema.org, PCI-DSS, RFCs…). Start at
[`docs/research/test-catalog/ROLLUP.md`](docs/research/test-catalog/ROLLUP.md): it
maps what LaunchAudit already runs vs. the highest-leverage detectors still to build.
`CLAUDE.md` orients agents to use it as the spec for new checks.

## License

MIT. See [LICENSE](LICENSE).
