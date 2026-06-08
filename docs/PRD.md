# LaunchAudit — Product Requirements (LOCKED)

## Vision
A deep, developer-owned testing framework that installs into a developer's own
Claude Code (PAI-style auth — their Pro/Max subscription powers it, no API key),
works like TestSprite, but goes deeper exactly where TestSprite is shallow:
**admin panels, admin functions, RBAC, and middleware** — full front end AND
back end. Purpose: drive a codebase from ~80% "works on my machine" to 100%
"hand to client" complete.

## Customer
Developers (Rob / FDC first, then monetized). Not end-users, not non-technical
owners — this is a dev tool that lives in the dev's IDE.

## Auth model (settled)
Runs inside the developer's Claude Code → their subscription powers all reasoning
and repairs. Our MCP server + skill provide the testing tools; their agent does
planning and fixes. No Anthropic API key, no hosted token proxy (ToS-compliant —
same shape as PAI: Claude Code is the engine, we're the layer).

## Differentiators vs TestSprite (the whole point)
1. **Admin / RBAC depth** — admin routes require auth; non-admin users are
   blocked from admin routes AND admin APIs; direct-URL access to admin detail
   pages is blocked; privileged mutations are server-guarded, not UI-hidden.
2. **Middleware depth** — route guards enforced server-side; auth redirects;
   security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options);
   http→https; rate limiting on sensitive endpoints.
3. **Back end depth** — every API route: status codes, input validation
   (malformed → 400 not 500), error shapes (JSON not stack traces), auth
   enforcement (401/403 without session).
4. **Role-based execution** — local auth capture stores admin + user sessions;
   checks run with and without each role.
5. **Honesty** — blocked/needs-input is first class; nothing faked.

## Surfaces
- **Developer's Claude Code** (MCP server + skill + `/launch-audit` command) — primary.
- **Hosted command center** (Vercel) — view results, evidence, the 80→100
  journey; export a hand-to-client report. Must be premium (Linear/Sentry grade).

## The 80→100 model
Each audit computes a readiness score from real executed results. Findings →
auto repair packets → the dev's agent fixes → re-verify → score climbs. The
report shows the journey and an explicit "what's left to hit 100%" list.

## Definition of DONE (100% / acceptance)
- Deep taxonomy implemented across FE / BE / admin-RBAC / middleware as real
  executable checks.
- Auth capture works; role-based admin checks run with/without admin state.
- Runs standalone in Claude Code: no API key, no backend; report written locally.
- Proven against a fixture app with REAL admin/middleware bugs: audit catches
  them with evidence; after fixes, re-run shows resolved and score → 100.
- Dashboard rebuilt to premium grade; hostile-verified (dark+light, mobile, all
  views, zero console errors); nothing fake/dead/decorative.
- Client-ready report (plain-English + technical), exportable.
- Docs: install into Claude Code, usage, the test taxonomy.
- Pushed; production deploy green.

## Deep test taxonomy (the focus points — ours, not TestSprite's)
FRONT END: each route renders; responsive 390/768/1440 no overflow; console/
network clean; broken images/links; forms validate+submit; key interactive
elements present; basic a11y (alt text, button labels).
BACK END/API: route reachable + correct status; protected endpoint → 401/403
without auth; malformed input → 400 not 500; error responses are JSON; security
headers present.
ADMIN/RBAC: admin route anon → redirect/403; admin route as normal user →
blocked (not 200); admin API as normal user → 403; direct URL to admin detail →
blocked; privileged mutation as normal user → rejected.
MIDDLEWARE: unauth protected route → correct redirect; security headers; http→
https; protected paths actually protected; rate limit on login.
