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

## What's honestly not done
- **Cowork (non-developer) surface** — packaging the same tools as a Cowork
  plugin so non-devs run it without a terminal. ("Both, devs first" — this is the
  second half.)
- **Trace/video artifacts + Blob upload** — screenshot evidence works and is
  referenced; richer artifacts are next.
- **Production campaign creation** needs `POSTGRES_URL` set in Vercel env (1 step).
- Traffic-insights / self-healing dashboard panels are labeled sample data.

## Install (developer, on their own subscription)
```bash
npm install && npx playwright install chromium
claude mcp add launchaudit -- node --experimental-strip-types ./runner/mcp-server.ts
cp -r claude-code/skills/launchaudit ~/.claude/skills/ && cp claude-code/commands/launch-audit.md ~/.claude/commands/
```
Then in Claude Code: "Audit my site at http://localhost:3000 and fix what's broken — code is in ~/projects/mysite"
