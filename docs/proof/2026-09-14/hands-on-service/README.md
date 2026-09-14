# Hands-on authorization service sample

Performed 14 September 2026. This is authentic browser/API evidence against owned source and an owned public entry point, with explicit isolation boundaries. It is not a customer fulfillment or blanket production clearance.

Start with **hands-on-authorization-sample.pdf**. It contains the scoped findings, interpretation, prioritized follow-up plan, screenshots and residual requirements.

## Evidence

- `api-checks.json`: 21 passing assertions on unchanged RentDesk auth/session/actions/receipt/export code, through an isolated request adapter and PGlite.
- `browser-operations.json` and screenshots 01-05: real browser sign-in and authorization operations against that adapter.
- `live-storefront-api.json`: three anonymous live requests refused with 401. Screenshot 06: admin entry reaches the sign-in gate.
- `source-manifest.json`: exact source revision/hashes and transport substitutions.
- `isolated-http.jsonl`: raw observed isolated responses, including the initial fixture entitlement refusal. No cookies/passwords logged.

No authorization vulnerability was confirmed in the sampled paths. The public Fusion sign-in form visibly showed Development mode; verify its production Clerk configuration. Do not describe the framework adapter as the deployed Next application. Native Next transport, other object mutations, session revocation/expiry and SSO remain untested.

## Reproduction

With existing dependencies, run `node isolated-rentdesk.cjs`, then `python3 check-api.py` and `python3 check-browser.py`. The adapter runs only at 127.0.0.1:4318, creates synthetic .invalid identities and isolated records, and prohibits outbound mail/fetch. The current trial fixture deliberately allows authorized writes.

The first exploratory run used an active plan without subscription expiry; write refusal was correct. The fixture was then corrected. Raw logs retain both observations; final assertions correspond to the corrected current-trial fixture.

## Unclaimed service obligations

This sample does not claim real customer scope acceptance, a provider email receipt, a completed 30 minute call, or a completed Pro re-audit. It does not update the paid-order ledger or claim full Deep/Pro launch clearance. Parent review is required before exposing the sample through the existing public demo.
