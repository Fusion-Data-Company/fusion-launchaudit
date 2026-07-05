import { test } from "node:test";
import assert from "node:assert/strict";
import { generateDatabase, databasePresent } from "./database.ts";
import { Counter, type AuditHints } from "./types.ts";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const crawl = {} as unknown as RuntimeCrawl;
const scanWith = (over: Record<string, unknown>): RepoScan => (over as unknown as RepoScan);

test("database: absent database -> no cards, databasePresent() false", () => {
  const scan = scanWith({ repo_summary: { framework: "vite", env_keys_present: [] }, detail: { framework_evidence: [] } });
  assert.equal(databasePresent(scan, {}), false);
  assert.equal(generateDatabase(scan, crawl, {}, new Counter()).length, 0);
});

test("database: framework evidence of an ORM makes it present and emits one ready + five blocked cards", () => {
  const scan = scanWith({ repo_summary: { framework: "next drizzle", env_keys_present: [] }, detail: { framework_evidence: [] } });
  assert.equal(databasePresent(scan, {}), true);
  const cards = generateDatabase(scan, crawl, {}, new Counter());
  assert.equal(cards.length, 6);
  assert.equal(cards.filter((c) => c.status === "ready").length, 1);
  assert.equal(cards.filter((c) => c.status === "blocked").length, 5);
});

test("database: the HTTP-testable card asserts no connection string is shipped to the client", () => {
  const scan = scanWith({ repo_summary: { framework: "app", env_keys_present: ["DATABASE_URL"] }, detail: { framework_evidence: [] } });
  assert.equal(databasePresent(scan, {}), true);
  const ready = generateDatabase(scan, crawl, {}, new Counter()).find((c) => c.status === "ready")!;
  assert.equal(ready.category, "secrets_exposure");
  const excludes = (ready.exec[0] as Record<string, unknown>).expectBodyExcludesCI as string[];
  assert.ok(excludes.includes("postgres://") && excludes.includes("DATABASE_URL"));
});

test("database: presence can also be forced via a hints.database flag", () => {
  const scan = scanWith({ repo_summary: { framework: "vite", env_keys_present: [] }, detail: { framework_evidence: [] } });
  const hints = { database: true } as unknown as AuditHints;
  assert.equal(databasePresent(scan, hints), true);
});
