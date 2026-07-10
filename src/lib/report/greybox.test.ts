import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGuardIndex, sourceConfirmsMissingGuard, cardPath } from "./greybox.ts";
import type { ScannedRoute } from "../../../runner/repo-scanner.ts";

const R = (over: Partial<ScannedRoute>): ScannedRoute => ({ file: "f.ts", url_path: "/", kind: "api", methods: ["GET"], privileged: false, ...over });

test("buildGuardIndex records guard presence per API/privileged route", () => {
  const routes = [
    R({ file: "api/admin.ts", url_path: "/api/admin", kind: "api" }),
    R({ file: "pages/home.ts", url_path: "/", kind: "page", privileged: false }), // skipped (not api, not privileged)
    R({ file: "pages/admin.ts", url_path: "/admin", kind: "page", privileged: true }),
  ];
  const guards: Record<string, boolean> = { "api/admin.ts": false, "pages/admin.ts": true };
  const index = buildGuardIndex(routes, (f) => guards[f]);
  const byPath = Object.fromEntries(index.map((e) => [e.path, e.hasGuard]));
  assert.equal(byPath["/api/admin"], false);
  assert.equal(byPath["/admin"], true);
  assert.ok(!("/" in byPath)); // the non-privileged page was skipped
});

test("unreadable files are omitted, not guessed", () => {
  const index = buildGuardIndex([R({ file: "x.ts", url_path: "/api/x" })], () => undefined);
  assert.equal(index.length, 0);
});

test("sourceConfirmsMissingGuard matches with id-segment normalization", () => {
  const index = buildGuardIndex([R({ file: "u.ts", url_path: "/admin/users/1", kind: "api" })], () => false);
  // Runtime probed /admin/users/42 — should match the /admin/users/1 route.
  const hit = sourceConfirmsMissingGuard("/admin/users/42", index);
  assert.ok(hit);
  assert.equal(hit!.file, "u.ts");
});

test("a guarded route does NOT confirm a missing guard", () => {
  const index = buildGuardIndex([R({ file: "g.ts", url_path: "/api/admin", kind: "api" })], () => true);
  assert.equal(sourceConfirmsMissingGuard("/api/admin", index), null);
});

test("cardPath pulls the path from the first exec step", () => {
  assert.equal(cardPath({ exec: [{ action: "http", path: "/api/x" }] }), "/api/x");
  assert.equal(cardPath({ exec: [{ action: "two_identity", path: "/admin" }] }), "/admin");
  assert.equal(cardPath({ exec: [] }), undefined);
});
