---
description: Audit a live site for launch readiness and fix what's broken — run as the Conductor
argument-hint: <url> [repo-path]
---

Run a launch-readiness audit on the site at $1 using the **launchaudit** skill,
orchestrated as the **Conductor**: triage → audit → verify → synthesize → fix → prove.

1. **Recon + triage.** `launchaudit_scan_repo` (repo path $2 if given) and `launchaudit_probe_runtime $1`. From the scan, pick the depth rung — go deep on the wedge (admin/RBAC, IDOR/BOLA, write-authz, middleware) if the app has auth, roles, or privileged writes.
2. **Derive hints.** Turn the scan into a hints file (protected routes/APIs, write endpoints, login path; admin/user creds only if the user supplies them — never invent). This is what makes the deep checks fire.
3. **Run.** `launchaudit_run_audit` (name it after the site; pass repo path $2 and the hints file).
4. **Verify gaps.** `launchaudit_read_report`. Close every `needs_verification` / `needs_input` (capture auth, supply a seed, confirm a route) and re-run — never accept a thin pass.
5. **Synthesize.** Report the Launch Gate PASS/FAIL + score (verified passes only), blockers first with root cause + exact repro + ready fix, root-cause clusters, the honest `needs_input` list, and a "what's left to 100%" ledger. Plain English; link the report file.
6. **Fix + prove (if repo $2 given and the user wants it).** Make the smallest correct change per finding — never weaken the check — then re-run to verify the fix with evidence and show before/after. Repeat until the Launch Gate passes or only `needs_input` remains.

Honor the Truth Protocol throughout: evidence or it didn't happen; `needs_input` is first-class; never fake a pass.
