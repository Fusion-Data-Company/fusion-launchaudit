# LaunchAudit — Production Status

## What's real and shipped
- **Deep test engine** — FE / BE / admin-RBAC / middleware generators producing
  real executable browser + HTTP checks. Catches RBAC direct-URL leaks, unguarded
  admin APIs, 500-on-bad-input, missing security headers, responsive overflow.
- **PAI-style Claude Code layer** — MCP server (10 tools incl. `launchaudit_run_audit`)
  + skill + `/launch-audit` command. Installs into the dev's own `~/.claude/`.
  Runs on their Claude subscription. No API key, no hosted backend required.
- **Standalone audit** — `runner/audit.ts` runs the whole pipeline locally and
  writes a self-contained, plain-English client report. Optional hosted sync.
- **Auth capture** — logs in with dev-provided test creds locally; role-based
  admin checks run anonymous vs user vs admin.
- **80→100 loop** — readiness computed from real results; findings → auto repair
  packets → fix → re-verify → score climbs. Proven 57→100 on the fixture.
- **Premium dashboard** — rebuilt to dev-tool grade (neutral dark, readiness
  gauge + road-to-100, category-coverage centerpiece, Linear-style results).
  Live in production, hostile-verified (dark/light/mobile, 6 views, 0 console errors).
- **Multi-campaign** persistence (Neon), campaign switcher, report export.
- **Trace artifacts + Blob upload** — every browser-executed check is traced
  (Playwright screenshots + DOM snapshots); FAILED cards export a `trace.zip`
  into the report's `evidence/` dir (passed checks keep none — size
  discipline). When `BLOB_READ_WRITE_TOKEN` is present (`.env.local` or env),
  the runner uploads evidence binaries (screenshots + traces) to Vercel Blob
  under `launchaudit/<name>/<run-stamp>/`. Uploads try `access: "private"`
  first (the storage contract's preference, with presigned report links); the
  production `launchaudit-artifacts` store is configured PUBLIC, so the API
  rejects private writes and the runner falls back to public uploads with
  unguessable random-suffix URLs. The HTML report links evidence per check —
  blob URLs in blob mode, local relative paths (`evidence/...`) when no token.
  Hosted sync now registers trace artifacts (kind `trace`) alongside
  screenshots. Verified end-to-end on the buggy-shop fixture: 2 trace.zips for
  the 2 failed browser cards, 6 blobs uploaded, trace blob re-downloaded
  byte-identical (HTTP 200).

## What's honestly not done
- **Cowork (non-developer) surface** — packaging the same tools as a Cowork
  plugin so non-devs run it without a terminal. ("Both, devs first" — this is the
  second half.)
- **Video artifacts** — skipped deliberately. Playwright `recordVideo` must be
  enabled at context creation, before pass/fail is known, so "video for failed
  cards only" would mean recording every attempt of every card and deleting
  most of it — real encoding overhead on every run for evidence the trace
  viewer already covers (traces include per-step screenshots + DOM snapshots).
  Not built; revisit only if a client asks for watchable video.
- **Trace coverage is browser-cards only** — pure-HTTP checks (admin API /
  security headers) have no browser context, so no trace or screenshot; their
  evidence is the recorded failure detail itself.
- **Production campaign creation** needs `POSTGRES_URL` set in Vercel env (1 step).
- **Seed/demo campaign is labelled, not faked.** Until a real campaign is created
  via the API (Postgres live), the dashboard serves a clearly-marked
  "Demo: Sample Campaign" (`demo.example/sample-app`, `demo-runner (sample)`),
  and the UI renders a "Sample data" badge + advisory notes whenever
  `persistence.mode !== "postgres"`. Real Postgres-backed campaigns render
  truthfully with no badge.

## Security hardening (2026-06-12)
- **Runner-write authentication.** `/api/runner/sync` and
  `/api/storage/register-artifact` now require the shared `RUNNER_SYNC_SECRET`
  (sent by the runner as `authorization: Bearer <secret>`), compared in
  constant time. Production fails closed: an unset secret rejects all writes
  (503); a configured secret rejects missing/wrong credentials (401). Local dev
  with no secret stays open so `npm run dev` + `npm run runner:sync` work with
  zero setup; when `.env.local` carries the secret, the dev server enforces it
  exactly like production.
- **Security headers** set in `vercel.json` for all paths: a tight CSP
  (`script-src 'self'`, no inline scripts in deployed HTML; `style-src` allows
  `'unsafe-inline'` for the app's dynamic runtime inline styles + Google Fonts;
  `font-src` Google Fonts; `connect-src 'self'`; `frame-ancestors 'none'`),
  plus `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, a deny-all
  `Permissions-Policy`, and `Cross-Origin-Opener-Policy: same-origin`.
- **Favicon** added (`public/favicon.svg`, the LaunchAudit gauge mark) and linked
  from both HTML pages — no more `/favicon.ico` 404.
- **Traffic-insight + self-healing engines** — not built yet. Their dashboard
  panels (and the Evidence nav view) were removed entirely rather than showing
  sample data; they return when the Playwright traffic layer and healing engine
  produce real per-campaign events. The concepts remain listed honestly as
  roadmap items in the Reports view's flagship-feature layer.

## Install (developer, on their own subscription)
```bash
npm install && npx playwright install chromium chromium-headless-shell
claude mcp add launchaudit -- node --experimental-strip-types ./runner/mcp-server.ts
cp -r claude-code/skills/launchaudit ~/.claude/skills/ && cp claude-code/commands/launch-audit.md ~/.claude/commands/
```
Then in Claude Code: "Audit my site at http://localhost:3000 and fix what's broken — code is in ~/projects/mysite"
