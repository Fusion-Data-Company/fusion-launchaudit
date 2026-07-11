/**
 * vuln-saas — a realistic (not toy) vulnerable SaaS target for proving the ELITE wedge.
 *
 * Unlike buggy-shop's 5 basic bugs, this app has real sessions and the MODERN bug classes
 * the happy-path AI (and most scanners) sail right past. Every bug here is deliberate and
 * documented in BUGS.md. Zero dependencies, Node built-in http only. Listens on :4700.
 *
 * Sessions are deterministic for testability: POST /login sets `session=<username>`, and
 * the app trusts that cookie as the current user. Real apps sign it; this one doesn't —
 * that's not the planted bug, it's just what keeps the fixture reproducible.
 */
const http = require("http");

const PORT = 4700;

// Users + their private data. passwordHash/ssn must NEVER reach a client (they do — bug).
const USERS = {
  alice: { id: 1, name: "Alice", role: "user", passwordHash: "$2b$10$aliceHASHvalue", ssn: "111-11-1111" },
  bob: { id: 2, name: "Bob", role: "user", passwordHash: "$2b$10$bobHASHvalue", ssn: "222-22-2222" },
  admin: { id: 99, name: "Admin", role: "admin", passwordHash: "$2b$10$adminHASH", ssn: "999-99-9999" },
};
// Orders keyed by id. Order 1 belongs to alice, order 2 to bob.
const ORDERS = {
  1: { id: 1, owner: "alice", item: "Enterprise Plan", total: 499, card_number: "4111-1111-1111-1111", ownerData: USERS.alice },
  2: { id: 2, owner: "bob", item: "Starter Plan", total: 49, card_number: "4222-2222-2222-2222", ownerData: USERS.bob },
};

function currentUser(req) {
  const cookie = req.headers.cookie || "";
  const m = cookie.match(/session=([a-zA-Z0-9]+)/);
  return m && USERS[m[1]] ? m[1] : null;
}
function send(res, status, body, headers = {}) {
  // NOTE: no security headers set anywhere — deliberate (security_headers bug).
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const p = url.pathname;
  const user = currentUser(req);

  // --- Auth -----------------------------------------------------------------
  if (p === "/login" && req.method === "GET") {
    return send(res, 200, `<!doctype html><html><head><title>Login</title></head><body>
      <form method="POST" action="/login">
        <input name="username" type="text" autocomplete="username">
        <input name="password" type="password" autocomplete="current-password">
        <button type="submit">Sign in</button>
      </form></body></html>`, { "content-type": "text/html" });
  }
  if (p === "/login" && req.method === "POST") {
    const body = await readBody(req);
    // Also accept form-encoded (browser form post) — parse crudely.
    let username = body.username;
    if (!username && req.headers["content-type"]?.includes("form")) {
      // (fallback for real form posts handled below via raw parse)
    }
    const uname = username || "alice";
    return send(res, 200, { ok: true }, { "set-cookie": `session=${uname}; Path=/` });
  }

  // --- BUG: broken RBAC + privilege gradient --------------------------------
  // /admin renders the full admin dashboard to ANYONE (anon, user, admin all identical).
  if (p === "/admin") {
    return send(res, 200, `<!doctype html><html><head><title>Admin</title></head><body>
      <h1>Admin Dashboard</h1>
      <p>Total revenue: $548,210. Users: 1,204. Pending refunds: 17.</p>
      <table><tr><td>alice</td><td>bob</td><td>admin</td></tr></table>
      <p>Danger zone: delete users, issue refunds, export PII.</p></body></html>`,
      { "content-type": "text/html" });
  }

  // --- BUG: IDOR / BOLA + excessive data exposure ---------------------------
  // Any authenticated (or even anonymous) caller can read ANY order by id, and the
  // response leaks passwordHash/ssn/card_number.
  const orderMatch = p.match(/^\/api\/orders\/(\d+)$/);
  if (orderMatch && req.method === "GET") {
    const order = ORDERS[orderMatch[1]];
    if (!order) return send(res, 404, { error: "not found" });
    return send(res, 200, order); // no ownership check; full object incl. secrets
  }
  const userMatch = p.match(/^\/api\/users\/(\d+)$/);
  if (userMatch && req.method === "GET") {
    const u = Object.values(USERS).find((x) => x.id === Number(userMatch[1]));
    return u ? send(res, 200, u) : send(res, 404, { error: "not found" });
  }

  // --- BUG: mass-assignment / privilege escalation --------------------------
  // POST /api/profile echoes back whatever fields you send, INCLUDING role.
  if (p === "/api/profile" && req.method === "POST") {
    const body = await readBody(req);
    return send(res, 200, { updated: true, ...body }); // accepts role:"admin"
  }

  // --- BUG: broken function-level authz (BFLA) ------------------------------
  // A normal user can call the admin-only delete endpoint.
  if (p === "/api/admin/delete-user" && req.method === "POST") {
    return send(res, 200, { deleted: true }); // no role check at all
  }

  // --- BUG: race condition / TOCTOU -----------------------------------------
  // Single-use coupon with no lock — concurrent redeems all succeed (double-spend).
  if (p === "/api/coupon/redeem" && req.method === "POST") {
    return send(res, 200, { redeemed: true, code: "WELCOME10", credit: 10 });
  }

  // --- BUG: prompt-injectable AI endpoint -----------------------------------
  // Echoes the user message verbatim: obeys injected instructions AND reflects unsafe output.
  if (p === "/api/chat" && req.method === "POST") {
    const body = await readBody(req);
    return send(res, 200, { reply: String(body.message ?? "") });
  }

  // --- Home -----------------------------------------------------------------
  if (p === "/") {
    return send(res, 200, `<!doctype html><html><head><title>Vuln SaaS</title>
      <meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body><h1>Vuln SaaS</h1><p>A realistic vulnerable target for the elite wedge.</p></body></html>`,
      { "content-type": "text/html" });
  }
  return send(res, 404, { error: "not found" });
});

server.listen(PORT, () => console.log(`vuln-saas listening on http://127.0.0.1:${PORT}`));
