import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSeoRanking } from "./seo-report.ts";

test("passing ranking checks become 'helps'; failing ones become 'hurts' + a cited fix", () => {
  const r = buildSeoRanking([
    { category: "seo", status: "passed" },
    { category: "performance", status: "failed" },
    { category: "tls_hsts", status: "blocked" },
  ]);
  assert.ok(r.helps.some((h) => /search engines can read/i.test(h)));      // seo passed
  assert.ok(r.hurts.some((h) => /core web vitals/i.test(h)));               // perf failed
  assert.ok(r.fixes.some((f) => f.source.includes("web.dev")));             // perf fix cited
  assert.ok(r.fixes.some((f) => f.source.includes("developers.google.com"))); // tls fix cited
});

test("every fix carries a real source URL (no invented guidance)", () => {
  const r = buildSeoRanking([{ category: "seo", status: "failed" }]);
  assert.ok(r.fixes.length >= 1);
  assert.ok(r.fixes.every((f) => /^https?:\/\//.test(f.source.split("— ")[1] ?? f.source) || f.source.includes("https://")));
});

test("a mixed seo result (some fail) counts as hurting, not helping", () => {
  const r = buildSeoRanking([{ category: "seo", status: "passed" }, { category: "seo", status: "failed" }]);
  assert.ok(r.hurts.some((h) => /title/i.test(h)));
  assert.ok(!r.helps.some((h) => /search engines can read/i.test(h)));
});

test("no ranking-relevant cards -> an honest note, not a fabricated score", () => {
  const r = buildSeoRanking([{ category: "object_authz", status: "passed" }]);
  assert.equal(r.helps.length, 0);
  assert.ok(r.hurts[0].includes("No ranking-relevant checks"));
});
