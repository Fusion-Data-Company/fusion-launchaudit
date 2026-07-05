# Contributing to 80/20 Launch Audit

## Setup

Requires Node.js 22.6.0 or newer (all scripts pass `--experimental-strip-types`).

```bash
npm install
npx playwright install chromium chromium-headless-shell
```

## npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | Local dashboard dev server at `http://127.0.0.1:3010` |
| `npm run build` | Writes campaign JSON, bundles the Vercel API handlers, smoke-runs the local runner |
| `npm run audit` | The standalone audit CLI (`runner/audit.ts`); pass flags after `--` |
| `npm run mcp` | Starts the MCP server (`runner/mcp-server.ts`) on stdio |
| `npm run runner:print` | Prints the runner sync payload without sending it |
| `npm run runner:sync` | Seeded simulation sync against the campaign API |
| `npm run runner:scan` | Real repo scan of this repo (`--repo <path>` for any repo) |
| `npm run db:verify` | Full Postgres layer verification using in-process PGlite (no real DB needed) |
| `npm run build:api` | Bundles `api/*.ts` handlers for Vercel function packaging |

## Running the fixture tests

The fixtures are the ground truth for audit quality. `fixtures/buggy-shop` is a
zero-dependency Node HTTP app with 5 planted bugs (documented in
`fixtures/buggy-shop/BUGS.md`); `fixtures/shop-fixed` is the same app with the
bugs fixed.

**The fast path — the automated gate (what CI runs):**

```bash
npm run test:fixtures   # boots both fixtures, asserts buggy-shop catches all 5
                        # planted bug classes + the Launch Gate FAILS, and shop-fixed
                        # scores 100/100 with zero false positives + the Gate PASSES.
npm run test:mutation   # re-breaks the clean fixture one detector at a time and asserts
                        # each re-introduced defect is caught (kill-rate must be 100%).
```

Both need a browser (Playwright Chromium) and run in the `fixtures` CI job on every
push/PR — a recall drop, a new false positive, or a detector that stops catching its
bug fails the build. Run them locally before opening a PR that touches a generator,
the executor, or the classifier.

> On scoring: `shop-fixed` reaches a legitimate **100/100** over local http because
> readiness is "of the checks we could actually RUN, what fraction passed" — checks
> that can't run without https/creds/a lockfile (TLS/HSTS, the cross-user authz wedge,
> the CVE scan) are reported as *coverage gaps* by the Launch Gate, not counted against
> the score. The buggy fixture proves the wedge *catches*; the clean one proves *no
> false positives*.

**The manual path (for debugging a single fixture):**

1. Start the buggy fixture (listens on `http://127.0.0.1:4400`):

   ```bash
   node fixtures/buggy-shop/server.js
   ```

2. Audit it, with hints so the protected-surface checks run (the fixture hints
   list the admin routes, the guarded API, and the login path):

   ```bash
   node --experimental-strip-types runner/audit.ts \
     --name "buggy-shop fixture" \
     --app-url http://127.0.0.1:4400 \
     --repo fixtures/buggy-shop \
     --hints fixtures/buggy-shop/launchaudit-hints.json \
     --out launchaudit-report-fixture
   ```

3. Check the result against `fixtures/buggy-shop/BUGS.md`: the audit must catch
   all 5 planted bugs and must not flag the routes listed as intentionally
   correct.

4. Repeat against `fixtures/shop-fixed` (same steps, swap the directory, port
   `4401`). The fixed variant scores 100/100 with zero false positives — this is
   what `npm run test:fixtures` asserts mechanically.

A change to a generator (`src/lib/generators/`), the executor, or the
classifier (`runner/classify.ts`) should be validated against both fixtures
before review: recall must not drop on `buggy-shop` and false positives must
not appear on `shop-fixed`.

## Code layout

- `runner/` - audit pipeline: CLI, crawler, executor, classifier, report
  renderer, MCP server.
- `src/lib/generators/` - test-card generators (frontend, backend, admin-rbac,
  middleware, security).
- `claude-code/` - the skill and slash command installed into Claude Code.
- `api/`, `public/`, `server/` - the optional hosted dashboard.
- `docs/research/` - gap analysis and the research behind the check catalog.

## Conventions

- TypeScript run directly by Node via type stripping; no build step for the
  runner. Keep new runner code free of TS features that stripping cannot
  handle (no enums, no namespaces, no parameter properties).
- Honest results are a hard requirement: a check that cannot run reports
  `needs_input` or `needs_verification`; it never silently passes. New checks
  must attach evidence artifacts.
- Do not commit secrets, `.env*` files, or generated `launchaudit-report-*/`
  directories (all gitignored).
