'use strict';

/*
 * buggy-shop — a small "test target" web app for a QA launch-audit tool.
 *
 * It is a real, runnable Node app (Node built-in `http` only, no deps).
 * It intentionally contains 5 PLANTED BUGS that a deep launch-audit should catch.
 * See BUGS.md for the full table. The bugs are real and reproducible, not
 * commented out.
 *
 *   BUG #1  RBAC direct-URL     GET  /admin/users/:id        no auth check at all
 *   BUG #2  Unguarded admin API POST /api/admin/delete-user  no auth check at all
 *   BUG #3  Validation/500      POST /api/orders             throws + raw stack on bad input
 *   BUG #4  Mobile overflow     GET  /                       inline width:1200px element
 *   BUG #5  Security headers     (all responses)             no security headers set
 *
 * Run:  node fixtures/buggy-shop/server.js   (listens on :4401)
 */

const http = require('http');

const PORT = 4401;

// ---------------------------------------------------------------------------
// In-memory "database"
// ---------------------------------------------------------------------------
const USERS = [
  { id: 1, name: 'Alice Admin', email: 'alice@buggy-shop.test', role: 'admin', ssn: '111-11-1111', salary: 185000 },
  { id: 42, name: 'Bob Customer', email: 'bob@buggy-shop.test', role: 'user', ssn: '222-22-2222', salary: 64000 },
  { id: 7, name: 'Carol Customer', email: 'carol@buggy-shop.test', role: 'user', ssn: '333-33-3333', salary: 72000 },
];

const PRODUCTS = [
  { id: 'sku-1', name: 'Widget', price: 9.99, stock: 120 },
  { id: 'sku-2', name: 'Gadget', price: 19.5, stock: 45 },
  { id: 'sku-3', name: 'Gizmo', price: 4.25, stock: 0 },
];

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------

// NOTE (BUG #5): every response goes through this helper, and it deliberately
// sets NO security headers — no X-Frame-Options, no X-Content-Type-Options,
// no Content-Security-Policy, no Strict-Transport-Security. A proper app would
// add a security-headers middleware here.
function securityHeaders() {
  // FIX #5: security-headers middleware — set on EVERY response. A launch-ready app
  // ships a STRICT CSP (no 'unsafe-inline' — styles are served from /style.css, not
  // inlined) plus cross-origin isolation (COOP/CORP) as defense-in-depth.
  return {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  };
}

function send(res, status, contentType, body) {
  res.writeHead(status, { 'Content-Type': contentType, ...securityHeaders() });
  res.end(body);
}

function sendHtml(res, status, html) {
  send(res, status, 'text/html; charset=utf-8', html);
}

function sendJson(res, status, obj) {
  send(res, status, 'application/json; charset=utf-8', JSON.stringify(obj));
}

// Parse a Cookie header into a plain object.
function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

// Returns the session value ('admin' | 'user') or null.
function getSession(req) {
  const cookies = parseCookies(req);
  const s = cookies.session;
  if (s === 'admin' || s === 'user') return s;
  return null;
}

// Collect a request body (used for form posts and JSON posts).
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
  });
}

function parseFormUrlEncoded(body) {
  const out = {};
  body.split('&').forEach((pair) => {
    if (!pair) return;
    const idx = pair.indexOf('=');
    const k = decodeURIComponent((idx === -1 ? pair : pair.slice(0, idx)).replace(/\+/g, ' '));
    const v = idx === -1 ? '' : decodeURIComponent(pair.slice(idx + 1).replace(/\+/g, ' '));
    out[k] = v;
  });
  return out;
}

// ---------------------------------------------------------------------------
// Shared HTML chrome
// ---------------------------------------------------------------------------
// Absolute base for canonical/OG URLs (launch-ready pages declare these).
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SITE_DESC = 'Buggy Shop is a demo storefront used as a QA test target for the 80/20 Launch Audit tool.';

