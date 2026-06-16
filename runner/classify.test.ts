import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyFailure, type ClassifyContext } from "./classify.ts";
import type { CardResult } from "./execute-core.ts";

// The classifier is the honesty engine — it decides whether a failed check is a
// confirmed bug or a human-judgment call. Over-claiming here is the one thing
// that destroys trust in a security tool, so every branch is pinned.

const result = (category: string, error: string): CardResult =>
  ({ card: { category }, error } as unknown as CardResult);

const ctx = (devStubAuth = false): ClassifyContext => ({ appUrl: "https://x", devStubAuth });

test("unknown-intent write that was accepted is needs_verification, never a claimed bug", () => {
  const c = classifyFailure(result("write_authz_unverified", "got 200"), ctx());
  assert.equal(c.type, "needs_verification");
});

test("privileged write accepted with real auth is a confirmed product bug", () => {
  const c = classifyFailure(result("write_authz", "expected 401/403 but got 200"), ctx(false));
  assert.equal(c.type, "product_bug");
  assert.equal(c.confidence, "high");
});

test("privileged write accepted under stubbed auth is downgraded to needs_verification", () => {
  const c = classifyFailure(result("write_authz", "expected 401/403 but got 200"), ctx(true));
  assert.equal(c.type, "needs_verification");
});

test("privileged write that 5xx'd is a product bug (crashed auth path)", () => {
  const c = classifyFailure(result("write_authz", "got 500"), ctx());
  assert.equal(c.type, "product_bug");
});

test("privileged write rejected by shape/method (400) is needs_verification, not a bug", () => {
  const c = classifyFailure(result("write_authz", "got 400"), ctx());
  assert.equal(c.type, "needs_verification");
});

test("RBAC exposure under stubbed auth is needs_verification", () => {
  const c = classifyFailure(result("roles_permissions", "admin route was not blocked"), ctx(true));
  assert.equal(c.type, "needs_verification");
});

test("RBAC exposure with real auth is the high-value product bug", () => {
  const c = classifyFailure(result("roles_permissions", "admin route was not blocked"), ctx(false));
  assert.equal(c.type, "product_bug");
  assert.equal(c.confidence, "high");
});

test("missing <title> is a universal product bug; missing canonical is needs_verification", () => {
  assert.equal(classifyFailure(result("seo", "missing <title>"), ctx()).type, "product_bug");
  assert.equal(classifyFailure(result("seo", "missing canonical link"), ctx()).type, "needs_verification");
});

test("5xx where a 4xx was expected is a product bug", () => {
  assert.equal(classifyFailure(result("backend", "status 500 on malformed input"), ctx()).type, "product_bug");
});

test("a response that leaks a secret/stack trace is a product bug", () => {
  assert.equal(classifyFailure(result("security", "response body leaks a stack trace"), ctx()).type, "product_bug");
});

test("a missing hardening header is a product bug", () => {
  assert.equal(classifyFailure(result("middleware", "missing required header X-Frame-Options"), ctx()).type, "product_bug");
});

test("a front-end expectation that survived retries is a product bug", () => {
  assert.equal(classifyFailure(result("responsive_visual", "horizontal overflow at 390px"), ctx()).type, "product_bug");
});
