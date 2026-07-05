import { test } from "node:test";
import assert from "node:assert/strict";
import { generateCors } from "./cors.ts";
import { Counter, type AuditHints } from "./types.ts";
import type { RepoScan, ScannedRoute } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const crawl = {} as unknown as RuntimeCrawl;
const scanWith = (routes: ScannedRoute[]): RepoScan => ({ detail: { routes } } as unknown as RepoScan);
const route = (p: Partial<ScannedRoute>): ScannedRoute =>
  ({ file: "f", url_path: "/api/x", kind: "api", methods: ["GET"], privileged: false, ...p });

test("cors: always probes '/' with a hostile Origin and a credential-reflection assertion", () => {
  const cards = generateCors(null, crawl, {}, new Counter());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].category, "cors");
  const step = cards[0].exec[0] as Record<string, unknown>;
  assert.equal(step.corsProbeOrigin, "https://launchaudit-cors-probe.example");
  assert.equal(step.method, "GET");
});

test("cors: hinted protected/post APIs and scanned api routes add probe paths (deduped, capped at 8)", () => {
  const hints: AuditHints = { protectedApis: [{ path: "/api/admin" }], postEndpoints: [{ path: "/api/lead" }] };
  const scan = scanWith([route({ url_path: "/api/orders" }), route({ url_path: "/page", kind: "page" })]);
  const cards = generateCors(scan, crawl, hints, new Counter());
  const paths = cards.map((c) => (c.exec[0] as Record<string, unknown>).path);
  assert.ok(paths.includes("/"));
  assert.ok(paths.includes("/api/admin"));
  assert.ok(paths.includes("/api/lead"));
  assert.ok(paths.includes("/api/orders"));
  assert.ok(!paths.includes("/page"), "non-api scanned routes are not probed");
  assert.ok(cards.length <= 8);
});
