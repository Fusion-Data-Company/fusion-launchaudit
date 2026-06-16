# LaunchAudit — Production Hardening Tracker

Goal: take the engine from an honest 88/100 to a beta-tested, trustworthy, genuinely
valuable product — accurate enough that a developer stakes their name on every finding.
Driven 2026-06-15. One phase at a time, each verified before moving on.

## Phase 0 — Correctness foundation ✅ DONE
- [x] Scanner false-positive root cause fixed: `extractApiMethods` now parses a
      handler's real `request.method` guards instead of assuming GET+POST
      (`runner/repo-scanner.ts`). Killed the 4 GET-only false positives.
- [x] Regression test pinning the four handler shapes (`runner/repo-scanner.test.ts`).
- [ ] `/api/campaigns` POST has no auth — but it's called anonymously by the dashboard
      UI (`public/assets/app.js`). Real fix = dashboard auth, folded into Phase 1/4
      rather than a hasty gate that breaks the create flow. The tool itself correctly
      classifies this `needs_verification`, not a claimed vuln.

## Phase 2 — Test suite (credibility spine) ✅ DONE
- [x] `npm test` harness (node:test + --experimental-strip-types).
- [x] classifier (Truth Protocol branches) — `runner/classify.test.ts` (12).
- [x] write-authz tiers — `src/lib/generators/write-authz.test.ts` (5).
- [x] card-generator hint derivation + honest blocked cards — `src/lib/card-generator.test.ts` (4).
- [x] ElevenLabs + SEO detectors — `src/lib/generators/detectors.test.ts` (5).
- [x] scanner method extraction (3). Total: 29 tests passing.

## Phase 1 — Trust surface (no fake data posing as real) ✅ DONE
- [x] Dashboard seeded data audited — already honestly labeled ("Demo: Sample
      Campaign", "sample data", visible "Sample data" notes). No change needed.
- [x] New `content_integrity` detector: lorem filler, unbound undefined/NaN,
      hardcoded localhost on deployed targets, placeholder markers
      (`runner/content-audit.ts`, `src/lib/generators/content-integrity.ts`,
      executor `content` action, classifier branch, 12 tests).
- [x] Verified live: self-audit generated + passed 4 TC-CI cards; write-authz
      cards dropped 7→3 (false positives gone). 38 tests passing.

## Phase 3 — Close value gaps
- [ ] ElevenLabs path made first-class in the default flow (not hints-only) where possible.
- [ ] Accessibility (axe-core), Core Web Vitals.

## Phase 4 — Dashboard to premium grade
- [ ] Real data only, dark+light, mobile, zero console errors; FDC design register.
- [ ] Dashboard auth decision (resolves the Phase 0 `/api/campaigns` item).

## Phase 5 — Beta test on real apps
- [ ] Run against real client repos + deployed URLs; drive false positives to zero.

## Phase 6 — Client-ready report + docs polish
- [ ] Exportable plain-English + technical report; install/usage/taxonomy docs.
