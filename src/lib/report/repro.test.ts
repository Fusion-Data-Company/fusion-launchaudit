import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRepro, parseStep } from "./repro.ts";

test("http step → a runnable curl with method + full URL", () => {
  const r = buildRepro({ appUrl: "https://ex.test", step: { action: "http", method: "GET", path: "/api/users/1" } });
  assert.ok(r.includes("curl -i -X GET 'https://ex.test/api/users/1'"));
});

test("cookie value is REDACTED — a session token never rides into the report", () => {
  const r = buildRepro({ appUrl: "https://ex.test", step: { action: "http", method: "GET", path: "/admin", cookie: "session=supersecretvalue" } });
  assert.ok(r.includes("<REDACTED_SESSION>"));
  assert.ok(!r.includes("supersecretvalue"));
});

test("POST with a body renders content-type + --data", () => {
  const r = buildRepro({ appUrl: "https://ex.test", step: { action: "http", method: "POST", path: "/api/x", body: { role: "admin" } } });
  assert.ok(r.includes("-X POST"));
  assert.ok(r.includes("content-type: application/json"));
  assert.ok(r.includes('--data') && r.includes('"role":"admin"'));
});

test("two_identity → a comparable admin-vs-anon curl pair, both redacted", () => {
  const r = buildRepro({ appUrl: "https://ex.test", step: { action: "two_identity", path: "/admin" } });
  assert.ok(r.includes("admin baseline"));
  assert.ok(r.includes("anonymous"));
  assert.ok(r.includes("<REDACTED_ADMIN>"));
});

test("observed transcript slice is included and cookie-redacted", () => {
  const r = buildRepro({ appUrl: "https://ex.test", step: { action: "http", method: "GET", path: "/x" }, httpEvidence: "GET /x -> 200\nCookie: leakyvalue; other" });
  assert.ok(r.includes("# Observed:"));
  assert.ok(!r.includes("leakyvalue"));
});

test("trace path is surfaced with the show-trace hint", () => {
  const r = buildRepro({ appUrl: "https://ex.test", step: { action: "http", path: "/x" }, tracePath: "/out/trace.zip" });
  assert.ok(r.includes("/out/trace.zip"));
  assert.ok(r.includes("show-trace"));
});

test("a repro is NEVER empty, even with no step", () => {
  const r = buildRepro({ appUrl: "https://ex.test" });
  assert.ok(r.trim().length > 0);
  assert.ok(r.includes("reverify"));
});

test("parseStep tolerates garbage and returns the object for valid JSON", () => {
  assert.equal(parseStep("not json"), undefined);
  assert.equal(parseStep(undefined), undefined);
  assert.deepEqual(parseStep('{"action":"http","path":"/x"}'), { action: "http", path: "/x" });
});
