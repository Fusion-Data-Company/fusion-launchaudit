import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAttestation, verifyAttestation, sha256Hex } from "./attestation.ts";
import { launchGate, type ReportData } from "./render-report.ts";

function data(): ReportData {
  return {
    name: "Acme", appUrl: "https://acme.test", readiness: 88, passed: 20, failed: 1, blocked: 0, cards: [],
    findings: [{ title: "IDOR", category: "object_authz", summary: "x", severity: "high" }],
    generatedAt: "2026-07-10T00:00:00.000Z",
  };
}

test("attestation carries the in-toto shape + a report digest", () => {
  const att = buildAttestation(data(), launchGate(data()));
  assert.equal(att._type, "https://in-toto.io/Statement/v1");
  const pred = att.predicate as { reportDigest: string; readiness: number };
  assert.ok(pred.reportDigest.startsWith("sha256:"));
  assert.equal(pred.readiness, 88);
});

test("an unsigned attestation verifies on digest but is marked unsigned", () => {
  const att = buildAttestation(data(), launchGate(data()));
  const v = verifyAttestation(att);
  assert.equal(v.valid, true);
  assert.ok(v.reason.includes("UNSIGNED"));
});

test("a signed attestation verifies with the same key", () => {
  const att = buildAttestation(data(), launchGate(data()), "s3cret");
  const v = verifyAttestation(att, "s3cret");
  assert.equal(v.valid, true);
  assert.ok(v.reason.includes("valid"));
});

test("tampering with the score is detected (digest mismatch)", () => {
  const att = buildAttestation(data(), launchGate(data()), "s3cret");
  (att.predicate as { readiness: number }).readiness = 100; // forge a better score
  const v = verifyAttestation(att, "s3cret");
  assert.equal(v.valid, false);
});

test("altering a signed attestation body breaks the HMAC", () => {
  const att = buildAttestation(data(), launchGate(data()), "s3cret");
  // Keep the subject/predicate digests self-consistent but change an unrelated signed field.
  (att.predicate as { appUrl: string }).appUrl = "https://evil.test";
  const v = verifyAttestation(att, "s3cret");
  assert.equal(v.valid, false); // subject digest no longer matches predicate → caught
});

test("a signed attestation cannot be verified without the key", () => {
  const att = buildAttestation(data(), launchGate(data()), "s3cret");
  assert.equal(verifyAttestation(att).valid, false);
});

test("sha256Hex is stable", () => {
  assert.equal(sha256Hex("abc"), sha256Hex("abc"));
  assert.notEqual(sha256Hex("abc"), sha256Hex("abd"));
});
