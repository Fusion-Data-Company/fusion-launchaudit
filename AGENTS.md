# AGENTS.md — running LaunchAudit from any coding agent

LaunchAudit is a deep launch-readiness audit for web apps. This file tells any
coding agent (Codex, Cursor, Claude Code, etc.) how to drive it. The audit
**engine makes no LLM calls of its own** — it is deterministic code (scan, crawl,
real-browser + HTTP checks, watchdog). You (the agent) supply the reasoning and
the fixes; the tool supplies the truth.

## Setup
```
git clone https://github.com/Fusion-Data-Company/fusion-launchaudit.git
cd fusion-launchaudit && npm install && npx playwright install chromium
```
Register the MCP server with your client (see README "MCP server" section for the
Claude Code / Cursor / Codex one-liners). It exposes `launchaudit_*` tools,
including `launchaudit_run_audit` which runs the whole pipeline in one call.

## The loop to run
1. **Audit** — call `launchaudit_run_audit` with `name`, `app_url`, and `repo_path`
   if the code is local. It returns a 0–100 readiness score, the report path,
   `findings` (what failed), and `needs_input` (checks blocked on something only
   the user can provide, e.g. test credentials).
2. **Explain plainly** — tell the user the score and what failed in plain English.
   Surface every `needs_input` item honestly; never skip or hide them.
3. **Fix (only if the code is local and the user wants it)** — for each finding,
   open the `likely_files`, make the smallest correct change that fixes the real
   behavior. **Never weaken, skip, or delete a check to make it pass.**
4. **Verify** — re-run `launchaudit_run_audit`. A fix only counts if the check now
   passes **under the watchdog**. Do not tell the user something is fixed without
   the re-run proving it.

## Rules (non-negotiable)
- Truth over green: never report a pass without reproducible evidence.
- If a check is blocked, say it's blocked — don't guess.
- Keep edits surgical; every changed line should trace to a finding.
