import { test } from "node:test";
import assert from "node:assert/strict";
import { isClientShellBody } from "./execute-core.ts";

// A client-rendered SPA serves the SAME shell for every route; HTTP can't see
// the client-side guard, so these must be recognized to avoid false "exposed"
// findings on the (very common) SPA case.
const home = '<!doctype html><html><head><title>App</title></head><body><div id="root"></div><script src="/assets/index.js"></script></body></html>';

test("identical shell served for an admin route is a client shell", () => {
  assert.equal(isClientShellBody(home, home), true);
});

test("a different-but-empty mount (id=app) with little text is a client shell", () => {
  const adminShell = '<!doctype html><html><head><title>Admin</title></head><body><div id="app"></div></body></html>';
  assert.equal(isClientShellBody(adminShell, home), true);
});

test("real server-rendered admin content (substantial text, no empty mount, differs from home) is NOT a shell", () => {
  const rows = Array.from({ length: 80 }, (_, i) => `<tr><td>user${i}</td><td>user${i}@example.com</td><td>admin</td></tr>`).join("");
  const realAdmin = `<!doctype html><html><head><title>Admin</title></head><body><h1>Admin Dashboard</h1><table>${rows}</table></body></html>`;
  assert.equal(isClientShellBody(realAdmin, home), false);
});

test("with no homepage to compare, a page full of real content is not flagged as a shell", () => {
  const realAdmin = "<html><body><h1>Admin</h1>" + "x ".repeat(2000) + "</body></html>";
  assert.equal(isClientShellBody(realAdmin, ""), false);
});
