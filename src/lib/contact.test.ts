import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../../server/api-src/contact.ts";
import { getSqlClient } from "./db.ts";
import { _resetRateLimits } from "./rate-limit.ts";

type ResponseCapture = { statusCode?: number; body?: unknown };

async function invoke(body: unknown, headers: Record<string, string> = { "x-real-ip": "contact-test" }): Promise<ResponseCapture> {
  const response: ResponseCapture = {};
  const res = {
    status(code: number) { response.statusCode = code; return res; },
    json(value: unknown) { response.body = value; },
  };
  await handler({ method: "POST", headers, body }, res);
  return response;
}

test("contact rejects malformed shapes and bounded fields, then persists a valid typed message", async () => {
  const previousPostgres = process.env.POSTGRES_URL;
  const previousLocalDb = process.env.LAUNCHAUDIT_LOCAL_DB;
  delete process.env.POSTGRES_URL;
  process.env.LAUNCHAUDIT_LOCAL_DB = `/tmp/launchaudit-contact-${process.pid}-${Date.now()}`;
  try {
    for (const body of [
      null,
      { name: 42, email: "buyer@example.com", message: "hello" },
      { email: 42, message: "hello" },
      { email: "buyer@example.com", message: 42 },
      { email: "buyer@example.com", message: "hello", type: 42 },
      { email: "buyer@example.com", message: "hello", type: "not-a-contact-type" },
      { email: "buyer@example.com", message: "x".repeat(5001) },
      { email: "buyer@example.com", name: "x".repeat(201), message: "hello" },
      { email: "x".repeat(321) + "@example.com", message: "hello" },
    ]) {
      _resetRateLimits();
      const response = await invoke(body);
      assert.equal(response.statusCode, 400, JSON.stringify(body));
    }

    _resetRateLimits();
    const valid = await invoke({ name: "  Rob  ", email: " buyer@example.com ", type: "test", message: "  Add a payment refund check.  " });
    assert.deepEqual(valid, { statusCode: 200, body: { ok: true } });

    const sql = await getSqlClient();
    assert.ok(sql);
    const rows = await sql("select name, email, type, message from submissions order by created_at desc limit 1");
    assert.deepEqual(rows, [{ name: "Rob", email: "buyer@example.com", type: "test", message: "Add a payment refund check." }]);
  } finally {
    if (previousPostgres === undefined) delete process.env.POSTGRES_URL;
    else process.env.POSTGRES_URL = previousPostgres;
    if (previousLocalDb === undefined) delete process.env.LAUNCHAUDIT_LOCAL_DB;
    else process.env.LAUNCHAUDIT_LOCAL_DB = previousLocalDb;
    _resetRateLimits();
  }
});

test("contact rate limits repeated requests by client IP", async () => {
  _resetRateLimits();
  const previousPostgres = process.env.POSTGRES_URL;
  const previousLocalDb = process.env.LAUNCHAUDIT_LOCAL_DB;
  delete process.env.POSTGRES_URL;
  delete process.env.LAUNCHAUDIT_LOCAL_DB;
  try {
    for (let i = 0; i < 10; i++) {
      const response = await invoke({ email: "buyer@example.com", message: "hello" });
      assert.notEqual(response.statusCode, 429);
    }
    assert.equal((await invoke({ email: "buyer@example.com", message: "hello" })).statusCode, 429);
  } finally {
    if (previousPostgres === undefined) delete process.env.POSTGRES_URL;
    else process.env.POSTGRES_URL = previousPostgres;
    if (previousLocalDb === undefined) delete process.env.LAUNCHAUDIT_LOCAL_DB;
    else process.env.LAUNCHAUDIT_LOCAL_DB = previousLocalDb;
    _resetRateLimits();
  }
});
