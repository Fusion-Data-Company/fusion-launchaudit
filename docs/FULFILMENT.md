# Hosted Single Run: how an order is served

Every step below is automatic. Nobody at Fusion touches a Single Run unless something in the "When to step in" list happens.

## The path

1. Buyer submits the order form on `/#order` (URL, email, authorisation checkbox). `POST /api/checkout` creates a Stripe Checkout Session, card and Link only, with `metadata.target_url` and `metadata.tier=single`.
2. Stripe fires `checkout.session.completed` at `/api/stripe-webhook`. The row lands in `paid_audits` as `queued` and Stripe is acked inside a second.
3. The buyer lands on `/order/success?session_id=cs_...`. That page polls `/api/order-status`, and the first poll that finds a `queued` row runs the site-wide grade right there. If nobody polls (tab closed), the configured hourly `/api/grade-order` cron claims one eligible queued order using `CRON_SECRET`. Manual calls may use `RUNNER_SYNC_SECRET`. The cron configuration must be deployed and its secret verified before claiming production recovery. Grading claims expire after ten minutes; result writes require the matching token and queued status.
4. Outcome A, graded: status `delivered`, report shown on the page. The page is the deliverable; nothing is emailed.
5. Outcome B, blocked (bot wall, login wall, site down, refused): status `blocked`, a Stripe refund is created automatically (`grade_json.refund.id`), and the page tells the buyer it was refunded. Set `AUTO_REFUND_BLOCKED=0` to turn the automatic refund off.
6. Lifecycle: `charge.refunded` marks the row `refunded`, `charge.dispute.created` marks it `disputed`; both stop the report being served. `async_payment_failed` marks `payment_failed`.

## When to step in

- A row sits at `queued` for more than an hour: run the sweep, `curl -X POST https://80-20.dev/api/grade-order -H "Authorization: Bearer $RUNNER_SYNC_SECRET"`.
- `grade_json.refund.error` is set on a blocked row: the automatic refund failed. Refund it from the Stripe dashboard and reply to the buyer if they wrote in.
- A buyer emails under the 14-day clause in `/refunds`: read the row, decide, refund from Stripe.
- Deep Audit or Pro request via the contact form: that is a quoted, hands-on job. Scope it, price it, invoice it. There is no checkout for it on purpose.

## Where things are

- Orders: `paid_audits` in the Neon database behind `POSTGRES_URL` (production).
- Contact form submissions: `submissions` table. Nothing emails these yet; query the table.
- Stripe product for the $79 tier: `prod_VDhVCwT2PzjIzc`, price `price_1UDG64EkfFOXPr6DosqxAIzx` (env `STRIPE_PRICE_AUDIT_SINGLE`). The older price on the "Hosted deep audit" product is archived.
- Webhook endpoint: `we_1UChuCEkfFOXPr6DRrxJbk1W`, events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `charge.refunded`, `charge.dispute.created`.
