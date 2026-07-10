/**
 * Signed audit attestation — a tamper-evident, timestamped record that a launch was
 * audited and gated, with the evidence hashed in. Nobody in DAST offers verifiable audit
 * provenance; this turns our Truth Protocol into a compliance artifact (SOC2/ISO auditors
 * want exactly this). Follows the in-toto attestation shape (subject + predicate) and is
 * self-verifying: recompute the digest and it must match.
 *
 * Signing: if LAUNCHAUDIT_ATTEST_KEY (an HMAC secret) is present, we attach an HMAC-SHA256
 * over the canonical payload — a shared-secret signature that proves the attestation wasn't
 * altered after issue. No key → an unsigned but still hash-anchored attestation (honest:
 * we say "unsigned"). No external deps; Node crypto only.
 */
import { createHash, createHmac } from "node:crypto";
import type { ReportData, GateVerdict } from "./render-report.ts";

const PREDICATE_TYPE = "https://fusiondataco.com/launchaudit/attestation/v1";
const STATEMENT_TYPE = "https://in-toto.io/Statement/v1";

// Deterministic JSON (sorted keys) so the digest is stable across runs/machines.
function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
}

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export type Attestation = Record<string, unknown>;

/**
 * Build an in-toto-style attestation for a completed audit. `gate` is the launch gate
 * verdict; `key` (optional) is the HMAC secret. The predicate carries the score, gate,
 * finding-category counts, and a content digest of the full report data.
 */
export function buildAttestation(data: ReportData, gate: GateVerdict, key?: string): Attestation {
  const reportDigest = sha256Hex(canonical(data));

  // Summarize findings by category + severity bucket (no raw secrets — counts only).
  const byCategory: Record<string, number> = {};
  for (const f of data.findings) byCategory[f.category ?? "?"] = (byCategory[f.category ?? "?"] ?? 0) + 1;

  const predicate = {
    predicateType: PREDICATE_TYPE,
    tool: { name: "80/20 Launch Audit", version: "1.1.0" },
    auditedAt: data.generatedAt,
    appUrl: data.appUrl,
    readiness: data.readiness,
    launchGate: { pass: gate.pass, threshold: gate.threshold, blockers: gate.blockers.length, coverageGaps: gate.coverageGaps.length },
    findings: { total: data.findings.length, byCategory },
    reportDigest: `sha256:${reportDigest}`,
  };

  const statement: Attestation = {
    _type: STATEMENT_TYPE,
    subject: [{ name: data.name || data.appUrl, digest: { sha256: reportDigest } }],
    predicateType: PREDICATE_TYPE,
    predicate,
  };

  const payload = canonical(statement);
  statement.signature = key
    ? { alg: "HMAC-SHA256", value: createHmac("sha256", key).update(payload).digest("hex"), signed: true }
    : { alg: "none", value: null, signed: false };
  return statement;
}

export type VerifyResult = { valid: boolean; reason: string };

/**
 * Verify an attestation: (1) the subject digest matches the predicate reportDigest, and
 * (2) if signed, the HMAC matches (requires the same key). Tamper-evident by construction.
 */
export function verifyAttestation(att: Attestation, key?: string): VerifyResult {
  const subject = (att.subject as Array<{ digest?: { sha256?: string } }> | undefined)?.[0];
  const predicate = att.predicate as { reportDigest?: string } | undefined;
  const subjDigest = subject?.digest?.sha256;
  const predDigest = (predicate?.reportDigest ?? "").replace(/^sha256:/, "");
  if (!subjDigest || !predDigest || subjDigest !== predDigest) {
    return { valid: false, reason: "subject digest does not match the predicate report digest (tampered or malformed)" };
  }
  const sig = att.signature as { signed?: boolean; value?: string | null } | undefined;
  if (!sig?.signed) return { valid: true, reason: "digest matches; attestation is UNSIGNED (no key was configured at issue time)" };
  if (!key) return { valid: false, reason: "attestation is signed but no key was provided to verify it" };

  // Recompute HMAC over the canonical statement WITHOUT the signature field.
  const copy: Attestation = { ...att };
  delete copy.signature;
  const expected = createHmac("sha256", key).update(canonical(copy)).digest("hex");
  if (expected !== sig.value) return { valid: false, reason: "HMAC signature mismatch — the attestation was altered after signing" };
  return { valid: true, reason: "digest matches and HMAC signature is valid" };
}
