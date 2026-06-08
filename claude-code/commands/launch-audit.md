---
description: Audit a live site for launch readiness and fix what's broken
argument-hint: <url> [repo-path]
---

Run a launch-readiness audit on the site at $1 using the **launchaudit** skill.

1. Run `launchaudit_run_audit` (name it after the site; pass repo path $2 if given).
2. Report the readiness score and what failed, in plain English, and link the report file.
3. If a repo path was given and there are findings, fix the failing code with surgical
   changes, then re-run the audit to verify the fixes and show before/after.
4. Surface any `needs_input` checks honestly — never skip them.
