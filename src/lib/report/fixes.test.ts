import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFixPrompt, fixTheseThree, hasFixTemplate, type Finding } from "./fixes.ts";

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

// Guard: every category that can surface as a CONFIRMED product bug (and land in the
// self-heal loop's fix_plan) must have a tailored fix template — not the generic fallback.
// Adding a new bug detector without a fix template fails here.
const BUG_PRODUCING_CATEGORIES = [
  "roles_permissions", "auth", "object_authz", "mutation_authz", "mass_assignment",
  "write_authz", "privilege_gradient", "cors", "cookie_security", "tls_hsts", "injection",
  "security_headers", "secrets_exposure", "secret_exposure", "dependency_cve", "data_exposure",
  "supply_chain", "ai_security", "code_smell", "info_disclosure", "api_contract",
  "accessibility", "wcag22", "content_integrity", "funnel", "custom_rule", "seo",
];

test("every bug-producing category has a tailored fix template (self-heal loop quality)", () => {
  const missing = BUG_PRODUCING_CATEGORIES.filter((c) => !hasFixTemplate(c));
  assert.deepEqual(missing, [], `missing fix template(s): ${missing.join(", ")}`);
});

test("the new elite detectors ship specific fix guidance", () => {
  assert.match(buildFixPrompt(f({ category: "supply_chain" })), /Shai-Hulud|typosquat|registry/);
  assert.match(buildFixPrompt(f({ category: "ai_security" })), /LLM|guardrail|prompt/i);
  assert.match(buildFixPrompt(f({ category: "race_condition" })), /race|lock|idempoten|unique constraint/i);
  assert.match(buildFixPrompt(f({ category: "data_exposure" })), /BOPLA|allowlist|DTO|serializer/i);
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
