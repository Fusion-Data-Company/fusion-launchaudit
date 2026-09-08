import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractSupabase, extractFirebase, findClientSecrets, findPlaceholders,
  runVibeChecks, COMMON_TABLES, type Grab,
} from "./vibe-checks.ts";

// A real Supabase anon JWT has a base64url payload with "role":"anon".
function anonJwt(role = "anon") {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ role, iss: "supabase", ref: "abcdefgh" })).toString("base64url");
  return `${header}.${payload}.c2lnbmF0dXJlLXZhbHVl`;
}

test("extractSupabase finds the project URL + anon key, ignores a random JWT", () => {
  const key = anonJwt("anon");
  const html = `<script>const c = createClient("https://abcdefgh.supabase.co", "${key}")</script>`;
  const got = extractSupabase(html);
  assert.ok(got);
  assert.equal(got.url, "https://abcdefgh.supabase.co");
  assert.equal(got.anonKey, key);
  // No supabase URL => null even with a JWT present
  assert.equal(extractSupabase(`token ${key}`), null);
});

test("extractFirebase pulls databaseURL and projectId", () => {
  const cfg = `firebaseConfig={databaseURL:"https://demo-app.firebaseio.com",projectId:"demo-app"}`;
  const got = extractFirebase(cfg);
  assert.ok(got);
  assert.equal(got.databaseURL, "https://demo-app.firebaseio.com");
  assert.equal(got.projectId, "demo-app");
  assert.equal(extractFirebase("nothing here"), null);
});

test("findClientSecrets flags secret keys as critical, test publishable as medium, ignores pk_live", () => {
  const secrets = findClientSecrets("a=sk_live_ABCDEFGH12345678 b=pk_test_ABCDEFGH12345678 c=pk_live_SHOULDBEFINE1234");
  const kinds = secrets.map((s) => s.kind);
  assert.ok(kinds.some((k) => /sk_live/.test(k)));
  assert.ok(kinds.some((k) => /TEST publishable/.test(k)));
  assert.ok(!kinds.some((k) => /pk_live/.test(k)));
  assert.equal(secrets.find((s) => /sk_live/.test(s.kind))?.sev, "critical");
});

test("findPlaceholders detects scaffold copy in visible text only", () => {
  const html = `<h1>Your Company</h1><p>Lorem ipsum dolor</p><script>var x="ignore lorem in code only if not visible"</script>`;
  const hits = findPlaceholders(html);
  assert.ok(hits.includes("your company"));
  assert.ok(hits.includes("lorem ipsum"));
});

test("runVibeChecks reports readable Supabase tables via the anon-key probe", async () => {
  const key = anonJwt("anon");
  const html = `<script src="/app.js"></script><script>createClient("https://proj.supabase.co","${key}")</script>`;
  const grab: Grab = async (url) => {
    if (url.includes("/rest/v1/users")) return new Response(JSON.stringify([{ id: 1, email: "a@b.c" }]), { status: 200, headers: { "content-type": "application/json" } });
    if (url.includes("/rest/v1/")) return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    return new Response("", { status: 404 });
  };
  const res = await runVibeChecks({ origin: new URL("https://proj.example"), html, jsTexts: [], grab });
  const sb = res.findings.find((f) => f.category === "Supabase / RLS");
  assert.ok(sb, "expected a Supabase finding");
  assert.equal(sb.severity, "critical");
  assert.ok(/users/.test(sb.title));
  assert.ok(sb.fix && sb.fix.length > 20, "finding must carry an agent-ready fix");
});

test("runVibeChecks flags an admin API that returns data unauthenticated", async () => {
  const grab: Grab = async (url) => {
    if (url.endsWith("/api/admin/users")) return new Response(JSON.stringify([{ id: 1 }]), { status: 200, headers: { "content-type": "application/json" } });
    return new Response("", { status: 404 });
  };
  const res = await runVibeChecks({ origin: new URL("https://x.example"), html: "<html><body>home</body></html>", jsTexts: [], grab });
  const admin = res.findings.find((f) => f.category === "Access control");
  assert.ok(admin);
  assert.equal(admin.severity, "critical");
  assert.ok(admin.fix.includes("401/403"));
});

test("runVibeChecks stays clean on a plain page (all passed, no findings)", async () => {
  const grab: Grab = async () => new Response("", { status: 404 });
  const res = await runVibeChecks({ origin: new URL("https://clean.example"), html: "<html lang=en><body><h1>Real product</h1></body></html>", jsTexts: [], grab });
  assert.equal(res.findings.length, 0);
  assert.ok(res.passed >= 6);
});

test("COMMON_TABLES includes the tables an AI builder scaffolds", () => {
  for (const t of ["users", "profiles", "orders"]) assert.ok(COMMON_TABLES.includes(t));
});