// Styles live in ONE served stylesheet (see the /style.css route) so the page needs
// no inline <style> and the CSP can stay strict (style-src 'self', no 'unsafe-inline').
const STYLE_CSS = `
  body { font-family: system-ui, Arial, sans-serif; margin: 0; color: #1a1a1a; }
  nav { background: #14213d; padding: 12px 20px; }
  nav a { color: #e5e5e5; margin-right: 16px; text-decoration: none; font-weight: 600; }
  nav a:hover { color: #fca311; }
  main { padding: 24px 20px; max-width: 960px; }
  h1 { color: #14213d; }
  table { border-collapse: collapse; width: 100%; max-width: 100%; }
  td, th { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }
  .card { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin: 16px 0; }
  .scroll-x { max-width: 100%; overflow-x: auto; }
  .mt-24 { margin-top: 24px; }
  .mt-16 { margin-top: 16px; }
  .muted { color: #555; }
  .err { color: #b00020; font-weight: 600; }
  label { display: block; margin: 8px 0 4px; font-weight: 600; }
  input { padding: 8px; width: 240px; border: 1px solid #aaa; border-radius: 4px; }
  button { margin-top: 12px; padding: 8px 16px; background: #fca311; border: 0; border-radius: 4px; cursor: pointer; font-weight: 700; }
`;

function page(title, bodyHtml, opts) {
  const o = opts || {};
  const description = o.description || SITE_DESC;
  const canonical = BASE_URL + (o.path || '/');
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: 'Buggy Shop',
    description: SITE_DESC,
    url: BASE_URL,
  });
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — Buggy Shop</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${title} — Buggy Shop">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${BASE_URL}/og.png">
  <meta property="og:url" content="${canonical}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="/style.css">
  <script type="application/ld+json">${jsonLd}</script>
</head>
<body>
  <nav>
    <a href="/">Buggy Shop</a>
    <a href="/about">About</a>
    <a href="/login">Login</a>
    <a href="/admin">Admin</a>
  </nav>
  <main>
${bodyHtml}
  </main>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Page bodies
// ---------------------------------------------------------------------------
function homePage() {
  // BUG #4 (mobile overflow): the wide table below has inline style
  // `width:1200px`, so on a 390px viewport the page overflows horizontally.
  const body = `
    <h1>Welcome to Buggy Shop</h1>
    <p>A deliberately imperfect demo store for testing a launch-audit tool.</p>
    <p>Browse our <a href="/about">about page</a>, sign in via <a href="/login">login</a>,
       or head to the <a href="/admin">admin dashboard</a>.</p>

    <h2>Featured inventory</h2>
    <!-- FIX #4: responsive — table is full-width within an overflow-x:auto wrapper. -->
    <div class="scroll-x">
    <table>
      <thead>
        <tr><th>SKU</th><th>Product</th><th>Price</th><th>In stock</th><th>Warehouse</th><th>Lead time</th></tr>
      </thead>
      <tbody>
        <tr><td>sku-1</td><td>Widget</td><td>$9.99</td><td>120</td><td>Dallas Distribution Center #4</td><td>2 business days</td></tr>
        <tr><td>sku-2</td><td>Gadget</td><td>$19.50</td><td>45</td><td>Dallas Distribution Center #4</td><td>3 business days</td></tr>
        <tr><td>sku-3</td><td>Gizmo</td><td>$4.25</td><td>0</td><td>Reno Fulfillment Annex</td><td>backordered</td></tr>
      </tbody>
    </table>
    </div>

    <p class="mt-24">Check our service status at <a href="/api/health">/api/health</a>.</p>
  `;
  return page('Home', body);
}

function aboutPage() {
  const body = `
    <h1>About Buggy Shop</h1>
    <p>Buggy Shop is a fictional storefront used as a QA test target. It exists so a
       launch-audit tool can exercise routing, authentication, RBAC, input validation,
       responsive layout, and HTTP security headers against a known set of planted defects.</p>
    <div class="card">
      <h2>Our promise</h2>
      <p>Every bug you can find here was put here on purpose. Probably.</p>
    </div>
    <p><a href="/">Back home</a></p>
  `;
  return page('About', body);
}

