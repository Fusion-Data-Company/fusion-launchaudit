/**
 * The Watchdog — independently re-proves every PASS before it is allowed to
 * count toward "done." A pass it cannot reproduce, or that comes back without
 * evidence, is downgraded to needs_verification. This is the anti-lie gate: it
 * exists to catch the "it's done / I fixed it" claim that isn't true — the
 * exact failure that defines this product.
 *
 * The watchdog is executor-agnostic: callers inject a re-execute function, so
 * it works for HTTP checks, browser checks, or static checks, and is fully
 * unit-testable without a browser.
 */
import type { Evidence, RawResult, Verdict } from "./verdict.ts";

export type ReExecute = (checkId: string) => Promise<RawResult>;

export type WatchdogReport = {
  verdicts: Verdict[];
  checkedPasses: number;
  verifiedPasses: number;
  downgraded: Array<{ checkId: string; reason: string }>;
};

export async function runWatchdog(
  verdicts: Verdict[],
  reexecute: ReExecute,
): Promise<WatchdogReport> {
  const out: Verdict[] = [];
  const downgraded: Array<{ checkId: string; reason: string }> = [];
  let checkedPasses = 0;
  let verifiedPasses = 0;

  for (const v of verdicts) {
    const at = new Date().toISOString();

    // Non-pass verdicts aren't claiming success — audit that evidence exists, don't re-run.
    if (v.status !== "pass") {
      out.push({
        ...v,
        watchdog: {
          verified: v.evidence.length > 0,
          method: "evidence_audit",
          note: v.evidence.length > 0 ? "evidence present" : "no evidence on record",
          at,
        },
      });
      continue;
    }

    // A claimed pass must survive an independent re-run that ALSO produces evidence.
    checkedPasses += 1;
    let fresh: RawResult | null = null;
    try { fresh = await reexecute(v.checkId); } catch { fresh = null; }

    const reproduced = Boolean(fresh && fresh.rawStatus === "pass" && fresh.evidence.length > 0);
    if (reproduced) {
      verifiedPasses += 1;
      const stamp: Evidence = { kind: "rerun", summary: "independently re-verified by the watchdog" };
      out.push({
        ...v,
        evidence: [...v.evidence, stamp],
        confidence: "high",
        watchdog: { verified: true, method: "rerun", note: "re-ran and confirmed the pass", at },
      });
    } else {
      const why = !fresh
        ? "re-run errored"
        : fresh.rawStatus !== "pass"
          ? `re-run came back "${fresh.rawStatus}", not pass`
          : "re-run produced no evidence";
      downgraded.push({ checkId: v.checkId, reason: why });
      out.push({
        ...v,
        status: "needs_verification",
        confidence: "low",
        reason: `Watchdog could not confirm this pass: ${why}. Original claim: ${v.reason}`.slice(0, 400),
        watchdog: { verified: false, method: "rerun", note: why, at },
      });
    }
  }

  return { verdicts: out, checkedPasses, verifiedPasses, downgraded };
}
