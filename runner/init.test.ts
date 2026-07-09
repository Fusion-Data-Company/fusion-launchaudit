import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHintsScaffold } from "./init.ts";
import type { RepoScan, ScannedRoute } from "./repo-scanner.ts";

function scanOf(routes: ScannedRoute[]): RepoScan {
  return {
    repo_summary: {} as RepoScan["repo_summary"],
    detail: {
      repo_path: "/x", scanned_at: "2026-07-09", framework_evidence: [], test_tooling: [], test_file_count: 0,
      route_files_sampled: [], routes, env_sources: [], files_walked: 0, truncated: false,
    },
  };
}

const R = (over: Partial<ScannedRoute>): ScannedRoute => ({ file: "f", url_path: "/", kind: "page", methods: ["GET"], privileged: false, ...over });

test("scaffold always lays down two role slots for the two-identity probe", () => {
  const s = buildHintsScaffold(scanOf([]));
  assert.ok(s.admin_creds && s.user_creds);
  assert.equal(s.admin_creds.username, ""); // never invents a credential
  assert.equal(s.user_creds.password, "");
});

test("privileged pages become protected_routes; login is detected", () => {
  const s = buildHintsScaffold(scanOf([
    R({ url_path: "/admin", privileged: true }),
    R({ url_path: "/admin/users", privileged: true }),
    R({ url_path: "/login" }),
    R({ url_path: "/" }),
  ]));
  assert.deepEqual(s.protected_routes.sort(), ["/admin", "/admin/users"]);
  assert.equal(s.login_path, "/login");
  assert.equal(s.admin_creds.login_path, "/login");
});

test("privileged APIs and their methods land in protected_apis", () => {
  const s = buildHintsScaffold(scanOf([
    R({ url_path: "/api/admin/stats", kind: "api", methods: ["GET"], privileged: true }),
  ]));
  assert.deepEqual(s.protected_apis, [{ path: "/api/admin/stats", method: "GET" }]);
});

test("state-changing endpoints populate write_apis + post_endpoints; GET is not a write", () => {
  const s = buildHintsScaffold(scanOf([
    R({ url_path: "/api/orders", kind: "api", methods: ["GET", "POST"] }),
    R({ url_path: "/api/orders/42", kind: "api", methods: ["DELETE"] }),
    R({ url_path: "/api/health", kind: "api", methods: ["GET"] }),
  ]));
  const writeKeys = s.write_apis.map((w) => `${w.method} ${w.path}`).sort();
  assert.deepEqual(writeKeys, ["DELETE /api/orders/42", "POST /api/orders"]);
  assert.deepEqual(s.post_endpoints, [{ path: "/api/orders" }]);
  // GET /api/health must not appear as a write.
  assert.ok(!s.write_apis.some((w) => w.path === "/api/health"));
});

test("no duplicate path+method pairs", () => {
  const s = buildHintsScaffold(scanOf([
    R({ url_path: "/api/x", kind: "api", methods: ["POST", "POST"], privileged: true }),
  ]));
  assert.equal(s.protected_apis.length, 1);
});
