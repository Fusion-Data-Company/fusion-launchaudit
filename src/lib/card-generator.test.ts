import { test } from "node:test";
import assert from "node:assert/strict";
import { generateTestCards } from "./card-generator.ts";
import type { RepoScan, ScannedRoute } from "../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../runner/crawler.ts";

const baseCrawl = (over: Partial<RuntimeCrawl> = {}): RuntimeCrawl =>
  ({ app_url: "https://x", reachable: true, title: "X", links: [], form_count: 0,
     button_count: 0, has_password_field: false, console_errors_on_load: 0,
     crawled_at: "now", ...over } as RuntimeCrawl);
const route = (p: Partial<ScannedRoute>): ScannedRoute =>
  ({ file: "f", url_path: "/api/x", kind: "api", methods: ["POST"], privileged: false, ...p });
const scanWith = (routes: ScannedRoute[], envMissing: string[] = []): RepoScan =>
  ({ detail: { routes }, repo_summary: { env_keys_missing: envMissing } } as unknown as RepoScan);

const ids = (cards: { id: string }[]) => cards.map((c) => c.id);

test("a privileged page route derives an admin/RBAC card without a hints file", () => {
  const cards = generateTestCards(scanWith([route({ kind: "page", url_path: "/admin/users", methods: ["GET"], privileged: true })]), baseCrawl());
  assert.ok(ids(cards).some((id) => id.startsWith("TC-ADM")), "expected an admin card from a privileged page");
});

test("a mutating API route derives both a backend (malformed-input) and a write-authz card", () => {
  const cards = generateTestCards(scanWith([route({ url_path: "/api/orders", methods: ["POST"] })]), baseCrawl());
  assert.ok(ids(cards).some((id) => id.startsWith("TC-WA")), "expected a write-authz card");
  assert.ok(ids(cards).some((id) => id.startsWith("TC-BE")), "expected a backend card");
});

test("a detected login with no captured roles produces an honest BLOCKED card (declared, not skipped)", () => {
  const cards = generateTestCards(null, baseCrawl({ has_password_field: true }));
  const blocked = cards.find((c) => c.status === "blocked" && c.category === "auth");
  assert.ok(blocked, "expected a blocked authenticated-role-coverage card");
});

test("missing env keys surface as an honest BLOCKED integration card, not a silent pass", () => {
  const cards = generateTestCards(scanWith([], ["STRIPE_SECRET_KEY", "OPENAI_API_KEY"]), baseCrawl());
  const blocked = cards.find((c) => c.status === "blocked" && c.id.startsWith("TC-BE"));
  assert.ok(blocked, "expected a blocked integration card naming the missing keys");
  assert.match(blocked!.acceptanceCriteria, /STRIPE_SECRET_KEY/);
});
