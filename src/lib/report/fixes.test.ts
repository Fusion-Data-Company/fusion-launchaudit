import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFixPrompt, fixTheseThree, type Finding } from "./fixes.ts";

const f = (over: Partial<Finding>): Finding => ({ title: "T", category: "object_authz", severity: "critical", summary: "s", ...over });

test("fix prompt is specific to the category, cites the standard, and ends with a re-run", () => {
  const p = buildFixPrompt(f({ category: "object_authz", title: "GET /users/1" }));
  assert.match(p, /IDOR|object-level/i);
  assert.match(p, /WSTG-ATHZ-04|CWE-639/);
  assert.match(p, /--reverify/);
  assert.match(p, /GET \/users\/1/); // references the specific finding
});

test("each category produces a distinct, concrete prompt (not a generalization)", () => {
  const cats = ["mutation_authz", "cors", "cookie_security", "injection", "funnel", "seo", "tls_hsts"];
  const prompts = cats.map((c) => buildFixPrompt(f({ category: c })));
  assert.equal(new Set(prompts).size, prompts.length); // all different
  assert.ok(prompts.every((p) => p.length > 60));
});

test("unknown category falls back to the finding summary (never empty)", () => {
  const p = buildFixPrompt(f({ category: "mystery", summary: "do the thing" }));
  assert.match(p, /do the thing/);
});

test("fix-these-3 returns the top 3 by severity, criticals first", () => {
  const findings = [
    f({ title: "med", severity: "medium" }),
    f({ title: "crit", severity: "critical" }),
    f({ title: "verify", severity: "needs verification" }),
    f({ title: "high", severity: "high" }),
  ];
  const top = fixTheseThree(findings);
  assert.equal(top.length, 3);
  assert.deepEqual(top.map((t) => t.title), ["crit", "high", "med"]);
});
