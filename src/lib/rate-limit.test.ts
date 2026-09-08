import { test } from "node:test";
import assert from "node:assert/strict";
import { consumeAttempt, clientIp, _resetRateLimits } from "./rate-limit.ts";

test("consumeAttempt allows up to the limit inside a window and refuses after", () => {
  _resetRateLimits();
  const t0 = 1_000_000;
  for (let i = 0; i < 3; i++) assert.equal(consumeAttempt({ scope: "t", key: "a", limit: 3, windowMs: 60_000, now: t0 + i }).ok, true);
  const r = consumeAttempt({ scope: "t", key: "a", limit: 3, windowMs: 60_000, now: t0 + 10 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.retryAfterSec >= 59 && r.retryAfterSec <= 60);
  // other keys and scopes are independent
  assert.equal(consumeAttempt({ scope: "t", key: "b", limit: 3, windowMs: 60_000, now: t0 }).ok, true);
  assert.equal(consumeAttempt({ scope: "u", key: "a", limit: 3, windowMs: 60_000, now: t0 }).ok, true);
  // window rolls over
  assert.equal(consumeAttempt({ scope: "t", key: "a", limit: 3, windowMs: 60_000, now: t0 + 60_001 }).ok, true);
});

test("clientIp reads the first forwarded hop", () => {
  assert.equal(clientIp({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }), "203.0.113.9");
  assert.equal(clientIp({ "x-real-ip": "198.51.100.2" }), "198.51.100.2");
  assert.equal(clientIp({}), "unknown");
  assert.equal(clientIp(undefined), "unknown");
});
