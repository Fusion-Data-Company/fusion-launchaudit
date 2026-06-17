/**
 * Truth Protocol — the verdict model that makes "pass" mean something.
 *
 * Two rules, enforced in code, that no competitor enforces:
 *   1. No check may claim PASS without at least one evidence artifact.
 *      An evidence-less "pass" is downgraded to needs_verification.
 *   2. The readiness score counts ONLY watchdog-verified passes. A pass the
 *      watchdog could not independently reproduce does not count toward "done."
 *
 * This is the spine. classify.ts diagnoses failures; this governs every verdict.
 */

export type VerdictStatus = "pass" | "fail" | "blocked" | "needs_verification";
export type Confidence = "high" | "medium" | "low";
export type EvidenceKind =
  | "screenshot" | "trace" | "http_transcript" | "console" | "network"
  | "file_ref" | "rerun";

export type Evidence = {
  kind: EvidenceKind;
  /** path or URL to the artifact, when one exists */
  ref?: string;
  /** human-readable one-liner describing what this evidence shows */
  summary: string;
};

export type Provenance = {
  executor: "browser" | "http" | "static" | "elevenlabs" | "seo";
  attempts: number;
  startedAt: string;
  endedAt: string;
  /** what was actually run/requested — the receipt */
  command?: string;
};

export type WatchdogStamp = {
  verified: boolean;
  method: "rerun" | "evidence_audit" | "none";
  note: string;
  at: string;
};

export type Verdict = {
  checkId: string;
  title: string;
  category: string;
  risk: string;
  status: VerdictStatus;
  confidence: Confidence;
  reason: string;
  evidence: Evidence[];
  provenance: Provenance;
  watchdog?: WatchdogStamp;
};

/** Rule 1: a pass must be backed by evidence. */
export const PASS_REQUIRES_EVIDENCE = true;

export type RawResult = {
  checkId: string;
  title: string;
  category: string;
  risk: string;
  rawStatus: "pass" | "fail" | "blocked";
  reason: string;
  evidence: Evidence[];
  provenance: Provenance;
};

/**
 * Seal a raw execution result into a Verdict, enforcing Rule 1.
 * A claimed pass with zero evidence cannot stand: it becomes
 * needs_verification at low confidence, with the reason recorded — never a
 * silent pass. Failures and blocks pass through with computed confidence.
 */
export function sealVerdict(raw: RawResult): Verdict {
  const base = {
    checkId: raw.checkId, title: raw.title, category: raw.category, risk: raw.risk,
    evidence: raw.evidence, provenance: raw.provenance,
  };

  if (raw.rawStatus === "pass") {
    if (PASS_REQUIRES_EVIDENCE && raw.evidence.length === 0) {
      return {
        ...base, status: "needs_verification", confidence: "low",
        reason: `Claimed pass with no evidence captured — cannot confirm. (${raw.reason})`.slice(0, 400),
      };
    }
    return { ...base, status: "pass", confidence: passConfidence(raw.evidence), reason: raw.reason };
  }

  if (raw.rawStatus === "blocked") {
    return { ...base, status: "blocked", confidence: "medium", reason: raw.reason };
  }

  // fail
  return { ...base, status: "fail", confidence: raw.reason.trim() ? "high" : "medium", reason: raw.reason };
}

function passConfidence(evidence: Evidence[]): Confidence {
  const kinds = new Set(evidence.map((e) => e.kind));
  // A pass corroborated by a re-run, or by two independent kinds, is high-confidence.
  if (kinds.has("rerun")) return "high";
  if (kinds.size >= 2) return "high";
  return "medium";
}

/**
 * The honest readiness number. ONLY watchdog-verified passes count toward the
 * score; unverified passes are excluded from the numerator AND surfaced so the
 * builder knows what still has to be proven. This is what stops "it's done"
 * from being a lie.
 */
export function readiness(verdicts: Verdict[]) {
  const counts = { pass: 0, verifiedPass: 0, fail: 0, blocked: 0, needsVerification: 0 };
  for (const v of verdicts) {
    if (v.status === "pass") {
      counts.pass += 1;
      if (v.watchdog?.verified) counts.verifiedPass += 1;
    } else if (v.status === "fail") counts.fail += 1;
    else if (v.status === "blocked") counts.blocked += 1;
    else counts.needsVerification += 1;
  }
  // Denominator: everything that has a definite bearing on "is it done."
  const denom = counts.verifiedPass + counts.fail + counts.blocked + counts.needsVerification
    + (counts.pass - counts.verifiedPass);
  const score = denom === 0 ? 0 : Math.round((counts.verifiedPass / denom) * 100);
  const unverifiedPasses = counts.pass - counts.verifiedPass;
  return { score, counts, unverifiedPasses };
}
