/**
 * Self-contained test for the completeness / anti-fake static analyzer.
 *
 * Builds a tiny temp fixture with KNOWN planted fakes (TODO, lorem ipsum, a
 * not-implemented throw, a hardcoded-array API handler, a dead onClick, a mock
 * import, an unwired form, an undeclared env var) AND known-good files, runs
 * scanCompleteness, asserts every planted fake is caught and the good files are
 * NOT flagged (false-positive guard).
 *
 * Run:  node --experimental-strip-types src/lib/completeness/scan.test.ts
 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { scanCompleteness, type CompletenessFinding } from "./scan.ts";

let failures = 0;
let passes = 0;

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    passes += 1;
    console.log(`PASS  ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Did we catch a finding of `kind` in `file` (optionally on a specific line)? */
function caught(findings: CompletenessFinding[], kind: string, file: string, line?: number): boolean {
  return findings.some((f) => f.kind === kind && f.file === file && (line === undefined || f.line === line));
}

/** Any finding at all in this file? (used for false-positive guard) */
function anyIn(findings: CompletenessFinding[], file: string): CompletenessFinding[] {
  return findings.filter((f) => f.file === file);
}

async function writeFixture(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cmp-fixture-"));
  await fs.mkdir(path.join(dir, "api"), { recursive: true });

  // ---- KNOWN FAKES -------------------------------------------------------

  // 1) a not-implemented throw inside a route handler
  await fs.writeFile(path.join(dir, "api", "users.ts"),
`export async function GET(req: Request) {
  // fetch users from db
  throw new Error("not implemented yet");
}
`);

  // 2) a hardcoded-array API handler (fake data served as real)
  await fs.writeFile(path.join(dir, "api", "products.ts"),
`export async function GET() {
  return Response.json([
    { id: 1, name: "Widget", price: 9.99 },
    { id: 2, name: "Gadget", price: 19.5 },
  ]);
}
`);

  // 3) a TODO marker
  await fs.writeFile(path.join(dir, "todo-marker.ts"),
`export function computeTotal(items: number[]) {
  // TODO: apply tax and discounts before shipping
  return items.reduce((a, b) => a + b, 0);
}
`);

  // 4) lorem ipsum + dead onClick + unwired form in a page component
  await fs.writeFile(path.join(dir, "page.tsx"),
`export default function Page() {
  return (
    <main>
      <h1>About</h1>
      <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
      <button onClick={() => {}}>Save</button>
      <a href="#">Learn more</a>
      <form>
        <input name="email" />
        <button type="submit">Subscribe</button>
      </form>
    </main>
  );
}
`);

  // 5) a runtime file importing a mock-data module
  await fs.writeFile(path.join(dir, "dashboard.ts"),
`import { stats } from "./data/mock-stats.ts";
export function load() { return stats; }
`);

  // 6) a console.log-only handler
  await fs.writeFile(path.join(dir, "handlers.ts"),
`export function handleDelete(id: string) {
  console.log("delete", id);
}
`);

  // 7) an env var referenced but never declared (no .env declares it)
  await fs.writeFile(path.join(dir, "mailer.ts"),
`export function send() {
  const key = process.env.SENDGRID_API_KEY;
  return key;
}
`);

  // ---- KNOWN GOOD (must NOT be flagged) ----------------------------------

  // Real API handler that reads a data layer and returns it.
  await fs.writeFile(path.join(dir, "api", "orders.ts"),
`import { db } from "../db.ts";
export async function GET() {
  const rows = await db.query("select * from orders");
  return Response.json(rows);
}
export async function POST(req: Request) {
  const body = await req.json();
  if (typeof body.qty !== "number") {
    return Response.json({ error: "qty must be a number" }, { status: 400 });
  }
  const saved = await db.insert(body);
  return Response.json(saved);
}
`);

  // A real db helper.
  await fs.writeFile(path.join(dir, "db.ts"),
`export const db = {
  async query(sql: string) { return []; },
  async insert(row: unknown) { return row; },
};
`);

  // A finished page component with a wired form + real handler + real link.
  await fs.writeFile(path.join(dir, "good-page.tsx"),
`import { useState } from "react";
export default function Contact() {
  const [name, setName] = useState("");
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/contact", { method: "POST", body: JSON.stringify({ name }) });
  }
  return (
    <form onSubmit={handleSubmit}>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button type="submit">Send</button>
      <a href="/pricing">See pricing</a>
    </form>
  );
}
`);

  // A health endpoint returning a trivial status object (must NOT be "fake data").
  await fs.writeFile(path.join(dir, "api", "health.ts"),
`export async function GET() {
  return Response.json({ ok: true });
}
`);

  // A file that uses a runtime-provided env var (NODE_ENV) — must NOT be a gap.
  await fs.writeFile(path.join(dir, "config.ts"),
`export const isProd = process.env.NODE_ENV === "production";
`);

  // A declared env var (in .env.example) used in code — must NOT be a gap.
  await fs.writeFile(path.join(dir, ".env.example"), `DATABASE_URL=\nPUBLIC_BASE_URL=\n`);
  await fs.writeFile(path.join(dir, "declared-env.ts"),
`export const url = process.env.DATABASE_URL;
`);

  // A test/spec file with a stub + lorem — must be ignored entirely.
  await fs.writeFile(path.join(dir, "thing.test.ts"),
`it("todo: write this test", () => {
  // TODO: implement
  throw new Error("not implemented");
});
`);

  return dir;
}

