# Production setup — one step left

Everything is deployed and verified except durable storage on the Vercel side.

1. Vercel → launch-audit-platform → Settings → Environment Variables
2. Add `POSTGRES_URL` = your Neon connection string (all environments)
3. Redeploy (Deployments → ⋯ → Redeploy)

The moment it's set: campaign creation works on production, the switcher lights up,
audits sync durably, the Projects view badge flips to "postgres live."

Optional hardening next: RUNNER_SYNC_SECRET to sign runner writes before external
customers touch it.
