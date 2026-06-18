import { test } from "node:test";
import assert from "node:assert/strict";
import { generateAdminRbac } from "./admin-rbac.ts";
import { Counter, type AuditHints } from "./types.ts";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const scan = null as unknown as RepoScan | null;
const crawl = {} as unknown as RuntimeCrawl;

// CORS preflight (OPTIONS) returns 200 by design; HEAD is metadata. Neither is a
// privileged action, so neither should become an "admin API exposed" finding.
test("admin-API authz: OPTIONS/HEAD are skipped; real verbs still generate cards", () => {
  const hints: AuditHints = { protectedApis: [
    { path: "/api/admin", method: "OPTIONS" },
    { path: "/api/admin", method: "HEAD" },
    { path: "/api/admin", method: "POST" },
  ] } as AuditHints;
  const titles = generateAdminRbac(scan, crawl, hints, new Counter()).map((c) => c.title).join(" | ");
  assert.ok(!/OPTIONS/.test(titles), "no OPTIONS authz card");
  assert.ok(!/HEAD/.test(titles), "no HEAD authz card");
  assert.ok(/POST \/api\/admin/.test(titles), "real POST card still generated");
});
