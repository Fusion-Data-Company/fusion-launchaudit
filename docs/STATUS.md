# 80/20 Launch Audit - Production Status

Live: https://80-20.dev (Vercel project `launch-audit-platform`, prj_9eH8UtyCC5FMEX6wjIbP4kqZLe6P, deploy branch `main`).

## What exists today (audited 2026-09-14, before any code was written this session)

Every line below was read from the tree at origin/main `7199e30` or checked with a tool this session. File references are `path:line`.

### Checkout path, as found

- **Order form** `public/index.html:752-802` collects URL, email, an authorisation checkbox and a tier radio, but the only radio is `single` ($79). Deep Audit and Pro are a "Quoted per site, ask for a quote" card with no radio. `public/assets/landing.js:287-312` POSTs `{url,email,tier,authorized}` to `/api/checkout` and redirects to the returned Stripe URL.
- **`/api/checkout`** `server/api-src/checkout.ts:15-58` creates a Stripe Checkout Session (payment mode, card + Link only) with `metadata.target_url` and `metadata.tier`, `success_url = https://80-20.dev/order/success?session_id={CHECKOUT_SESSION_ID}`. Uses the `STRIPE_PRICE_*` env for the tier, falling back to inline `price_data` at the same amount.
- **Tier gate** `src/lib/checkout-input.ts:34` rejects any tier other than `single` with "Deep and Pro audits are quoted by hand". So the $149 and $499 prices exist in Stripe and in env but cannot be bought.
- **Webhook** `server/api-src/stripe-webhook.ts:41-115` verifies the `Stripe-Signature` (HMAC-SHA256, 300 s tolerance, `src/lib/stripe.ts:55-72`), then on `checkout.session.completed` / `async_payment_succeeded` re-fetches the session from Stripe (`stripe-webhook.ts:91`) and requires `validAuditPayment` (`src/lib/audit-payment-proof.ts:2`): `livemode === true`, mode payment, status complete, payment_status paid, USD, `amount_total` equal to the tier amount, payment intent succeeded, charge paid, not refunded, not disputed. Then it upserts a `paid_audits` row with status `queued` (`src/lib/paid-audits.ts:45-59`) and acks 200. Lifecycle events (`async_payment_failed`, `charge.refunded`, `charge.dispute.created`) are persisted through `src/lib/payment-lifecycle.ts`.
  - Consequence: the `livemode === true` check means a Stripe TEST-mode session can never fulfil, so a test-mode rehearsal would fail even with a test key. Fixed this session (see below).
  - Consequence: the canonical re-fetch is unconditional, so the unit test `src/lib/stripe-webhook.test.ts:34` fails with 503 (no `STRIPE_SECRET_KEY` in the test). Baseline `npm test` this session: 368 pass, 1 fail (that test).
