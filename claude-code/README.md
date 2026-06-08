# LaunchAudit for Claude Code

Run launch-readiness audits — and fix what's broken — from inside your own
Claude Code, on your own Claude subscription. **No API key. No hosted backend.**
Same model as PAI: Claude Code is the engine; this is a layer on top.

## Install (2 steps)

From the `fusion-launchaudit` repo:

```bash
# 1. install deps + the browser the audit drives
npm install && npx playwright install chromium

# 2. register the audit tools with your Claude Code
claude mcp add launchaudit -- node --experimental-strip-types ./runner/mcp-server.ts
```

Then drop the skill + command into your Claude Code config so the agent knows
the audit→fix→verify loop:

```bash
mkdir -p ~/.claude/skills/launchaudit ~/.claude/commands
cp claude-code/skills/launchaudit/SKILL.md ~/.claude/skills/launchaudit/
cp claude-code/commands/launch-audit.md ~/.claude/commands/
```

## Use it

In Claude Code, just say it in plain language:

> Audit my site at http://localhost:3000 and fix anything broken — the code is in ~/projects/mysite

…or use the command:

```
/launch-audit http://localhost:3000 ~/projects/mysite
```

Your Claude Code runs the audit in a real browser, writes a plain-English report
to `launchaudit-report/`, fixes the failing code, and re-runs to prove the fix —
all on your subscription, nothing leaves your machine.

## Without an agent (just the report)

```bash
node --experimental-strip-types runner/audit.ts --name "My Site" --app-url https://mysite.com --repo .
```

## Optional: sync to the hosted command center

Set `LAUNCHAUDIT_API_URL=https://launch-audit-platform.vercel.app` (or your own
deploy) and audits also push to the web dashboard. Purely optional — the core
product needs nothing hosted.
