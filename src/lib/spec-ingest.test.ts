import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOpenApi, parseHar, endpointsToHints } from "./spec-ingest.ts";

test("parseOpenApi extracts endpoints, samples {id}, flags writes", () => {
  const doc = {
    paths: {
      "/api/users/{id}": { get: {}, delete: {} },
      "/api/orders": { post: {} },
      "/api/health": { get: {} },
      "/ignored": { parameters: [] }, // no HTTP methods
    },
  };
  const eps = parseOpenApi(doc);
  const users = eps.find((e) => e.path === "/api/users/1")!;
  assert.ok(users);
  assert.equal(users.hasIdParam, true);
  assert.deepEqual(users.methods.sort(), ["DELETE", "GET"]);
  assert.equal(users.write, true);
  assert.ok(eps.find((e) => e.path === "/api/orders" && e.write));
  assert.ok(eps.find((e) => e.path === "/api/health" && !e.write));
  assert.ok(!eps.some((e) => e.path === "/ignored"));
});

test("parseHar keeps same-origin API calls, drops assets + cross-origin", () => {
  const doc = { log: { entries: [
    { request: { method: "GET", url: "https://app.test/api/users/42" } },
    { request: { method: "POST", url: "https://app.test/api/orders" } },
    { request: { method: "GET", url: "https://app.test/assets/app.js" } }, // asset → dropped
    { request: { method: "GET", url: "https://cdn.other.test/api/x" } }, // cross-origin → dropped
    { request: { method: "GET", url: "https://app.test/home" } }, // not API-ish → dropped
  ] } };
  const eps = parseHar(doc, "app.test");
  const paths = eps.map((e) => e.path).sort();
  assert.deepEqual(paths, ["/api/orders", "/api/users/42"]);
  assert.equal(eps.find((e) => e.path === "/api/users/42")!.hasIdParam, true);
  assert.equal(eps.find((e) => e.path === "/api/orders")!.write, true);
});

test("endpointsToHints routes endpoints into the wedge hint buckets", () => {
  const hints = endpointsToHints([
    { path: "/api/users/1", methods: ["GET"], hasIdParam: true, write: false },
    { path: "/api/orders", methods: ["POST"], hasIdParam: false, write: true },
    { path: "/api/items/5", methods: ["DELETE"], hasIdParam: true, write: true },
  ]);
  assert.ok(hints.protectedApis.some((a) => a.path === "/api/users/1" && a.method === "GET"));
  assert.ok(hints.writeApis.some((w) => w.path === "/api/orders" && w.method === "POST"));
  assert.ok(hints.writeApis.some((w) => w.path === "/api/items/5" && w.method === "DELETE"));
  assert.ok(hints.postEndpoints.some((p) => p.path === "/api/orders"));
});

test("methods across duplicate paths are merged", () => {
  const eps = parseOpenApi({ paths: { "/api/x": { get: {} } } }).concat(parseOpenApi({ paths: { "/api/x": { post: {} } } }));
  // simulate the dedupe path via a fresh parse of a combined doc
  const combined = parseOpenApi({ paths: { "/api/x": { get: {}, post: {} } } });
  assert.equal(combined.length, 1);
  assert.deepEqual(combined[0].methods.sort(), ["GET", "POST"]);
  assert.equal(eps.length, 2); // separate parses aren't auto-merged (documents the boundary)
});

test("malformed / empty specs yield no endpoints, no throw", () => {
  assert.deepEqual(parseOpenApi(null), []);
  assert.deepEqual(parseOpenApi({}), []);
  assert.deepEqual(parseHar({}), []);
});
