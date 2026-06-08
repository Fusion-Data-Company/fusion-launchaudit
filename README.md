# Fusion LaunchAudit

Evidence-gated launch QA. Point it at a running app and a repo; it scans the code,
crawls the live DOM, generates executable test cards specific to that app, runs them
in a real browser, captures screenshot/console/network evidence, turns failures into
findings with coding-agent-ready repair packets, computes an earned readiness score,
and renders a client-ready report. Private code never leaves the machine that runs
the audit — only sanitized summaries and evidence references sync.

## The one command

```bash
LAUNCHAUDIT_API_URL=https://launch-audit-platform.vercel.app \
node --experimental-strip-types runner/audit.ts \
  --name "Client App — launch audit" \
  --app-url https://staging.client.app \
  --repo ~/projects/client-app
```

scan → crawl → generate → create campaign → execute → evidence → findings →
repair packets → computed readiness → report at `/report.html?campaign=<id>`.

## Through your coding agent (the TestSprite pattern)

```bash
claude mcp add launchaudit -- node --experimental-strip-types ./runner/mcp-server.ts
```

9 MCP tools including `launchaudit_run_audit` (full pipeline in one tool call).
Your agent does the reasoning on your subscription; the platform stores evidence.

## Run Locally

```bash
npm run dev
```

Open:

```txt
http://127.0.0.1:3010
```

Verify API:

```bash
curl http://127.0.0.1:3010/api/campaign
```

Verify runner sync:

```bash
npm run runner:sync
```

## Deploy Shape

- `public/index.html`: static Fusion-branded command center.
- `public/assets/app.css`: dark/light theme with blue and cayenne ambient glow system.
- `public/assets/app.js`: browser renderer backed by `/api/campaign`.
- `api/campaign.ts`: Vercel campaign API.
- `api/runner/sync.ts`: Vercel runner sync API.
- `runner/local-runner.ts`: local runner simulator and sync payload contract.
- `src/lib/*`: typed campaign, MCP runner, and competitive scorecard data.

## Production Docs

- `docs/production-architecture.md`
- `docs/outperform-testsprite-scorecard.md`

## Current Verification

Current local checks:

```bash
npm run build
npm run runner:sync       # seeded simulation sync
npm run runner:scan       # real repo scan of this repo (use --repo <path> for any repo)
npm run db:verify         # full Postgres layer verification (in-process PGlite)
```

Browser QA should verify:

- dark mode default
- light/dark toggle
- no horizontal overflow at desktop and mobile widths
- 5 test cards render
- 3 findings render
- 6 scorecard categories render

## Persistence

Set `POSTGRES_URL` (Neon) and the campaign API, runner sync, and artifact registration
switch from seeded JSON to durable Postgres automatically. Schema applies and seeds
itself on first touch; without the env var everything still runs in seeded mode and
says so in the `persistence` block of each response.

## Real Repo Scanner

`runner/repo-scanner.ts` replaces seeded repo summaries when a repo path is given:

```bash
node --experimental-strip-types runner/local-runner.ts --repo /path/to/client-app
```

Detects framework, package manager, scripts, page/API route counts, expected-vs-present
env keys (names only, never values), and existing test tooling. Runtime summary is an
HTTP reachability probe; console/network capture arrives with the Playwright layer.
Sync payloads carry `scan_mode: "live_scan" | "seeded_simulation"` so nothing fake can
pose as real.

## Next Real Production Layer

1. Add Vercel Blob artifact storage (DB metadata side is done; binary upload next).
2. Add Playwright execution for approved test cards.
3. Add model task router live invocation for OpenAI, Anthropic, OpenRouter, Genspark bridge, and Docker-hosted OpenAI-compatible models.
4. Add report export and before/after repair rerun proof.
5. Add campaign creation UI so name/environment metadata moves from seed config into Postgres.
