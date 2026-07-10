# Self-Heal Loop — audit → fix → prove → repeat

This is the capability no hosted scanner or QA-SaaS can match: 80/20 Launch Audit runs
**inside your own coding agent with write access to the repo**, so it doesn't just find and
prove — it *fixes and re-proves*, autonomously, until the Launch Gate is green. ZAP, Burp
Enterprise, StackHawk, Momentic, QA.tech et al. structurally cannot do this — they have no
hands on your code.

## The loop

1. **Audit.** Run the audit (MCP `launchaudit_run_audit`, or `npx launchaudit --app-url … --repo …`).
   The JSON result carries a machine-readable **`fix_plan`** (`src/lib/report/fix-plan.ts`):
   an ordered list of the confirmed, gate-blocking bugs, each with:
   - `fix` — the paste-ready fix intent for this finding,
   - `repro` — the exact runnable proof it's currently broken (redacted),
   - `verify` — the targeted re-check command that proves it fixed.
   `fix_plan` is ordered by severity (critical first) and contains ONLY actionable confirmed
   bugs — never needs-verification questions, tooling hiccups, or blocked-for-input items.

2. **Fix one.** Take the first `fix_plan` step. Apply the change in the repo, guided by `fix`
   and the finding's `category` + `repro`. Keep the change surgical — touch only what the
   finding requires (see the repo CLAUDE.md conventions).

3. **Prove one.** Run the step's `verify` command — `npx launchaudit --reverify` re-checks only
   the previously-failed/uncertain checks and reports before → after. Confirm THIS finding
   flipped to passing. If it didn't, iterate on the fix (do not move on claiming success — the
   Truth Protocol binds the loop too).

4. **Repeat.** Move to the next `fix_plan` step. Continue until `launch_gate.pass === true`.

5. **Prove the whole.** Run a final full audit. Confirm `launch_gate.pass` and capture the
   readiness delta. Emit a summary: what was broken → what changed → the git diff → the green
   gate + the signed `attestation`.

## Rules (non-negotiable)

- **Never mark a step done without running its `verify` and seeing it pass.** A fix you didn't
  prove is not a fix.
- **One finding at a time.** Fix → verify → next. Don't batch-fix and hope; you lose the
  per-finding proof that makes this trustworthy.
- **Surgical diffs.** Every changed line traces to a `fix_plan` step. No drive-by refactors.
- **Stop at the gate, not at zero findings.** `launch_gate.pass` (confirmed security/authz bugs
  cleared + readiness ≥ threshold) is the exit condition; needs-verification items are surfaced
  for a human, not auto-"fixed."
- **Attestation closes it.** The final `launchaudit.attestation.json` is the tamper-evident
  record that this app was audited, fixed, and gated — attach it to the PR.

## Why this widens the gap

Everyone else's product ends at "here's a report." Ours ends at "here's the PR that fixes it,
with proof each fix works and a signed attestation that the gate is green." Find → prove → fix →
re-prove → attest, in one loop, on the developer's own subscription, code never leaving the
machine.
