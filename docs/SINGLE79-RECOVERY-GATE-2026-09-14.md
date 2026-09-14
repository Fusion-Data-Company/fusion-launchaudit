# Single Run $79: bounded launch evidence, 2026-09-14

Scope: the existing Single Run, not the hands-on $149/$499 offers. This is engineering evidence, not a sale.

## Verified

- Parent verified a current live-mode $79 checkout and expired it unpaid. No charge or sale resulted.
- Parent operated the free scan on fusiondataco.com: real output appeared (87/100). This score describes that surface scan only.
- Fresh GET https://80-20.dev/api/demo returned a stored actual paid-generator run: source postgres; id demo_p5guq5mgmu1cz02w; generated 2026-09-14T14:48:54.824Z; fusiondataco.com; eight pages, four findings, 80/100. This is an authentic sample deliverable, not a newly executed interactive scan.
- Its linked PDF, https://80-20.dev/demo/8020-launch-audit-fusiondataco.com.pdf, returned HTTP 200, application/pdf, 10,724 bytes, valid %PDF header.
- Current-source focused tests cover canonical payment verification, all three tier contracts, pay-first URL entry, duplicate grading claims, refund fences, PDF/hosted-link preservation and recovery-page behavior. Synthetic fixtures do not prove a real Stripe payment or actual mail delivery.

## Confirmed interruption repair

Previously, gradePaidAudit persisted status delivered before upload/email/link persistence. Both browser polling and the cron worker only attempted queued orders. An interruption in that gap stranded delivery permanently.

The repair stores the regenerable PDF route and an atomic JSON delivery claim before side effects. Browser and cron both recover delivered orders with missing delivery work. Pre-send interrupted preparation and definite SMTP rejection retry after ten minutes. A durable sending marker is written before SMTP. Unconfirmed acceptance (including interruption after acceptance but before persistence) stays held, with no timed automatic resend. Delivered reports remain available while email is held.

Operator-held states: delivery_json.attempt.state is sending or uncertain. Inspect the existing SMTP/provider acceptance record before resolving the hold; never clear it simply to force a resend. Legacy email error records are also held because prior SMTP acceptance cannot be inferred. No operator hold was cleared and no customer order was changed in this work.

Isolated PGlite tests deliberately exercise interruption before send, interruption after acceptance before persistence, definite rejection, ambiguous timeout, rejection after DATA acceptance, concurrent browser/cron calls, and refund during preparation. Mail/upload dependencies are mocked; no outbound mail, refund, customer write or paid service call occurs.

## Still blocks a complete launch gate

1. Production mail configuration update: an earlier authenticated Vercel metadata check found the LaunchAudit SMTP fields absent. The parent subsequently recovered the already-owned Fusion Rapport SMTP relay, verified its connection without sending a message, and configured MONITOR_SMTP_URL plus MONITOR_MAIL_FROM for this deployment. A subsequent independent metadata read confirms both production variable names are now present. Do not treat the earlier missing-field snapshot as current after that update. Deployment pickup and actual authorized delivery remain separate evidence. CRON_SECRET and RUNNER_SYNC_SECRET were present; presence alone does not prove cron execution.
2. Actual SMTP acceptance/delivery and operator support handling remain unverified. Local MIME capture is not delivery.
3. Deployment and live acceptance of this new backend interruption repair belong to the parent task; this file does not claim them complete.
4. The application PDF route blocks refunded/disputed orders, but existing public Blob copies are not revoked by that route. If report revocation after closure is a required contract, retained public Blob access needs separate reconciliation.

The existing read-only scripts/operations-status.ts now selects held ambiguous delivery records and provides an explicit operator action. In-flight sending is not escalated until ten minutes; uncertain and legacy ambiguous errors are surfaced without releasing their hold.

Next concrete action: review/deploy the bounded recovery repair with the parent's existing SMTP configuration, then verify the promised PDF delivery with an explicitly authorized non-customer test. Do not mark Single Run fully green or start outbound based only on build success and a sample PDF.