async function main() {
  const dir = await writeFixture();
  const findings = await scanCompleteness(dir);

  console.log(`\n--- scanned fixture, ${findings.length} findings ---\n`);

  // ===== planted fakes are CAUGHT =====
  check("catches not-implemented throw in api/users.ts", caught(findings, "stub-throw", path.join("api", "users.ts")));
  check("catches hardcoded-array API data in api/products.ts", caught(findings, "hardcoded-api-data", path.join("api", "products.ts")));
  check("catches TODO marker in todo-marker.ts", caught(findings, "todo-marker", "todo-marker.ts"));
  check("catches lorem ipsum in page.tsx", caught(findings, "lorem-ipsum", "page.tsx"));
  check("catches dead onClick in page.tsx", caught(findings, "dead-handler", "page.tsx"));
  check("catches dead href=\"#\" in page.tsx", caught(findings, "dead-link", "page.tsx"));
  check("catches unwired <form> in page.tsx", caught(findings, "unwired-form", "page.tsx"));
  check("catches mock-data import in dashboard.ts", caught(findings, "mock-import", "dashboard.ts"));
  check("catches console.log-only handler in handlers.ts", caught(findings, "log-only-handler", "handlers.ts"));
  check("catches undeclared env var in mailer.ts", caught(findings, "env-wiring-gap", "mailer.ts"));

  // confidence honesty: not-implemented throw inside a handler is HIGH
  const throwF = findings.find((f) => f.kind === "stub-throw" && f.file === path.join("api", "users.ts"));
  check("not-implemented throw is tagged high confidence", throwF?.confidence === "high", `got ${throwF?.confidence}`);
  // a bare TODO is medium confidence
  const todoF = findings.find((f) => f.kind === "todo-marker" && f.file === "todo-marker.ts");
  check("bare TODO is tagged medium confidence", todoF?.confidence === "medium", `got ${todoF?.confidence}`);
  // lorem ipsum is high
  const loremF = findings.find((f) => f.kind === "lorem-ipsum");
  check("lorem ipsum is tagged high confidence", loremF?.confidence === "high", `got ${loremF?.confidence}`);

  // every finding carries file:line + snippet + explanation
  check("every finding has line > 0", findings.every((f) => f.line > 0));
  check("every finding has a non-empty snippet", findings.every((f) => f.snippet.trim().length > 0));
  check("every finding has a plain-English explain", findings.every((f) => f.explain.trim().length > 12));
  check("every finding has a stable id", findings.every((f) => /^CMP-/.test(f.id)));

  // ===== FALSE-POSITIVE GUARD: good files are NOT flagged =====
  const orders = anyIn(findings, path.join("api", "orders.ts"));
  check("real db-backed api/orders.ts is NOT flagged", orders.length === 0, orders.map((f) => f.kind).join(","));
  const dbf = anyIn(findings, "db.ts");
  check("real db.ts helper is NOT flagged", dbf.length === 0, dbf.map((f) => f.kind).join(","));
  const goodPage = anyIn(findings, "good-page.tsx");
  check("finished good-page.tsx is NOT flagged", goodPage.length === 0, goodPage.map((f) => `${f.kind}@${f.line}`).join(","));
  const health = anyIn(findings, path.join("api", "health.ts"));
  check("trivial health endpoint is NOT flagged as fake data", !caught(findings, "hardcoded-api-data", path.join("api", "health.ts")), health.map((f) => f.kind).join(","));
  const config = anyIn(findings, "config.ts");
  check("NODE_ENV usage is NOT flagged as env gap", !caught(findings, "env-wiring-gap", "config.ts"), config.map((f) => f.kind).join(","));
  const declaredEnv = anyIn(findings, "declared-env.ts");
  check("declared DATABASE_URL usage is NOT flagged as env gap", declaredEnv.length === 0, declaredEnv.map((f) => f.kind).join(","));
  const testFile = anyIn(findings, "thing.test.ts");
  check("test/spec file is ignored entirely", testFile.length === 0, testFile.map((f) => f.kind).join(","));

  // cleanup
  await fs.rm(dir, { recursive: true, force: true });

  console.log(`\n=== SUMMARY: ${passes} passed, ${failures} failed (of ${passes + failures}) ===`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("TEST CRASHED:", e);
  process.exit(1);
});