- **The audit job** is not a queue worker. The row sits `queued`; the first `/api/order-status` poll from the success page runs the grade inside that function's 300 s budget (`server/api-src/order-status.ts:28`), and the hourly Vercel cron `/api/grade-order` (`vercel.json` crons, `server/api-src/grade-order.ts`) claims one eligible queued row if nobody polled. Claims use `grade_claim_token` / `grade_claimed_at` with a 10 minute lease (`src/lib/paid-audits.ts:70-97`). A 220 s deadline wraps the grade (`src/lib/audit-deadline.ts`).
- **The audit generator** is `runDeepGrade` in `src/lib/deep-grade.ts:130` (site-wide URL-only grade, up to 8 pages, ~35 check groups, TLS, SPF/DMARC, PageSpeed when a key exists) built on `runInstantGrade` in `src/lib/instant-grade.ts:112` (the free scan plus the vibe-coder checks in `src/lib/vibe-checks.ts`). The Playwright runner (`runner/audit.ts`) is the local/agent deep audit and cannot run on Vercel functions (no Chromium), so the hosted product is the URL-only grade.
- **Outcome by tier** `src/lib/paid-audits.ts:80-86`: `single` -> `delivered`; `standard`/`pro` -> `graded` and left for a human. Blocked targets -> `blocked` plus an automatic Stripe refund (`refundBlockedOrder`, `paid-audits.ts:104-131`).
- **Success page** `public/order/success.html` + `public/assets/order-success.js` polls `/api/order-status` and renders the grade inline. Nothing is emailed ("Nothing is sent by email", `success.html:94`). No PDF. No hosted link. `report_url` is only shown for non-single tiers and is never set by any code path. It does not collect a URL: a session without `metadata.target_url` is rejected by the webhook with 400 (`stripe-webhook.ts:98`).
- **Mailer** `src/lib/mailer.ts` is a dependency-free SMTPS (port 465, AUTH LOGIN) client, text/plain only, no attachments, only used by the weekly monitoring diff. Env: `MONITOR_SMTP_URL` + `MONITOR_MAIL_FROM`. Neither is set in Vercel production (checked with `vercel env ls production`), so every send is a documented no-op.
- **CRM ledger**: the `audit_report_order` trigger (`db/migrations/007_order_reporting.sql`) writes each `paid_audits` change into `audit_crm_outbox`; `/api/order-reporting` (cron :20) pushes to `fusiondataco.app/api/ronin/estate/orders` with `FUSION_ORDER_CRM_KEY`.
- **Demo**: `/demo` is 404 on production (checked). The landing page's "This is the report" section (`index.html:657-751`) is a hand-written HTML table describing a run against `fixtures/buggy-shop`, not a live report.
- **Elite kit**: already vendored at `public/assets/elite.css`, `elite-tokens.css`, `elite-motion.js` (commit 49b02b8), register "Obsidian Iris / Titanium". Landing hero has a 1.1 MB autoplay `hero.mp4` plus three 7 MB UGC videos and a 1.17 MB `logo-80-20.png`.

### Stripe, as found (read-only, live key)

| Tier | Env var | Price id | unit_amount | Product |
|---|---|---|---|---|
| single ($79) | `STRIPE_PRICE_AUDIT_SINGLE` | `price_1UDG64EkfFOXPr6DosqxAIzx` | 7900 | prod_VDhVCwT2PzjIzc "80/20 Launch Audit - Single Run" |
| standard ($149) | `STRIPE_PRICE_AUDIT` | `price_1UChuBEkfFOXPr6D3yMNbJeV` | 14900 | prod_VD8ADZVQbkjeBq "Hosted deep audit (one URL)" |
| pro ($499) | `STRIPE_PRICE_AUDIT_PRO` | `price_1UChuCEkfFOXPr6D2ux1VTnU` | 49900 | prod_VD8AYxgkPZagc0 "Pro (credentialed RBAC + re-run)" |

The mapping Rob gave matches what is already in Vercel production and `.env.local` exactly; nothing needed changing. No Stripe object was created or modified.

Webhook endpoint `we_1UChuCEkfFOXPr6DRrxJbk1W` -> `https://80-20.dev/api/stripe-webhook`, enabled, livemode, events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `charge.refunded`, `charge.dispute.created`.

There has never been a completed paid session: the last 100 live Checkout Sessions with tier metadata are all `expired / unpaid`. `paid_audits` in Neon has 0 rows.

### Environment, as found

Vercel production env (names): FUSION_ORDER_CRM_KEY, RONIN_API_KEY, CRON_SECRET, STRIPE_PRICE_AUDIT_SINGLE, STRIPE_PRICE_AUDIT_PRO, STRIPE_PRICE_AUDIT, STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY, BLOB_READ_WRITE_TOKEN, RUNNER_SYNC_SECRET, POSTGRES_URL, DATABASE_URL, DATABASE_URL_UNPOOLED. Not set: MONITOR_SMTP_URL, MONITOR_MAIL_FROM, PAGESPEED_API_KEY.

Neon tables present: paid_audits (0 rows), paid_audit_payment_state, audit_crm_outbox (0), scans (7 free scans), scan_leads (1), monitors, submissions, submission_crm_receipts, plus the campaign tables.


## 2026-09-14 launch report (Ticket 3, 80/20 Launch Audit)

Live: https://80-20.dev  |  Demo: https://80-20.dev/demo  |  Deploy branch: main  |  Production deployment: dpl_EEissN94dKqRrwJkkKoYS4Tjfb5T (commit 38ede0c, Ready 07:33 PT, aliased to 80-20.dev).

### Ticket steps

