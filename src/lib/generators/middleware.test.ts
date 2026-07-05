import { test } from "node:test";
import assert from "node:assert/strict";
import { generateMiddleware } from "./middleware.ts";
import { Counter, type AuditHints } from "./types.ts";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const scan = null as unknown as RepoScan | null;
const crawl = (appUrl: string): RuntimeCrawl => ({ app_url: appUrl } as unknown as RuntimeCrawl);

test("middleware: default '/' path gets a security-headers card asserting the three core headers", () => {
  const cards = generateMiddleware(scan, crawl("https://x.test"), {}, new Counter());
  const hdr = cards.find((c) => c.title.startsWith("Security headers present"));
  assert.ok(hdr);
  assert.equal(hdr!.category, "integration_side_effects");
  assert.deepEqual((hdr!.exec[0] as Record<string, unknown>).expectHeaderPresent, ["x-frame-options", "x-content-type-options", "content-security-policy"]);
});

test("middleware: one header card per hinted securityPath", () => {
  const hints: AuditHints = { securityPaths: ["/", "/admin", "/dashboard"] };
  const cards = generateMiddleware(scan, crawl("https://x.test"), hints, new Counter());
  assert.equal(cards.filter((c) => c.title.startsWith("Security headers present")).length, 3);
});

test("middleware: HSTS card added on https, omitted on http", () => {
  const https = generateMiddleware(scan, crawl("https://x.test"), {}, new Counter());
  assert.ok(https.some((c) => c.title === "HSTS enabled on HTTPS"));
  const http = generateMiddleware(scan, crawl("http://localhost:3000"), {}, new Counter());
  assert.ok(!http.some((c) => c.title === "HSTS enabled on HTTPS"));
});
