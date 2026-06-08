---
name: launchaudit
description: >
  Audit a live website or web app for launch readiness and fix what's broken.
  Use when the user says "audit my site", "is my site ready to launch", "check
  my website", "test my app before launch", "find what's broken on", or gives a
  URL and asks whether it's ready for customers. Runs real browser checks
  (pages load, mobile layout, console/network errors, forms, routes), writes a
  plain-English report, and — because this runs inside the user's own Claude
  Code — fixes the failing code and re-runs to prove the fix.
---

# LaunchAudit — launch readiness audit + repair

LaunchAudit runs entirely inside this Claude Code session on the user's own
subscription. No API key, no hosted backend. It uses the `launchaudit_*` MCP
tools plus your own file-editing ability to close the loop: **audit → fix → verify.**

## When to use
The user wants to know if a site/app is ready to ship, or wants problems found
and fixed. They give (or you ask for) the live URL. If the code is local, ask
for the repo path too — it makes the checks repo-aware and lets you fix issues.

## The loop

1. **Audit.** Call `launchaudit_run_audit` with `name`, `app_url`, and (if the
   code is local) `repo_path`. It scans, crawls the live site, generates
   executable checks, runs them in a real browser, and writes a report. It
   returns readiness score, the report file path, `findings` (what failed), and
   `needs_input` (checks blocked on something only the user can provide, e.g. a
   test login — surface these honestly, never skip them).

2. **Explain plainly.** Tell the user the score and what failed in plain
   English (the report already translates jargon). Point them at the report file.

3. **Fix (only if the code is local and the user wants it).** For each finding,
   open the likely files, make the smallest correct change that fixes the real
   behavior — never weaken or delete the check to make it pass. Explain each fix.

4. **Verify.** Re-run `launchaudit_run_audit` against the same URL (rebuild/
   restart the app first if needed). Confirm the previously-failing checks now
   pass and the score went up. Show the before/after.

5. **Hand off.** Give the user the final report path. If they use the hosted
   command center, set `LAUNCHAUDIT_API_URL` and the audit also syncs there.

## Rules
- Private code never leaves the machine — scanning and execution are local.
- `blocked` / `needs_input` checks are first-class. Report them; do not pretend
  they passed.
- Don't fabricate results. Every status comes from a real browser run.
- Keep fixes surgical and traceable to a specific finding.

## Other tools
- `launchaudit_scan_repo` — inspect a repo (framework, routes, env keys, tests).
- `launchaudit_read_report` — re-read the last report's findings without re-running.
- `launchaudit_get_test_card_contract` — the rules for any checks you author by hand.
