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

/** A pass that held only SOME of the k re-runs — unreliable, and for an authz check, dangerous. */
export type IntermittentPass = { checkId: string; category: string; passes: number; runs: number };

export type WatchdogReport = {
  verdicts: Verdict[];
  checkedPasses: number;
  verifiedPasses: number;
  /** k used for the consistency re-runs (pass^k). */
  k: number;
  downgraded: Array<{ checkId: string; reason: string }>;
  /** Passes that reproduced 1..k-1 of k times — surfaced as findings by the caller. */
  intermittent: IntermittentPass[];
};

/**
 * pass^k: re-run each claimed PASS `k` times under fixed conditions and only call it
 * verified if it reproduces (with evidence) EVERY time. This turns the readiness number
 * from "a number" into "a reproducible number," and — for authorization checks — turns
 * an intermittent protection ("locked 7 times, open the 8th") into a loud finding instead
 * of a silent pass, which is the single most dangerous failure mode a single test hides.
 */
export async function runWatchdog(
  verdicts: Verdict[],
  reexecute: ReExecute,
  opts: { k?: number } = {},
): Promise<WatchdogReport> {
  const k = Math.max(1, opts.k ?? 1);
  const out: Verdict[] = [];
  const downgraded: Array<{ checkId: string; reason: string }> = [];
  const intermittent: IntermittentPass[] = [];
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

    // A claimed pass must survive k independent re-runs that ALSO produce evidence.
    checkedPasses += 1;
    let reproduced = 0;
    for (let i = 0; i < k; i++) {
      let fresh: RawResult | null = null;
      try { fresh = await reexecute(v.checkId); } catch { fresh = null; }
      if (fresh && fresh.rawStatus === "pass" && fresh.evidence.length > 0) reproduced += 1;
    }

    if (reproduced === k) {
      verifiedPasses += 1;
      const stamp: Evidence = { kind: "rerun", summary: `independently re-verified by the watchdog (${k}/${k})` };
      out.push({
        ...v,
        evidence: [...v.evidence, stamp],
        confidence: "high",
        watchdog: { verified: true, method: "rerun", note: `re-ran ${k}× and confirmed the pass`, at },
      });
    } else if (reproduced === 0) {
      const why = "re-run came back non-pass or without evidence";
      downgraded.push({ checkId: v.checkId, reason: why });
      out.push({
        ...v,
        status: "needs_verification",
        confidence: "low",
        reason: `Watchdog could not confirm this pass: ${why}. Original claim: ${v.reason}`.slice(0, 400),
        watchdog: { verified: false, method: "rerun", note: why, at },
      });
    } else {
      // Intermittent: held some runs, not all. Unreliable — and for an authz check, worse
      // than always-open because it hides from a single test. Caller decides severity.
      intermittent.push({ checkId: v.checkId, category: v.category, passes: reproduced, runs: k });
      const note = `intermittent: passed ${reproduced}/${k} re-runs`;
      downgraded.push({ checkId: v.checkId, reason: note });
      out.push({
        ...v,
        status: "needs_verification",
        confidence: "high",
        reason: `INTERMITTENT — this check held only ${reproduced}/${k} independent re-runs. A protection that only sometimes holds is unreliable and hides from a single test. Original claim: ${v.reason}`.slice(0, 400),
        watchdog: { verified: false, method: "rerun", note, at },
      });
    }
  }

  return { verdicts: out, checkedPasses, verifiedPasses, k, downgraded, intermittent };
}
