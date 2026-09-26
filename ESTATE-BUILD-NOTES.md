# Launch Audit build checkpoint - September 26, 2026

Base: deployed revision a36e18e, recovered in a separate checkout because the old shared checkout has a malformed Git reference. Existing production payment-access changes are retained.

## Implemented in source, untested

- Scheduled fulfillment selects the least recently attempted eligible job instead of always selecting the oldest purchase. An old email retry or failing scan must not monopolize the single-job sweep.
- Failed scans retain their attempt timestamp, preserving the existing ten-minute cooldown and queue fairness. The claim token is released; payment lifecycle fences remain in place.
- Automated green results say "URL checks clear" in the generated PDF, email, and on-page gauge. Email explains the unverified signed-in, payment, and authorization scope.

## Still pending

- Deferred runtime acceptance of report-specific demo PDF rendering and the legacy PDF redirect.
- Complete advertised tier-to-deliverable mapping and remaining product build gaps.
- Testing, compilation, browser acceptance, deployment, provider delivery and sales evidence are all deferred. No completion claim or readiness-score increase.

Rob's instruction: build and fix offerings one at a time; no test runs until all build work is finished and he approves the testing round.

## Fulfillment continuation

Implemented in source, not executed:
- Failed blocked-scan refund requests re-enter the scheduled recovery queue with a ten-minute lease/cooldown. Retries reuse the original Stripe idempotency key and stop once a refund request has an ID. Payment lifecycle status and claim ownership are checked before requesting a refund.
- Buyer status distinguishes a refund request from a confirmed refunded payment. No live refunds were performed during this work.
- Deep/Pro order status reads the existing authoritative hands-on work ledger. The buyer page shows scope pending, scoped, report delivered, complete, or unavailable instead of permanently promising that work is next.
- Report-ready text reflects recorded email acceptance; customers retain the download route even while mail is unconfirmed.
- Existing visual classes and page structure retained. No tests, builds, browser checks or deployments run.

## Tier contract recovered from existing source

| Tier | Price | Automated deliverable | Remaining paid service |
| --- | --- | --- | --- |
| Single Run | $79 | Up to eight public pages; PDF, guarded report link, email attempt | None |
| Deep Audit | $149 | Same automated report | Scope contact within one business day; evidenced browser report and fix plan within two business days of confirmed scope |
| Pro | $499 | Same automated report | Scope contact within one business day; credentialed two-identity checks within three business days of scope, 30-minute walkthrough, one re-audit |

The existing ledger enforces evidence and delivery receipts for service completion. Operator capacity, actual paid fulfillment, and advertised turnaround remain unverified. Do not confuse this mapping with customer delivery.

Next build work: finish public demo PDF consistency and product-to-storefront tier presentation, then review remaining implementation obligations before moving to county parcel files. Retain all deferred acceptance tasks.

## Demo and selling continuation

- Public demo PDF downloads render the exact saved report ID shown on the page. Newly stored demo runs receive a download route without requiring a fresh scan or Blob upload. Missing IDs do not silently substitute a different report.
- The historical static PDF URL redirects to rendering its original saved report, with current scope labels and the original scan date. Original artifact retained.
- Sample pages/PDFs identify sample runs instead of implying a paid transaction.
- Fusion product detail now carries $79/$149/$499 tier cards, scope and service turnaround. Links select the matching radio option on Launch Audit; checkout still requires buyer-entered URL, email and authorization.
- All edits remain source-only. No scan, test, build, browser run, mail, refund or deployment was executed.

The identified Launch Audit build changes are staged for the later approved testing round. Remaining acceptance includes checkout/provider events, scheduler fairness and refund retries, report/payment access, phone/desktop presentation, exact demo PDF match, service-ledger state transitions, deployment configuration, genuine customer fulfillment and revenue. These are not marked complete.

## Focused release checks — September 26, 2026

Latest Rob direction: finish a working sellable offering, including purchase/access/fulfillment and Fusion demo/offer, before the next. Customer revenue is not a readiness gate. No live charge.

- Recovered existing PR #18 crawler group repair (two clean source paths), preserving its regression suite; 21 crawler checks pass.
- Build passed. Changed-path checks pass, including cooldown/refund retry, sample identity PDF, closed-payment access, and actual local TLS SMTP/PDF delivery integration. Local SMTP is not provider-origin delivery evidence.
- Internal disk exhausted during dependency installation. Dependencies and disk-backed fixture temporary files now use `/Volumes/FUSION OS/DEV-CACHE/estate-launchaudit-20260926-deps`; user assets untouched.
- Preview `https://launch-audit-platform-eli7t54bq-fusiondatacompany-projects.vercel.app` passed invalid input, protected worker and own-domain live scan. Sample and Pro-selected order form visually checked; no relevant console errors. Preview predates recovered crawler patch; subsequent release must include it.
- Existing live endpoint created Single/Deep/Pro checkout sessions without a payment or customer email. Session creation is not payment or fulfillment proof.
- Vercel link automatically created an ignored local environment file; its contents were not read or edited.
