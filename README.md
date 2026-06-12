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

### 2. MCP server (use it from any Claude Code session)

```bash
claude mcp add launchaudit -- node --experimental-strip-types ./runner/mcp-server.ts
```

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

Four generator families, made repo-aware when you pass `--repo`:

- Frontend: app shell renders, pages reachable, no horizontal overflow at 390
  and 768 px viewports, no console errors or 5xx responses on load.
- Backend: malformed input returns a clean 4xx (not a 500), no stack-trace
  leaks in error bodies, GET APIs respond.
- Admin / RBAC: anonymous users are blocked from admin routes and admin APIs;
  with captured credentials, normal users are denied and admins pass (positive
  control); direct-URL access to admin detail pages is blocked.
- Middleware and security: security headers present and carrying safe values
  (X-Frame-Options, X-Content-Type-Options, CSP, HSTS, Referrer-Policy,
  Permissions-Policy), no X-Powered-By stack banner, and secret or VCS files
  (`/.env`, `/.env.local`, `/.env.production`, `/.git/config`, `/.git/HEAD`)
  are not publicly downloadable.

Every failure is classified before it reaches the report: `product_bug`,
`test_bug`, `flaky`, `needs_verification`, or `needs_input`, each with a
confidence level and a reason. Timing flakes are retried and recovered rather
than reported as bugs. If the audit detects the target is running with
stubbed or bypassed auth (a common dev-server setup), RBAC exposures are
downgraded to `needs_verification` instead of being claimed as confirmed
vulnerabilities.

What it does not test yet (planned, tracked in
`docs/research/GAP-ANALYSIS.md`): accessibility (axe-core), Core Web Vitals,
SEO and structured data, IDOR / object-id swaps, and verifying that denied
privileged mutations caused no state change.

## How it compares to TestSprite

TestSprite covers frontend rendering and basic user flows. LaunchAudit
overlaps on that surface and adds the authorization and middleware checks
that functional-QA tools generally do not run: multi-role RBAC, admin-panel
access control, server-side guards on privileged APIs, and security-header
correctness. A survey of 23 functional-QA tools (`docs/research/competitor-coverage.md`)
found none of them test authorization.

Measured result on the included fixture: `fixtures/buggy-shop` has 5 planted
bugs (an RBAC direct-URL leak, an unguarded admin API, a 500 with stack-trace
leak, a mobile overflow, and missing security headers). The audit caught all
5 and scored it 57/100. After the fixes (`fixtures/shop-fixed`), the same
audit scored 100/100.

## Optional: hosted dashboard

The repo also contains a web command center (`public/`, `api/`) deployable to
Vercel, with optional Postgres persistence via `POSTGRES_URL` (Neon). If you
set `LAUNCHAUDIT_API_URL` when running an audit, results also sync there.
This is entirely optional; the core product needs nothing hosted.

```bash
npm run dev        # local dashboard at http://127.0.0.1:3010
```

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for npm scripts and how to run the
fixture tests.

## License

MIT. See [LICENSE](LICENSE).