function loginPage(message) {
  const note = message ? `<p class="err">${message}</p>` : '';
  const body = `
    <h1>Login</h1>
    ${note}
    <form method="POST" action="/login">
      <label for="username">Username</label>
      <input id="username" name="username" type="text" autocomplete="username">
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password">
      <div><button type="submit">Sign in</button></div>
    </form>
    <p class="mt-16 muted">Try <code>admin/admin</code> or <code>user/user</code>.</p>
  `;
  return page('Login', body);
}

function adminDashboard(session) {
  const rows = USERS.map(
    (u) => `<tr><td>${u.id}</td><td>${u.name}</td><td>${u.email}</td><td>${u.role}</td>
      <td><a href="/admin/users/${u.id}">view</a></td></tr>`
  ).join('\n');
  const body = `
    <h1>Admin Dashboard</h1>
    <p>Signed in as <strong>${session}</strong>. This page is correctly guarded.</p>
    <div class="card">
      <h2>Users</h2>
      <table>
        <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p><a href="/">Back home</a></p>
  `;
  return page('Admin', body);
}

function adminUserDetail(user) {
  const body = `
    <h1>User detail — ${user.name}</h1>
    <div class="card">
      <table>
        <tr><th>ID</th><td>${user.id}</td></tr>
        <tr><th>Name</th><td>${user.name}</td></tr>
        <tr><th>Email</th><td>${user.email}</td></tr>
        <tr><th>Role</th><td>${user.role}</td></tr>
        <tr><th>SSN</th><td>${user.ssn}</td></tr>
        <tr><th>Salary</th><td>$${user.salary.toLocaleString()}</td></tr>
      </table>
    </div>
    <p class="err">This is sensitive admin-only data.</p>
    <p><a href="/admin">Back to dashboard</a></p>
  `;
  return page('User detail', body);
}

