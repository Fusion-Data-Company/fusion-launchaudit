# Buggy Shop — Planted Bugs

This app is a deliberate QA "test target." Below are the 5 planted bugs a deep
launch-audit should catch, followed by the routes that are intentionally
correct. All bugs are real and reproducible (not commented out). Server listens
on `http://127.0.0.1:4400`.

## Planted bugs (audit MUST catch all 5)

| # | Bug | Method & Route | Buggy behavior (current) | Correct behavior (expected) |
|---|-----|----------------|--------------------------|-----------------------------|
| 1 | RBAC direct-URL access | `GET /admin/users/:id` | Returns **200** with sensitive user detail (SSN, salary) to **anyone** — no session check. Anonymous or `session=user` can read it. | Require an **admin** session; otherwise **302 → /login** (or 403). |
| 2 | Unguarded admin API | `POST /api/admin/delete-user` | Returns **200 `{"deleted":true}`** for anyone, even with **no session** — no auth check. | Require an **admin** session; otherwise **401/403** and do not delete. |
| 3 | Missing input validation → 500 | `POST /api/orders` | When `qty` is missing or non-numeric, the handler throws a `TypeError` and returns **500 with a raw stack trace** in the body. | Validate input; on bad/missing `qty` return a clean **400 JSON** error (no stack leak). |
| 4 | Mobile horizontal overflow | `GET /` | Home page contains an element with inline `style="width:1200px"` (the inventory table), so the page **overflows horizontally** on a 390px viewport. | Use responsive widths (e.g. `max-width:100%` / overflow handling) so content fits a mobile viewport. |
| 5 | Missing security headers | All responses (server-wide) | Server sets **no** `X-Frame-Options`, `X-Content-Type-Options`, `Content-Security-Policy`, or `Strict-Transport-Security` on any response. | A security-headers middleware should set these on every response. |

## Intentionally correct (audit should NOT flag these as broken)

| Method & Route | Expected behavior |
|----------------|-------------------|
| `GET /` | 200 HTML home page with nav + links to /about, /login, /admin. (Note: also hosts BUG #4's overflow element.) |
| `GET /about` | 200 HTML about page. |
| `GET /api/health` | 200 JSON `{"ok":true}`. |
| `GET /api/products` | 200 JSON array of products. |
| `GET /login` | 200 HTML login form (`name="username"`, `name="password"`, submit button). |
| `POST /login` (admin/admin) | 302, sets `Set-Cookie: session=admin`, redirects to /admin. |
| `POST /login` (user/user) | 302, sets `Set-Cookie: session=user`, redirects to /. |
| `POST /login` (wrong creds) | 401 with the login form re-rendered. |
| `GET /admin` (no cookie / `session=user`) | **302 → /login** (correctly guarded). |
| `GET /admin` (`session=admin`) | 200 admin dashboard HTML. |
| `POST /api/orders` (valid `{"qty":<number>}`) | 200 JSON with computed `lineTotal`. |

## Notes for the auditor

- `middleware-map.json` documents which paths are *supposed* to be protected
  (`/admin`, `/admin/users/:id`, `/api/admin/delete-user`). Compare intended vs.
  actual: `/admin` is enforced; `/admin/users/:id` and `/api/admin/delete-user`
  are **not** — that gap is bugs #1 and #2.
- Credentials: admin = `admin/admin`, user = `user/user`.
