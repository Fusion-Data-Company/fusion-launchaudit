import { test } from "node:test";
import assert from "node:assert/strict";
import { generateFrontend } from "./frontend.ts";
import { Counter } from "./types.ts";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";

const scan = null as unknown as RepoScan | null;
const crawlOf = (over: Partial<RuntimeCrawl>): RuntimeCrawl =>
  ({ app_url: "https://app.test", title: "t", links: [], form_count: 0, button_count: 0, has_password_field: false, console_errors_on_load: 0, crawled_at: "now", ...over } as RuntimeCrawl);

test("frontend: emits app-shell, responsive, and console cards even with no links", () => {
  const cards = generateFrontend(scan, crawlOf({ links: [] }), {}, new Counter());
  assert.ok(cards.length >= 4);
  assert.ok(cards.some((c) => c.category === "core_workflow"));
  assert.equal(cards.filter((c) => c.category === "responsive_visual").length, 2);
  assert.ok(cards.some((c) => c.category === "console_network"));
});

test("frontend: emits one reachability card per crawled link (capped at 12)", () => {
  const links = Array.from({ length: 20 }, (_, i) => ({ href: `https://app.test/p${i}`, text: `p${i}` }));
  const cards = generateFrontend(scan, crawlOf({ links }), {}, new Counter());
  const reach = cards.filter((c) => c.title.startsWith("Page reachable:"));
  assert.equal(reach.length, 12, "link cards are capped at 12");
  assert.deepEqual((reach[0].exec[0] as Record<string, unknown>).expectStatusNot, [500, 502, 503, 504]);
});

test("frontend: app-shell selector is button-aware when buttons were seen", () => {
  const withBtns = generateFrontend(scan, crawlOf({ button_count: 3 }), {}, new Counter());
  const shell = withBtns[0];
  const visibleStep = shell.exec.find((e) => (e as { action: string }).action === "expect_visible") as { selector: string };
  assert.equal(visibleStep.selector, "button, a, [role=button]");
  const noBtns = generateFrontend(scan, crawlOf({ button_count: 0 }), {}, new Counter());
  const visibleStep2 = noBtns[0].exec.find((e) => (e as { action: string }).action === "expect_visible") as { selector: string };
  assert.equal(visibleStep2.selector, "body");
});
