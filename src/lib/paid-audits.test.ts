import { test } from "node:test";
import assert from "node:assert/strict";
import { publicOrderStatus, type PaidAuditRow } from "./paid-audits.ts";

const base: PaidAuditRow = {
  id: "pa_1", stripe_session_id: "cs_test_1", email: "buyer@example.com", target_url: "https://example.com",
  tier: "single", amount_cents: 7900, status: "delivered", grade_json: null, created_at: "2026-09-08T00:00:00Z", completed_at: null, report_url: null,
} as PaidAuditRow;

const okGrade = { ok: true, url: "https://example.com", score: 80, band: "green", passed: 10, summary: "fine", findings: [], kind: "deep", pages_scanned: 3, checks_run: 30, lighthouse: null };

test("publicOrderStatus never leaks the email and serves the grade for a delivered order", () => {
  const p = publicOrderStatus({ ...base, grade_json: okGrade as never });
  assert.equal("email" in p, false);
  assert.equal(p.status, "delivered");
  assert.equal(p.grade?.score, 80);
  assert.equal(p.blocked, null);
  assert.equal(p.refunded, false);
});

test("publicOrderStatus reports a blocked run with its reason and whether the refund went through", () => {
  const p = publicOrderStatus({ ...base, status: "blocked", grade_json: { error: "The site answered with a bot challenge (HTTP 403).", blocked: true, http_status: 403, refund: { id: "re_1" } } as never });
  assert.equal(p.status, "blocked");
  assert.match(p.blocked ?? "", /bot challenge/);
  assert.equal(p.refunded, true);
  assert.equal(p.grade, null);
  const q = publicOrderStatus({ ...base, status: "blocked", grade_json: { error: "x", blocked: true, refund: { error: "no key" } } as never });
  assert.equal(q.refunded, false);
});

test("publicOrderStatus stops serving the report once an order is refunded or disputed", () => {
  for (const status of ["refunded", "disputed"] as const) {
    const p = publicOrderStatus({ ...base, status, grade_json: okGrade as never, report_url: "https://example.com/r" });
    assert.equal(p.grade, null, status);
    assert.equal(p.report_url, null, status);
  }
});
