# Changelog

All notable changes to **80/20 Launch Audit** are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/); this project uses [SemVer](https://semver.org/).

## [Unreleased]

### Added
- **Persistent local hub.** `npm run dashboard` boots the command-center dashboard on an embedded, on-disk Postgres (PGlite) at `http://localhost:3010`. Every audit accumulates there and is recalled across sessions — fully local, no cloud, data never leaves the machine.
- **Auto-opening dashboard.** A run now opens a self-contained command-center dashboard in the browser (or the live hub when it's running) instead of just printing a file path. `--no-open` to skip.
- **Local run history** (`history.json`) so a project's score is tracked across runs.
- **CI** (`.github/workflows/ci.yml`): `npm test` + `npm audit` on every push and PR.
- **Dependabot** for npm and GitHub Actions updates.

### Fixed
- **SPA false positives (the big one).** A client-rendered SPA serves the same 200 shell for every route; admin *page* routes are no longer reported as "critical exposed admin." They downgrade to `needs_verification` (HTTP can't prove a client-gated route is exposed — the API is the real gate, tested separately).
- **CORS preflight false positive.** `OPTIONS`/`HEAD` on an admin API (a 200 preflight) is no longer flagged as an exposed privileged action.
- **Platform misdetection.** A payment processor (Stripe/PayPal) alone no longer classifies an app as e-commerce; SaaS/LMS apps are detected as web apps.

### Changed
- Rebranded to **80/20 Launch Audit** across README, dashboard, and landing (the `launchaudit` code identifier is unchanged).
- README rewritten with the product's real voice + a 60-second quick start.

## [1.0.0]
- Initial public release: deterministic audit engine (scan → crawl → generate → execute in Chromium + HTTP → watchdog re-verify → classify → score), MCP server (10 tools), standalone CLI, the audit-and-fix loop for Claude Code/Cursor/Codex, and the sourced ~1,485-test research catalog. Catches broken access control (IDOR/RBAC), unguarded admin APIs, injection, missing security headers, leaked secrets, accessibility, SEO, Core Web Vitals, and ElevenLabs voice-agent config — each finding classified for honesty by the Truth Protocol.
