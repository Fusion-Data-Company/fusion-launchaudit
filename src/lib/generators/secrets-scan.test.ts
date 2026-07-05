import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scanTextForSecrets, generateSecretsScan } from "./secrets-scan.ts";
import { classifyFailure } from "../../../runner/classify.ts";
import { Counter } from "./types.ts";

// minimal scan/crawl stand-ins (types are stripped at runtime)
const crawl = {} as never;
const scanWith = (repoPath?: string) => (repoPath ? ({ detail: { repo_path: repoPath } } as never) : null);

// A repo with a .env-ignoring .gitignore so the .env-coverage rules stay quiet in tests
// that only want to assert the in-file pattern behaviour.
function tmpRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "secrets-"));
  fs.writeFileSync(path.join(dir, ".gitignore"), ".env\n.env.*\nnode_modules\n");
  return dir;
}

test("generateSecretsScan → blocked with no repo", () => {
  const cards = generateSecretsScan(null, crawl, {}, new Counter());
  assert.equal(cards[0].status, "blocked");
  assert.equal(cards[0].category, "secret_exposure");
});

test("scanTextForSecrets detects a planted AWS key, knownFormat true, and REDACTS it", () => {
  const planted = "AKIAIOSFODNN7EXAMPLE";
  const hits = scanTextForSecrets(`const key = "${planted}";`, "config.ts");
  const aws = hits.find((h) => h.rule === "aws-access-key");
  assert.ok(aws, "expected an aws-access-key hit");
  assert.equal(aws!.knownFormat, true);
  assert.equal(aws!.line, 1);
  // Redaction: the preview must be first4…last4 and must NOT contain the full secret.
  assert.equal(aws!.preview, "AKIA…MPLE");
  assert.ok(!aws!.preview.includes(planted), "preview must not contain the full key");
  for (const h of hits) assert.ok(!h.preview.includes(planted), "no hit may carry the raw secret");
});

test("generateSecretsScan → ready card carrying a secret_scan exec step that finds the planted key (redacted)", () => {
  const dir = tmpRepo();
  const planted = "AKIAIOSFODNN7EXAMPLE";
  fs.writeFileSync(path.join(dir, "settings.ts"), `export const AWS = "${planted}";\n`);
  const cards = generateSecretsScan(scanWith(dir), crawl, {}, new Counter());
  assert.equal(cards[0].status, "ready");
  assert.equal(cards[0].category, "secret_exposure");
  const step = cards[0].exec[0] as { action: string; hits: Array<{ file: string; rule: string; preview: string; knownFormat: boolean }> };
  assert.equal(step.action, "secret_scan");
  const aws = step.hits.find((h) => h.rule === "aws-access-key");
  assert.ok(aws && aws.file === "settings.ts" && aws.knownFormat === true);
  // Nothing in the entire exec payload may contain the raw secret.
  assert.ok(!JSON.stringify(step.hits).includes(planted), "exec payload must be fully redacted");
});

test("entropy gate drops a low-entropy generic match but keeps a high-entropy one", () => {
  // Low entropy (repeated chars) — must be dropped.
  const low = scanTextForSecrets(`password = "aaaaaaaaaaaaaaaaaa"`, "a.txt");
  assert.equal(low.filter((h) => h.rule === "generic-high-entropy").length, 0);
  // High entropy random-looking value — must be kept (and redacted).
  const high = scanTextForSecrets(`api_key = "Zx9Qw3Vb7Lm2Pk8Rt5Yn1Uo4Hs6Df"`, "b.txt");
  const g = high.find((h) => h.rule === "generic-high-entropy");
  assert.ok(g, "expected a high-entropy generic hit");
  assert.equal(g!.knownFormat, false);
  assert.ok(g!.preview.includes("…") && g!.preview.length <= 9, "generic hit must be redacted");
});

test("OpenAI sk- rule does not also fire on a Stripe sk_live_ key", () => {
  // Built at runtime so GitHub push-protection doesn't flag this test vector as a real key.
  const stripe = scanTextForSecrets("sk_live_" + "0123456789abcdef01234567", "s.ts");
  assert.ok(stripe.some((h) => h.rule === "stripe-secret-key"));
  assert.ok(!stripe.some((h) => h.rule === "openai-api-key"), "Stripe key must not classify as OpenAI");
});

test("generateSecretsScan → clean repo yields a ready card with zero hits", () => {
  const dir = tmpRepo();
  fs.writeFileSync(path.join(dir, "index.ts"), `export const greeting = "hello world";\n`);
  fs.writeFileSync(path.join(dir, "README.md"), `# A clean project\nNo secrets here.\n`);
  const cards = generateSecretsScan(scanWith(dir), crawl, {}, new Counter());
  assert.equal(cards[0].status, "ready");
  const step = cards[0].exec[0] as { action: string; hits: unknown[] };
  assert.equal(step.action, "secret_scan");
  assert.equal(step.hits.length, 0, "a clean repo must produce no hits (no false positives)");
});

test("generateSecretsScan flags a committed .env and a missing .gitignore env rule", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "secrets-"));
  // No .gitignore at all + a committed .env => both env rules should fire.
  fs.writeFileSync(path.join(dir, ".env"), "DATABASE_URL=postgres://localhost/db\n");
  const cards = generateSecretsScan(scanWith(dir), crawl, {}, new Counter());
  const step = cards[0].exec[0] as { hits: Array<{ rule: string; knownFormat: boolean }> };
  assert.ok(step.hits.some((h) => h.rule === "committed-dotenv" && h.knownFormat === true));
  assert.ok(step.hits.some((h) => h.rule === "gitignore-missing-env"));
});

test("excluded dirs (node_modules) are not scanned", () => {
  const dir = tmpRepo();
  const nm = path.join(dir, "node_modules", "pkg");
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(path.join(nm, "leak.js"), `const k = "AKIAIOSFODNN7EXAMPLE";\n`);
  const cards = generateSecretsScan(scanWith(dir), crawl, {}, new Counter());
  const step = cards[0].exec[0] as { hits: unknown[] };
  assert.equal(step.hits.length, 0, "a key inside node_modules must be excluded");
});

test("classify: secret_exposure live-format → product_bug; entropy-only → needs_verification", () => {
  const ctx = { appUrl: "https://x", devStubAuth: false };
  const res = (error: string) => ({ card: { category: "secret_exposure" }, error } as never);
  assert.equal(
    classifyFailure(res("2 exposed secrets in tracked files (1 live-format): .env:1 committed-dotenv (.env…file) | settings.ts:2 aws-access-key (AKIA…MPLE)"), ctx).type,
    "product_bug",
  );
  assert.equal(
    classifyFailure(res("1 high-entropy secret-like string in tracked files (entropy-only): b.txt:1 generic-high-entropy (Zx9Q…6Df)"), ctx).type,
    "needs_verification",
  );
});