1. **Checkout for all three tiers: DONE.** `src/lib/checkout-input.ts` sells single / standard / pro; `public/index.html` order section shows the three tiers with radios; `server/api-src/checkout.ts` builds the session from the matching `STRIPE_PRICE_*` env. Verified live: one uncompleted Checkout Session per tier was created through `POST https://80-20.dev/api/checkout` (single `cs_live_a19RAOYb...`, standard `cs_live_a1AfVsnS...`, pro `cs_live_a1nmwvTm...`, plus a pay-first pro `cs_live_a1AjOFGU...`). None was paid; Stripe expires them unpaid after 24 h, the same as every earlier session on the account. Success page (`public/order/success.html`, `public/assets/order-success.js`) confirms tier, price, site and what happens next, collects the URL for a pay-first order through `POST /api/order-url` (`server/api-src/order-url.ts`), and offers the PDF and the hosted copy. Proof: `docs/proof/2026-09-14/live-home-order-desktop.png`, `handler-rehearsal/success-standard-awaiting-url-mobile.png`, `handler-rehearsal/success-single-delivered-desktop.png`.
2. **Webhook enqueues the job, audit runs, PDF + hosted link + email: DONE.** `server/api-src/stripe-webhook.ts` re-fetches the canonical session, requires the exact tier amount and a settled charge, and inserts the `paid_audits` row (`queued`, or `awaiting_url` when no URL yet). The job is the existing generator `runDeepGrade` (`src/lib/deep-grade.ts`), run by the first `/api/order-status` poll or the hourly `/api/grade-order` cron, unchanged. New delivery layer `src/lib/audit-delivery.ts`: renders the PDF (`src/lib/pdf.ts` dependency-free writer + `src/lib/audit-report-pdf.ts`), uploads a copy to Vercel Blob (public store, random-suffix URL), serves it at `GET /api/order-report?session_id=` (`server/api-src/order-report.ts`, regenerated from `grade_json`), and emails it as an attachment through the existing operator SMTP mailer (`src/lib/mailer.ts`, now MIME multipart with attachments). **Email send path is real but NOT configured in production**: `MONITOR_SMTP_URL` / `MONITOR_MAIL_FROM` are unset in Vercel, so every send is recorded as `delivery_json.email.status = "skipped"` on the order and the success page says "Email pending: PDF below is your copy". The full outbound message (headers, body, base64 PDF) was captured with `MAIL_CAPTURE_DIR` during the rehearsal: `docs/proof/2026-09-14/handler-rehearsal/mail/*.eml` (3 files, one per rehearsal order).
3. **Rehearsal: handler-level DONE; Stripe test-mode NOT VERIFIED - blocked: no Stripe test key on this machine; needs `stripe login` or an sk_test_ in Preview env.** Handler-level rehearsal ran three times against the dev server on port 3003 (`VERCEL_ENV=development`, local PGlite so no test order reached the CRM outbox, `sk_test_` placeholder key, throwaway webhook secret, fixture dir, mail capture): (a) single tier with URL, (b) pro tier pay-first (`--defer-url`), (c) standard tier pay-first driven through the real success-page form by Playwright. Each proved: signed synthetic `checkout.session.completed` -> 200 + row queued / awaiting_url; tampered body with the same signature -> 400; URL named via `/api/order-url` and a second URL refused 409; audit actually ran against https://fusiondataco.com (58/100, 5 findings, 8 pages); PDF produced (11.6 KB); hosted Blob link opened 200 `application/pdf`; `/api/order-report` opened 200 `application/pdf`; email attempted (skipped, captured to .eml). Logs: `handler-rehearsal/single/rehearsal-handler.log`, `handler-rehearsal/pro-defer-url/rehearsal-handler.log`; the signed events: `*/event.json`; PDFs: `*/report-*.pdf`; screenshots: `handler-rehearsal/success-*.png`. This is handler-level, not a Stripe test-mode run. One-command script: `npm run rehearse:checkout -- --mode handler ...` (no key) and `--mode live` (needs `STRIPE_SECRET_KEY=sk_test_...` and test price ids in the same `STRIPE_PRICE_*` vars; refuses to run on a live key). The `livemode` check now follows the key mode (`src/lib/audit-payment-proof.ts`), so a test key fulfils test sessions with no code change.
4. **/demo: DONE.** https://80-20.dev/demo, public, no login. One real run of `runDeepGrade` against https://fusiondataco.com by `npm run demo:seed` (`scripts/seed-demo.ts`): 58/100, 5 findings, 8 pages, 35 check groups. Persisted three ways so the page never re-runs it: Neon `demo_reports` row `demo_s5mcs13dmu1c376u`, the committed snapshot `public/demo/fusiondataco.json`, and the PDF `public/demo/8020-launch-audit-fusiondataco.com.pdf` (plus a Blob copy). `/api/demo` (`server/api-src/demo.ts`) serves Postgres first, snapshot second; `POST /api/demo` with the runner secret refreshes it on demand. Example buyer shown: Rob Yeager, Fusion Data Company, rob@fusiondataco.com, Single Run $79. Proof: `live-demo-mobile.png`, `live-demo-desktop.png`, `demo-mobile-local.png`.
5. **Polish + Lighthouse: DONE.** The repo already vendors the elite kit (`public/assets/elite*.css/js`, Obsidian Iris / Titanium register); the new pages reuse it (gauge, chips with glow, elite table, reveals, designed empty states). Lighthouse mobile on production after the push: `/` performance **95** (FCP 2.3 s, LCP 2.5 s, TBT 0 ms, CLS 0.043; page weight 26,120 KiB -> 2,123 KiB), `/demo` performance **98** (FCP 1.9 s, LCP 1.9 s, CLS 0.014). Baseline before this session was 82 on `/`. Fixes: nav logo 1,174 KB -> 112 KB, the three 6.4 MB UGC videos no longer preloaded, Google Fonts loaded without blocking first paint (`public/assets/fonts.js`, CSP-safe). JSON: `docs/proof/2026-09-14/lighthouse-mobile.json`, `lighthouse-mobile-demo.json`.
6. **STATUS.md: this section.** Committed and pushed; production picked up the code push (deployment above). Live screenshots: `live-home-mobile.png`, `live-home-order-desktop.png`, `live-demo-mobile.png`, `live-demo-desktop.png`, `live-success-no-session-mobile.png`.

