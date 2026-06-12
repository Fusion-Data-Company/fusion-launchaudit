# LaunchAudit — Self-Audit (dogfood run, 2026-06-12)

Ran the product against its own production deployment + repo:
`runner/audit.ts --app-url https://launch-audit-platform.vercel.app --repo .`

**Tool's own verdict: 88/100 · 22 passed · 2 to fix · 1 needs input.**

## What the tool FOUND (correctly)
- TC-MW-001 / TC-SEC-001: hardening headers weak/missing on `/`. Real and confirmed by hand:
  only `strict-transport-security` is present. No CSP, no X-Frame-Options, no
  X-Content-Type-Options, no Referrer-Policy, no Permissions-Policy. This is a true positive.
- 22 real passes with evidence (page reachability, malformed-input on 7 APIs, no served
  `.env`/`.git`, responsive at 390/768, clean console).
- Correctly BLOCKED on 6 missing integration env keys instead of guessing.

## What the tool MISSED (true negatives — the real story)

1. **Unauthenticated writes to mutation APIs (HIGH).** `/api/runner/sync` and
   `/api/storage/register-artifact` accept any well-shaped POST and write to the
   production Postgres DB. `RUNNER_SYNC_SECRET` is declared `requiredEnv` in
   `src/lib/storage-contract.ts:50` but **no handler ever reads it.** The audit only
   probes malformed input (-> 400) and anon access to *admin routes*. It has no
   generator for "unauthenticated state-changing write" / IDOR / BOLA — the #1 white
   space it claims as its moat is not yet wired for write-side authz.

2. **Fake/seed presentation data on a public page (UI).** Runner + Campaign views show
   hardcoded placeholders: `localhost:3000`, `~/client-app`, `cmp_launch_001`, a static
   "Last sync 2026-06-08". A visitor sees fake data. The tool has no "is this real data
   or seed/placeholder" check — exactly the empty-state/fake-data class it should own.

3. **ElevenLabs agents: ZERO coverage.** The product cannot audit ElevenLabs / ConvAI
   agents at all — no generator, no concept of agent config, tools, KB, voice, webhooks.
   For an FDC product this is the biggest single gap: every client build has a voice agent
   and the tool is blind to all of them.

4. **No accessibility, no Core Web Vitals, no SEO/schema** (known, in GAP-ANALYSIS).

5. **favicon 404** on every page load (cosmetic console error).

## Honest read
The tool is good at the read-only surface (headers, secrets exposure, reachability,
input hygiene) and honest about what it can't reach. It is NOT yet testing the things
that actually get FDC apps in trouble: write-side authz, fake data posing as real, and
**anything ElevenLabs.** Readiness 88 is real for what it covers and misleading as a
launch gate until write-authz + EL coverage exist.
