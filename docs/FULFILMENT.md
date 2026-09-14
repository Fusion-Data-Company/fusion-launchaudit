# Hosted audits: how an order is served (updated 2026-09-14)

All three tiers (Single Run $79, Deep Audit $149, Pro $499) go through the same automatic path below. Nobody at Fusion touches a Single Run unless something in the "When to step in" list happens. Deep Audit and Pro additionally need a person for the hands-on browser audit, scheduled from the delivery email.

## The path

1. Buyer submits the order form on `/#order` (URL, email, authorisation checkbox, tier). `POST /api/checkout` creates a Stripe Checkout Session, card and Link only, with `metadata.target_url` and `metadata.tier` (single | standard | pro). With `defer_url:true` the session carries only the tier; Stripe collects the email and the success page collects the URL (`POST /api/order-url`).
2. Stripe fires `checkout.session.completed` at `/api/stripe-webhook`. The webhook re-fetches the canonical session from Stripe, requires the exact tier amount and a settled charge (livemode matching our key), and the row lands in `paid_audits` as `queued` (or `awaiting_url` for a pay-first order). Stripe is acked inside a second.
3. The buyer lands on `/order/success?session_id=cs_...`. That page polls `/api/order-status`, and the first poll that finds a `queued` row runs the site-wide grade right there. If nobody polls (tab closed), the configured hourly `/api/grade-order` cron claims one eligible queued order using `CRON_SECRET`. Manual calls may use `RUNNER_SYNC_SECRET`. The cron configuration must be deployed and its secret verified before claiming production recovery. Grading claims expire after ten minutes; result writes require the matching token and queued status.
4. Outcome A, graded: status `delivered` for every tier. Delivery runs in the same invocation (`src/lib/audit-delivery.ts`): the PDF is rendered (`src/lib/audit-report-pdf.ts`, dependency-free), a copy is uploaded to Vercel Blob (`report_url`), the platform route `/api/order-report?session_id=` always serves the PDF (`report_pdf_url`), and the buyer is emailed with the PDF attached through the operator SMTP (`MONITOR_SMTP_URL` + `MONITOR_MAIL_FROM`). The outcome is recorded in `delivery_json` (`email.status` = sent | skipped | error). For Deep Audit and Pro, the delivery email tells the buyer that Rob emails within one business day to scope the hands-on audit; that follow-up is manual.
5. Outcome B, blocked (bot wall, login wall, site down, refused): status `blocked`, a Stripe refund is created automatically (`grade_json.refund.id`), and the page confirms the refund only when the response contains its ID. Failed or skipped refunds remain pending confirmation. Set `AUTO_REFUND_BLOCKED=0` to turn the automatic refund off.
6. Lifecycle: `charge.refunded` marks the row `refunded`, `charge.dispute.created` marks it `disputed`; both stop the report being served. `async_payment_failed` marks `payment_failed`.

## When to step in

- A row sits at `queued` for more than an hour: run the sweep, `curl -X POST https://80-20.dev/api/grade-order -H "Authorization: Bearer $RUNNER_SYNC_SECRET"`.
- `grade_json.refund.error` is set on a blocked row: the automatic refund failed. Refund it from the Stripe dashboard and reply to the buyer if they wrote in.
- A buyer emails under the 14-day clause in `/refunds`: read the row, decide, refund from Stripe.
- Paid Deep Audit and Pro orders: use the hands-on queue below. The automated report's `delivered` status does not complete the human service. Contact-form requests remain separate until matched to a paid order.

## Where things are

- Orders: `paid_audits` in the Neon database behind `POSTGRES_URL` (production).
- Contact form submissions: `submissions` table. Nothing emails these yet; query the table.
- Stripe prices: $79 `price_1UDG64EkfFOXPr6DosqxAIzx` (`STRIPE_PRICE_AUDIT_SINGLE`, prod_VDhVCwT2PzjIzc), $149 `price_1UChuBEkfFOXPr6D3yMNbJeV` (`STRIPE_PRICE_AUDIT`, prod_VD8ADZVQbkjeBq), $499 `price_1UChuCEkfFOXPr6D2ux1VTnU` (`STRIPE_PRICE_AUDIT_PRO`, prod_VD8AYxgkPZagc0). Test-mode price ids go in the same three env vars.
- Webhook endpoint: `we_1UChuCEkfFOXPr6DRrxJbk1W`, events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `charge.refunded`, `charge.dispute.created`.