### Six done-criteria

| # | Criterion | Status |
|---|---|---|
| 1 | WORKS end to end on production, no console errors | DONE for the free scan, /demo, /order/success states and every API route (probed live: 400/401/404 on bad input, PDF route 404 until a report exists). Zero console errors in every Playwright capture. A real paid order has never been run on production (no completed session exists yet). |
| 2 | CHECKOUT: session -> webhook -> provisioning -> email -> success page | DONE in code and rehearsed at handler level. Email step is real but skipped in production until SMTP env is set (see next action). |
| 3 | PROVEN in Stripe TEST mode with 4242 | NOT VERIFIED - blocked: no Stripe test key on this machine; needs `stripe login` or an sk_test_ in Preview env. Handler-level proof in `docs/proof/2026-09-14/handler-rehearsal/`. |
| 4 | DEMO, no login, Rob Yeager as the example user | DONE, https://80-20.dev/demo |
| 5 | POLISH, Lighthouse mobile >= 90 | DONE, 95 on `/`, 98 on `/demo` |
| 6 | REPORT | DONE, this section |

### Stripe

Price ids (unchanged, verified read-only): single $79 `price_1UDG64EkfFOXPr6DosqxAIzx` = `STRIPE_PRICE_AUDIT_SINGLE`; standard $149 `price_1UChuBEkfFOXPr6D3yMNbJeV` = `STRIPE_PRICE_AUDIT`; pro $499 `price_1UChuCEkfFOXPr6D2ux1VTnU` = `STRIPE_PRICE_AUDIT_PRO`. Webhook endpoint `we_1UChuCEkfFOXPr6DRrxJbk1W` -> `https://80-20.dev/api/stripe-webhook` (events: checkout.session.completed, async_payment_succeeded, async_payment_failed, charge.refunded, charge.dispute.created). No Stripe product, price or endpoint was created or changed. Four Checkout Sessions were created on the live key by the live probe and left unpaid to expire.

### Assumptions made (Rob was away)

