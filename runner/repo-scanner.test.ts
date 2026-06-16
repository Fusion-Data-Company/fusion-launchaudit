import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { extractApiMethods } from "./repo-scanner.ts";

// These assert against the platform's own API handlers, which are the exact
// shapes that previously produced write-authz false positives. The scanner must
// read each handler's real `request.method` guards, not assume GET+POST.
const root = path.resolve(import.meta.dirname, "..");
const api = (p: string) => path.join(root, "server/api-src", p);

test("GET-only default handler is not flagged as accepting POST", async () => {
  assert.deepEqual((await extractApiMethods(api("campaign.ts"))).sort(), ["GET"]);
});

test("dual GET/POST handler reports both verbs", async () => {
  assert.deepEqual((await extractApiMethods(api("campaigns.ts"))).sort(), ["GET", "POST"]);
});

test("POST-only handlers report only POST", async () => {
  assert.deepEqual((await extractApiMethods(api("runner/sync.ts"))).sort(), ["POST"]);
  assert.deepEqual((await extractApiMethods(api("storage/register-artifact.ts"))).sort(), ["POST"]);
});