## Rehearsal

`npm run rehearse:checkout -- --mode handler --base http://127.0.0.1:3003 --url https://fusiondataco.com --tier single` drives a signed synthetic `checkout.session.completed` through the real webhook on a dev server started with `VERCEL_ENV=development STRIPE_SECRET_KEY=sk_test_x STRIPE_WEBHOOK_SECRET=<throwaway> STRIPE_SESSION_FIXTURE_DIR=<dir> MAIL_CAPTURE_DIR=<dir>`. Add `--defer-url` for the pay-first path. `--mode live` with a real `sk_test_` key creates a Checkout Session and waits for a 4242 payment. See docs/STATUS.md.

## Operations check

Run `node --experimental-strip-types scripts/operations-status.ts` with the production database connection supplied by the connected runtime. It is read-only and returns recent contact requests, queued orders older than one hour, and blocked orders without a confirmed refund ID. The attached hourly operations monitor alerts Rob to new/actionable items and deduplicates by submission/order ID. A successful database write is not evidence that a lead has been handled.

## Deep Audit and Pro operator ledger

Apply the reviewed additive `db/migrations/009_hands_on_work.sql` before recording work. It creates a separate table and does not alter paid orders, reports, or existing delivery history. The read-only queue works before migration and explicitly reports `schema_installed:false`; it still exposes outstanding paid Deep/Pro orders.

Run `node --experimental-strip-types scripts/hands-on-work.ts` with the connected database runtime. The same queue is included in `operations-status.ts`. Claim each order once, contact the buyer within one business day of payment, and confirm scope. Deep Audit's evidenced report and fix plan are due within two business days of confirmed scope; Pro's credentialed audit is due within three. Pro also retains a 30 minute walkthrough and one re-audit after fixes.

Record already-performed work with `node --experimental-strip-types scripts/hands-on-work.ts --record /absolute/command.json`. Commands contain `order_id`, `owner`, `expected_version`, and one `action`: `claim`, `contact`, `scope`, `report`, `call`, or `reaudit`. `claim` uses version zero; subsequent commands use the returned version and same owner. Concurrent or stale commands fail without overwriting history.

Each non-claim step requires `evidence:{path,sha256}` pointing to a nonempty local artifact with its verified SHA-256. Contact/report/re-audit require the actual existing provider acceptance `receipt`; the CLI never sends email. Scope evidence must retain buyer authorization and agreed targets. Pro scope includes two distinct `identity_refs` to approved test identities, never passwords or credentials. Report/re-audit also require `fix_plan:{path,sha256}` and `checks`, each with `check`, `result` (`pass` or `fail`), and its own evidence artifact. Required checks are `access_control`, `admin_rbac`, `write_authorization`; Pro adds `two_identity_idor` and `privilege`. Untested or blocked checks cannot complete delivery. Call evidence requires `minutes` of at least 30.

The ledger hashes actual files, fences mutations on paid status and version, and records an append-only step history. It does not establish the truth of operator-authored evidence or independently verify provider receipt IDs: the operator must retain authentic browser artifacts and acceptance evidence. No command runs an audit, handles customer credentials, sends a message, or claims completion from an automated grade. Refund/dispute/payment-failure records prevent updates. Deep Audit completes only after its evidenced manual report; Pro remains open until its report, walkthrough and re-audit are recorded. Existing automated report access is preserved throughout.

`delivery_json.hands_on.status='scheduled_by_email'` in historical rows is a legacy label, not scheduling proof. New automated delivery snapshots the ledger state, defaulting to `pending_scope` when no scope exists. Authoritative human progress lives in `audit_hands_on_work` and survives automated PDF/email retries.
