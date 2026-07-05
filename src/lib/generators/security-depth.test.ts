import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSecurity } from "./security.ts";
import { classifyFailure } from "../../../runner/classify.ts";
import { Counter } from "./types.ts";

const crawl = {} as never;
const ctx = { appUrl: "https://x", devStubAuth: false };

test("generateSecurity emits CSP + COOP depth cards with the new assertions", () => {
  const cards = generateSecurity(null, crawl, { securityPaths: ["/"] }, new Counter());
  const csp = cards.find((c) => c.title.includes("Content-Security-Policy"));
  const coop = cards.find((c) => c.title.includes("Cross-Origin-Opener-Policy"));
  assert.ok(csp && csp.category === "security_headers", "CSP card present");
  assert.ok(coop && coop.category === "security_headers", "COOP card present");

  const cspStep = csp!.exec[0] as { action: string; expectHeaderRecommended?: string[]; expectHeaderExcludesTokens?: Record<string, string[]> };
  assert.equal(cspStep.action, "http");
  assert.ok(cspStep.expectHeaderRecommended?.includes("content-security-policy"));
  assert.deepEqual(cspStep.expectHeaderExcludesTokens?.["content-security-policy"], ["unsafe-inline", "unsafe-eval"]);

  const coopStep = coop!.exec[0] as { action: string; expectHeaderRecommended?: string[] };
  assert.ok(coopStep.expectHeaderRecommended?.includes("cross-origin-opener-policy"));
});

test("classify: defense-in-depth header gap -> needs_verification; hard requirement -> product_bug", () => {
  const res = (error: string) => ({ card: { category: "security_headers" }, error } as never);
  // new depth checks (CSP/COOP) carry the 'defense-in-depth' marker
  assert.equal(classifyFailure(res(`/: missing recommended header "content-security-policy" (defense-in-depth)`), ctx).type, "needs_verification");
  assert.equal(classifyFailure(res(`/: header "content-security-policy" carries permissive directive "unsafe-inline" (defense-in-depth)`), ctx).type, "needs_verification");
  // existing hard requirements must STILL be product_bug (no regression)
  assert.equal(classifyFailure(res(`/: missing required header "x-content-type-options"`), ctx).type, "product_bug");
  assert.equal(classifyFailure(res(`/: header "x-powered-by" should not be exposed (leaks "Express")`), ctx).type, "product_bug");
});
