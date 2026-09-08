# NIGHT-REPORT — 80/20 Launch Audit (2026-09-08)

Pushed sha: **4404a96** (GitHub main). Vercel: READY. Live: https://80-20.dev

## What changed (COMPETE + BEST-IN-CLASS, steps 2-4; no Stripe touched)

**The differentiator — vibe-coder checks with agent-ready fixes** (`src/lib/vibe-checks.ts`,
wired into `src/lib/instant-grade.ts`, inherited by `src/lib/deep-grade.ts`):
Supabase anon-key + RLS read probe (the CVE-2025-48757 class), Firebase RTDB/Firestore
open-rules probe, secret keys in the bundle (Stripe sk_/rk_, AWS, OpenAI, Anthropic, GitHub,
Slack, PEM; pk_test in prod = medium), admin routes open without auth (/admin, /dashboard,
/api/admin — honest SPA-shell downgrade), Vite/Next dev-build leaks, public source maps,
auth-endpoint rate-limit advisory (report-only, never brute-forced), placeholder copy. Every
finding carries a paste-ready Cursor/Claude Code fix (`fix` field; `ensureFix` fallback for
surface findings).

**Free scan, elite + gated** (`server/api-src/grade.ts`, `public/index.html`,
`public/assets/landing.js`): result renders inline — score gauge, severity stripes, findings
grouped by category, copy-fix buttons. Top 5 shown; the rest lock behind an email unlock
(`/api/waitlist`) stored in Postgres (`scan_leads`); every scan persists (`scans`). Degrades
honestly to full findings when Postgres is absent. Rate limiting kept.

**Monitoring** (`src/lib/scan-store.ts`, `/api/monitor`, `/api/rescan-cron` on a weekly Vercel
Cron): per-URL scan history, diff (new/fixed/score delta), `/monitor` page with a score
sparkline, diff panel, findings, weekly enrolment, and white-label PDF export (agency name +
logo stored per monitor, print CSS). Diff email sends ONLY if the operator's own SMTP is set
(`src/lib/mailer.ts`, dependency-free, smtps:// only) — no mail vendor added; no-op otherwise.

**MODEL.md**: free scan / **$24-mo monitoring** / **Deep Audit $499 productized, $1,200-1,500
authenticated**. Records the plan only — no Stripe products/prices/checkout changed.

## Verified live (HTTP 200)
- https://80-20.dev renders the free-scan box + Monitor link.
- POST /api/grade {example.com} -> score 61, 5 shown, 2 locked, scan_id set, fixes present.
- POST /api/waitlist {scan_id} -> full 7 findings returned.
- GET /api/monitor?url=example.com -> history + latest score 61.
- GET /api/rescan-cron -> 200. /monitor -> 200.

## Tests / build
353 pass (was 337; +16 for vibe-checks, scan-store, mailer). `npm run build` clean.

## ERRORS.md
None.

## Remaining for step 5 (monetization)
Wire a Stripe subscription price for $24/mo monitoring to the unlock's "watch weekly" toggle;
productize the Deep Audit intake at $499/$1,500; retire/de-emphasize the $79 one-off. Optional:
set MONITOR_SMTP_URL + MONITOR_MAIL_FROM to turn on weekly diff emails; CRON_SECRET to lock the
cron endpoint.