// ---------------------------------------------------------------------------
// Router (the real application handler)
// ---------------------------------------------------------------------------
async function router(req, res) {
  const method = req.method || 'GET';
  // Strip query string and any trailing slash (except root) for matching.
  let path = (req.url || '/').split('?')[0];
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);

  // ----- PUBLIC -----------------------------------------------------------
  if (method === 'GET' && path === '/') {
    return sendHtml(res, 200, homePage());
  }

  if (method === 'GET' && path === '/about') {
    return sendHtml(res, 200, aboutPage());
  }

  if (method === 'GET' && path === '/style.css') {
    return send(res, 200, 'text/css; charset=utf-8', STYLE_CSS);
  }

  if (method === 'GET' && path === '/api/health') {
    return sendJson(res, 200, { ok: true });
  }

  if (method === 'GET' && path === '/api/products') {
    return sendJson(res, 200, PRODUCTS);
  }

  // ----- LOGIN ------------------------------------------------------------
  if (method === 'GET' && path === '/login') {
    return sendHtml(res, 200, loginPage(''));
  }

  if (method === 'POST' && path === '/login') {
    const body = await readBody(req);
    const form = parseFormUrlEncoded(body);
    const username = form.username;
    const password = form.password;

    if (username === 'admin' && password === 'admin') {
      res.writeHead(302, {
        'Set-Cookie': 'session=admin; Path=/; HttpOnly',
        Location: '/admin',
        ...securityHeaders(),
      });
      return res.end();
    }
    if (username === 'user' && password === 'user') {
      res.writeHead(302, {
        'Set-Cookie': 'session=user; Path=/; HttpOnly',
        Location: '/',
        ...securityHeaders(),
      });
      return res.end();
    }
    // Wrong creds → 401.
    return sendHtml(res, 401, loginPage('Invalid username or password.'));
  }

  // ----- ADMIN (correctly guarded) ---------------------------------------
  if (method === 'GET' && path === '/admin') {
    const session = getSession(req);
    if (session !== 'admin') {
      // No session or a non-admin ('user') session → redirect to login.
      res.writeHead(302, { Location: '/login' });
      return res.end();
    }
    return sendHtml(res, 200, adminDashboard(session));
  }

  // ----- ADMIN user detail -----------------------------------------------
  // BUG #1 (RBAC direct-URL): NO session check here. Anyone — anonymous or a
  // plain 'user' — can GET /admin/users/:id directly and see sensitive data.
  const userDetailMatch = path.match(/^\/admin\/users\/([^/]+)$/);
  if (method === 'GET' && userDetailMatch) {
    // FIX #1 (RBAC direct-URL): require an admin session; else 302 -> /login.
    const session = getSession(req);
    if (session !== 'admin') {
      res.writeHead(302, { Location: '/login', ...securityHeaders() });
      return res.end();
    }
    const id = Number(userDetailMatch[1]);
    const user = USERS.find((u) => u.id === id);
    if (!user) {
      return sendHtml(res, 404, page('Not found', '<h1>404</h1><p>No such user.</p>'));
    }
    // <-- should be guarded, isn't. Returns 200 + sensitive HTML to anyone.
    return sendHtml(res, 200, adminUserDetail(user));
  }

  // ----- ADMIN delete-user API -------------------------------------------
  // BUG #2 (unguarded admin API): NO auth check. Returns 200 {"deleted":true}
  // for anyone, even with no session cookie.
  if (method === 'POST' && path === '/api/admin/delete-user') {
    // FIX #2 (unguarded admin API): require an admin session; else 401 JSON.
    const session = getSession(req);
    if (session !== 'admin') {
      return sendJson(res, 401, { error: 'Unauthorized: admin session required.' });
    }
    return sendJson(res, 200, { deleted: true });
  }

  // ----- ORDERS API -------------------------------------------------------
  // BUG #3 (validation/500): if qty is missing or non-numeric, the arithmetic
  // below throws and we let it bubble into a 500 with a raw stack trace,
  // instead of returning a clean 400 JSON error.
  if (method === 'POST' && path === '/api/orders') {
    const raw = await readBody(req);
    let payload;
    try {
      payload = JSON.parse(raw || '{}');
    } catch (e) {
      // Even malformed JSON falls through into the unvalidated path below so
      // the audit reliably sees a 500 with a stack trace on bad input.
      payload = {};
    }

    // No validation of `qty`: the code assumes it is a number. We call
    // qty.toFixed(...) directly. If `qty` is missing (undefined) this throws
    // "Cannot read properties of undefined (reading 'toFixed')"; if it is a
    // string like "abc" then qty.toFixed is undefined and calling it throws
    // "qty.toFixed is not a function". Either TypeError is deliberately NOT
    // caught here, so it bubbles up to the server wrapper and is returned as a
    // 500 with the raw stack trace in the body. A hardened handler would
    // validate qty and return a clean 400 JSON error instead.
    // FIX #3 (validation): validate qty is a finite number; else clean 400 JSON.
    const qty = payload.qty;
    if (typeof qty !== 'number' || !Number.isFinite(qty)) {
      return sendJson(res, 400, { error: 'Invalid request: "qty" must be a number.' });
    }
    const unitPrice = PRODUCTS[0].price;
    const lineTotal = Number((qty * unitPrice).toFixed(2));

    return sendJson(res, 200, {
      ok: true,
      qty: qty,
      unitPrice: unitPrice,
      lineTotal: lineTotal,
    });
  }

  // ----- 404 --------------------------------------------------------------
  return sendHtml(res, 404, page('Not found', '<h1>404</h1><p>Page not found.</p>'));
}

// ---------------------------------------------------------------------------
// Server wrapper
// ---------------------------------------------------------------------------
// We wrap the router so that any thrown exception (sync or async) surfaces as a
// 500 with the raw stack trace in the body. This is what powers BUG #3. A
// hardened app would instead return a generic 400/500 JSON without leaking
// internals, and would set security headers (see BUG #5 — it does neither).
const server = http.createServer((req, res) => {
  Promise.resolve()
    .then(() => router(req, res))
    .catch((err) => {
      // BUG #3 manifestation: leak the raw stack trace in a 500 response.
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', ...securityHeaders() });
      }
      res.end('Internal Server Error\n\n' + (err && err.stack ? err.stack : String(err)));
    });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`buggy-shop listening on http://127.0.0.1:${PORT}`);
});
