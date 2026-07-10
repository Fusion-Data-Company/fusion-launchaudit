/**
 * Structured fix plan — the machine-readable spine of the self-healing loop. Every hosted
 * DAST / QA SaaS can only HAND you findings; because we run inside the dev's own coding
 * agent with repo write access, we can hand the agent an executable plan: per blocker, the
 * fix intent + the exact repro + the single command that PROVES it fixed. The agent applies
 * the fix, re-verifies just that check, and loops until the Launch Gate passes.
 *
 * Pure + deterministic. `fix` and `repro` come straight from the finding; `verify` is the
 * targeted re-check command (per-finding via --reverify) so a fix is proven without a full
 * re-audit.
 */

export type PlanFinding = {
  id?: string;
  title: string;
  category?: string;
  severity: string;
  summary: string;
  fixPrompt?: string;
  repro?: string;
};

export type FixPlanStep = {
  order: number;
  id: string;
  category: string;
  severity: string;
  title: string;
  fix: string;
  repro: string;
  verify: string;
};

const SEV_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

// A finding is actionable in the loop only if it's a CONFIRMED bug the developer can fix —
// not a needs-verification question, tooling hiccup, or blocked-for-input item.
function isActionable(severity: string): boolean {
  const s = severity.toLowerCase();
  return s !== "needs verification" && s !== "needs input" && s !== "blocked" && s !== "tooling";
}

/**
 * Build an ordered, executable fix plan from findings. Highest-severity first. `verifyBase`
 * is the audit command the host uses (default "npx launchaudit --reverify"); each step's
 * verify targets that finding so the agent can prove one fix at a time.
 */
export function buildFixPlan(findings: PlanFinding[], verifyBase = "npx launchaudit --reverify"): FixPlanStep[] {
  return findings
    .filter((f) => isActionable(f.severity))
    .sort((a, b) => (SEV_RANK[a.severity.toLowerCase()] ?? 9) - (SEV_RANK[b.severity.toLowerCase()] ?? 9))
    .map((f, i) => ({
      order: i + 1,
      id: f.id ?? `F${i + 1}`,
      category: f.category ?? "unknown",
      severity: f.severity,
      title: f.title,
      fix: f.fixPrompt ?? `Fix: ${f.summary}`,
      repro: f.repro ?? `Re-run: ${verifyBase}`,
      verify: `${verifyBase}   # then confirm "${f.id ?? f.title}" now passes`,
    }));
}

/** A one-line loop instruction the host agent follows until the gate passes. */
export function loopInstruction(steps: FixPlanStep[]): string {
  if (steps.length === 0) return "No confirmed bugs to fix — the Launch Gate is already green.";
  return `Self-heal loop: for each of the ${steps.length} step(s) below, apply the fix in the repo, run its verify command, and confirm the check flips to passing; repeat until the Launch Gate passes. Fix in severity order (highest first).`;
}
