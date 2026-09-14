# Deep Audit and Pro engineering acceptance

Verified September 14, 2026. Both variants pass the remaining tier-specific checkout and fulfillment mapping gate. These are engineering checks, not customer payments or completed customer service.

## Actual live checkout, no payment

Public `https://80-20.dev/api/checkout` created one checkout each using authorized Fusion-owned target `https://fusiondataco.com` and existing Rob email. Authenticated Stripe reads through the inherited Fusion Invoicing key retrieved both sessions in account `acct_1TY8wwEkfFOXPr6D` (Fusion Invoicing).

- Deep Audit: standard,14900USD cents, live payment mode, exact target metadata.
- Pro: pro,49900USD cents, live payment mode, exact target metadata.
- Both success URLs return to80-20.dev/order/success and cancel URLs to80-20.dev/#order.
- Both sessions were immediately expired and verified unpaid, with no PaymentIntent. No payment, outbound email, customer record creation, paid audit or provider configuration change was performed.

Private session references remain in the external evidence paths listed in live-checkout-summary.json; no checkout URLs or secret values are stored here.

## Canonical handler to durable service queue

`src/lib/deep-tier-fulfillment.test.ts` drives the actual signed Stripe webhook handler using its existing non-production canonical-session fixture mechanism and isolated PGlite. A network tripwire rejects fetch calls. Exact standard14900 and pro49900 paid fixtures create two correctly tiered, targeted, timestamped queued orders. Duplicate signed events preserve exactly two rows and their claimed operator ownership. Both enter pending_scope in the real hands-on queue. An actual async-payment-failed handler event removes only the corresponding tier from actionable work. This is an isolated engineering fixture, never a sale.

Command: `node --experimental-strip-types --test src/lib/deep-tier-fulfillment.test.ts src/lib/hands-on-work.test.ts` (TMPDIR pointed at external disposable storage). Result:9 tests passed,0 failed,0 skipped.

Existing separately verified shared automated PDF/email/report delivery, duplicate/refund/recovery paths remain applicable; they were not redundantly rerun. The ledger tests preserve automated report access, reject missing evidence and stale ownership, and retain Pro's call and re-audit obligations separately.

## Hands-on capability evidence

Published `/samples/hands-on-authorization-sample.pdf` is the authentic owned-system deliverable and prioritized fix plan, with explicit isolation limitations. Native proof431208c adds real Next browser sign-in, persisted writes, reciprocal account denial, viewer denial, logout, origin comparison and expired export. These demonstrate the promised human audit capability; the service ledger tracks each future customer's actual scope, report, call and re-audit without inventing completion.

A future customer's confirmed scope, report email,30-minute walkthrough or post-fix re-audit is actual fulfillment work, not a missing engineering capability. The goal explicitly permits a non-software sample and no-charge/isolated checks. No additional hands-on or tier-mapping blocker remains on this evidence. This does not assert a sale, an existing customer's delivery, or complete production security coverage of every target.
