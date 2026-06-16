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

## Phase 3 — Close value gaps ✅ DONE
- [x] Accessibility detector via axe-core (WCAG 2.0/2.1 A+AA, serious/critical floor)
      — `runner/axe-audit.ts`, `src/lib/generators/accessibility.ts`, `axe` browser
      action, classifier branch, tests. Verified live: caught 45 real color-contrast
      violations on our own dashboard.
- [x] Core Web Vitals detector (LCP/CLS/FCP/TTFB cold-load smoke; poor-range only;
      classified needs_verification by design) — `runner/web-vitals-audit.ts`,
      `src/lib/generators/performance.ts`, `web_vitals` action, classifier, tests.
- [x] ElevenLabs: already a full first-class detector (hints-gated because agent IDs +
      API key are required — correct; cannot be auto-detected without them).
- 51 tests passing; all 12 categories fire in the live self-audit.

Real findings the new detectors surfaced on our own dashboard (feed Phase 4):
- A11Y: 45 elements fail WCAG AA color-contrast (serious). → fix in dashboard CSS.
- PERF: a Core Web Vital in the poor range on cold load → verify.

## Phase 4 — Dashboard to premium grade ✅ DONE
- [x] Fixed the accessibility defect the tool caught on itself: 45 WCAG AA
      color-contrast violations → 0 in BOTH dark and light themes. Bumped --fg-4
      (both themes), darkened light-mode status colors, fixed one .verify-box
      label. Verified by driving a real browser with axe (0 serious+ violations).
- [x] Resolved the Phase 0 `/api/campaigns` write gap: gated POST behind the
      operator secret (authorizeRunnerWrite) in BOTH the serverless handler and
      the dev server; UI now sends the operator key (prompt + retry on 401),
      anonymous visitors blocked. Verified: no token / wrong token → 401, GET → 200.
- [x] Real data / honest demo labeling confirmed in Phase 1.
- NOTE: the prompt-on-401 create flow was verified at the HTTP layer (401/200),
  not yet clicked through the modal in a browser.

## Phase 5 — Beta test on real apps ✅ DONE
- [x] Audited 3 live sites (body-temple, northern-roots, + the dashboard self-audits)
      across different stacks. ZERO false positives observed — content-integrity
      passed on all real copy; every finding was a plausible real issue (missing
      security headers, real a11y violations, SEO gaps correctly downgraded to verify).
- [x] Robustness: the tool bails cleanly (no crash) on dead sites. Added actionable
      unreachable reasons — distinguishes HTTP 5xx ("deployment up but failing") from
      DNS failure from timeout (`runner/crawler.ts` + `runner/audit.ts`).
- Real operational findings surfaced for Rob: lutherpools.com is DNS-down;
  sparrow-mitigation-platform returns 503.

## Phase 6 — Client-ready report + docs polish
- [ ] Exportable plain-English + technical report; install/usage/taxonomy docs.