- Every tier gets the automated site-wide URL audit delivered immediately; Deep Audit and Pro add the hands-on browser audit, which a person schedules from the delivery email (copy on the landing page, success page, email and PDF says: scope email within one business day, deep report within two business days of scope, Pro credentialed audit within three). There is no automated hands-on path and none is claimed.
- The order row stays `delivered` for all tiers once the automated report is out; the hands-on part is tracked in `delivery_json.hands_on` and by email, not by a new status.
- Pay-first checkout (`defer_url`) is supported by the API and the success page but the landing form still asks for the URL up front (fewer surprises for a first buyer).
- Rehearsals used a local PGlite database on purpose, so no synthetic order hit Neon or the `audit_crm_outbox` trigger that reports orders to the Fusion CRM.

### Commits pushed

- `7d6afaa` docs: honest what-exists-today audit at the top of STATUS.md
- `38ede0c` Sell all three tiers, deliver every paid audit as PDF + hosted link + email, add /demo
- the docs/proof commit that carries this section (sha in `git log`)

### Vercel env changed

None. Nothing added, nothing removed. Names that would turn the email on: `MONITOR_SMTP_URL`, `MONITOR_MAIL_FROM`. Optional: `PUBLIC_SITE_URL` (defaults to https://80-20.dev).

### Neon rows

Created: `demo_reports` row `demo_s5mcs13dmu1c376u` (the /demo report; intended, kept). No `paid_audits` rows were created in Neon (rehearsals ran on local PGlite). Blob: three rehearsal PDFs under `launchaudit/orders/pa_*` were deleted after the run; the demo PDF copy under `launchaudit/demo/` is kept.

### Extra (things that move a first stranger purchase forward)

- Pay-first checkout: a buyer can pay before naming the site and add the URL on the success page (`defer_url`), with the order parked as `awaiting_url` and a one-shot URL form.
- The success page now states tier, price, site, where the email goes (masked), what is included and what happens next, and has Download PDF / Open hosted copy / Copy link buttons.
- The landing "This is the report" section links to the real finished report on /demo; nav has "Sample report"; sitemap lists /demo.
- `npm run dev` now serves every `/api/*` handler and every static page exactly like Vercel (`server/dev-server.ts` adapter), so the whole purchase path can be run on one port.
- The pre-existing failing webhook unit test now passes (382/382), and the webhook, payment-proof, mailer, PDF and report renderer all have tests.
- Finding from the real demo run worth acting on: **fusiondataco.com's robots.txt disallows the whole site** (`User-agent: * / Disallow: /`). Fine for staging, fatal for launch; it is the top finding on the public sample report.

### Exact next actions for Rob

1. To turn on the report email: `vercel env add MONITOR_SMTP_URL production` (smtps://user:pass@host:465, your own SMTP) and `vercel env add MONITOR_MAIL_FROM production`, then redeploy. Nothing else changes; orders already record the skipped send.
2. To finish the Stripe test-mode proof: put an `sk_test_` key and test price ids in the Preview env (same var names), then `npm run rehearse:checkout -- --mode live --base <preview-url> --tier single` and pay with 4242. The script polls to `delivered` and checks the links.
3. Fix fusiondataco.com's robots.txt (it blocks all crawlers).

---

## Earlier status (kept verbatim from before 2026-09-14)

## What's real and shipped
- **Deep test engine** — FE / BE / admin-RBAC / middleware generators producing
  real executable browser + HTTP checks. Catches RBAC direct-URL leaks, unguarded
  admin APIs, 500-on-bad-input, missing security headers, responsive overflow.
- **PAI-style Claude Code layer** — MCP server (10 tools incl. `launchaudit_run_audit`)
  + skill + `/launch-audit` command. Installs into the dev's own `~/.claude/`.
  Runs on their Claude subscription. No API key, no hosted backend required.
- **Standalone audit** — `runner/audit.ts` runs the whole pipeline locally and
  writes a self-contained, plain-English client report. Optional hosted sync.
- **Auth capture** — logs in with dev-provided test creds locally; role-based
  admin checks run anonymous vs user vs admin.
- **80→100 loop** — readiness computed from real results; findings → auto repair
  packets → fix → re-verify → score climbs. Proven 57→100 on the fixture.
- **Premium dashboard** — rebuilt to dev-tool grade (neutral dark, readiness
  gauge + road-to-100, category-coverage centerpiece, Linear-style results).
  Live in production, hostile-verified (dark/light/mobile, 6 views, 0 console errors).
- **Multi-campaign** persistence (Neon), campaign switcher, report export.
- **Trace artifacts + Blob upload** — every browser-executed check is traced
  (Playwright screenshots + DOM snapshots); FAILED cards export a `trace.zip`
  into the report's `evidence/` dir (passed checks keep none — size
  discipline). When `BLOB_READ_WRITE_TOKEN` is present (`.env.local` or env),
  the runner uploads evidence binaries (screenshots + traces) to Vercel Blob
  under `launchaudit/<name>/<run-stamp>/`. Uploads try `access: "private"`
  first (the storage contract's preference, with presigned report links); the
  production `launchaudit-artifacts` store is configured PUBLIC, so the API
  rejects private writes and the runner falls back to public uploads with
  unguessable random-suffix URLs. The HTML report links evidence per check —
  blob URLs in blob mode, local relative paths (`evidence/...`) when no token.
  Hosted sync now registers trace artifacts (kind `trace`) alongside
  screenshots. Verified end-to-end on the buggy-shop fixture: 2 trace.zips for
  the 2 failed browser cards, 6 blobs uploaded, trace blob re-downloaded
  byte-identical (HTTP 200).

## What's honestly not done
- **Cowork (non-developer) surface** — packaging the same tools as a Cowork
  plugin so non-devs run it without a terminal. ("Both, devs first" — this is the
  second half.)
- **Video artifacts** — skipped deliberately. Playwright `recordVideo` must be
  enabled at context creation, before pass/fail is known, so "video for failed
  cards only" would mean recording every attempt of every card and deleting
  most of it — real encoding overhead on every run for evidence the trace
  viewer already covers (traces include per-step screenshots + DOM snapshots).
  Not built; revisit only if a client asks for watchable video.
- **Trace coverage is browser-cards only** — pure-HTTP checks (admin API /
  security headers) have no browser context, so no trace or screenshot; their
  evidence is the recorded failure detail itself.
- **Production campaign creation** needs `POSTGRES_URL` set in Vercel env (1 step).
- **Seed/demo campaign is labelled, not faked.** Until a real campaign is created
  via the API (Postgres live), the dashboard serves a clearly-marked
  "Demo: Sample Campaign" (`demo.example/sample-app`, `demo-runner (sample)`),
  and the UI renders a "Sample data" badge + advisory notes whenever
  `persistence.mode !== "postgres"`. Real Postgres-backed campaigns render
  truthfully with no badge.

## Security hardening (2026-06-12)
- **Runner-write authentication.** `/api/runner/sync` and
  `/api/storage/register-artifact` now require the shared `RUNNER_SYNC_SECRET`
  (sent by the runner as `authorization: Bearer <secret>`), compared in
  constant time. Production fails closed: an unset secret rejects all writes
  (503); a configured secret rejects missing/wrong credentials (401). Local dev
  with no secret stays open so `npm run dev` + `npm run runner:sync` work with
  zero setup; when `.env.local` carries the secret, the dev server enforces it
  exactly like production.
- **Security headers** set in `vercel.json` for all paths: a tight CSP
  (`script-src 'self'`, no inline scripts in deployed HTML; `style-src` allows
  `'unsafe-inline'` for the app's dynamic runtime inline styles + Google Fonts;
  `font-src` Google Fonts; `connect-src 'self'`; `frame-ancestors 'none'`),
  plus `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, a deny-all
  `Permissions-Policy`, and `Cross-Origin-Opener-Policy: same-origin`.
- **Favicon** added (`public/favicon.svg`, the LaunchAudit gauge mark) and linked
  from both HTML pages — no more `/favicon.ico` 404.
- **Traffic-insight + self-healing engines** — not built yet. Their dashboard
  panels (and the Evidence nav view) were removed entirely rather than showing
  sample data; they return when the Playwright traffic layer and healing engine
  produce real per-campaign events. The concepts remain listed honestly as
  roadmap items in the Reports view's flagship-feature layer.

## Install (developer, on their own subscription)
```bash
npm install && npx playwright install chromium chromium-headless-shell
claude mcp add launchaudit -- node --experimental-strip-types ./runner/mcp-server.ts
cp -r claude-code/skills/launchaudit ~/.claude/skills/ && cp claude-code/commands/launch-audit.md ~/.claude/commands/
```
Then in Claude Code: "Audit my site at http://localhost:3000 and fix what's broken — code is in ~/projects/mysite"
