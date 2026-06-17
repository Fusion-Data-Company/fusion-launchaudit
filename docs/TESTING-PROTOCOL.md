# LaunchAudit Testing Protocol (source of truth)

Everything flows through the truth protocol (no pass without evidence; the watchdog
re-verifies every pass) and every generated check cites a real standard. Plain
language in all output. Never collapse specific checks into a generalization.

## A) Platform coverage — 10 platforms

Each platform gets its own full, specific check set (draw shared checks from the
catalog, add platform-specific ones where it's thin; do not reuse a generic set
across platforms):

1. Marketing/landing site
2. Web app/SaaS
3. E-commerce store
4. Mobile app (iOS/Android)
5. API/backend
6. AI chatbot/voice
7. Blog/CMS
8. Browser extension
9. Internal tool/admin
10. Sales funnel (lead form actually saves the lead, every CTA routes correctly,
    each step flows with no dead end, thank-you/confirmation fires, payment+upsell
    work, tracking pixels fire, fast on mobile).

## B) Two components, tested wherever present

- **Database** — real indexes, migrations, backups, row-level security, pooling, no
  secrets in connection string. Where possible connect to the real DB via the
  Supabase/PlanetScale MCP servers to check the invisible items.
- **MCP server** — requires auth, tools injection-safe, no secret leakage in tool
  output, destructive tools gated.

## C) Process upgrades (build all five)

1. Auto-detect the platform from the repo + live site, and run the matching check set
   automatically.
2. Every finding includes a ready-to-paste fix prompt for the user's AI builder.
3. Every report leads with "Fix these 3 first" (the launch-blockers).
4. Two reports per run: a client-facing one-pager + the detailed builder report.
5. "Prove it's fixed" re-run: re-check only prior failures and show before → after.

## D) Bonus SEO report on every audit

A Google-ranking section: what helps ranking, what hurts, and the exact fixes,
appended to every report regardless of platform.

## Build order

1. Platform auto-detect + routing
2. The funnel platform
3. The report upgrades (SEO bonus, fix-these-3-first, paste-ready fixes, two reports, re-run)
4. Fill remaining platform-specific checks from the catalog

## Definition of done (per piece, no exceptions)

Before claiming any piece done: `npm test` green, `npm audit` clean, verified against
`fixtures/buggy-shop` (extend the fixture where a platform needs surfaces it lacks; if
something genuinely can't be tested, mark it blocked — never fake a pass). Commit each
piece with a message naming what it covers, and push.
