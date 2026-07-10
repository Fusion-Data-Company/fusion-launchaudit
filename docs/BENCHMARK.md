# 80/20 Launch Audit — Public Benchmark

**The claim, measured on a shared corpus you can run yourself.** Most DAST/QA vendors publish
marketing numbers; nobody publishes head-to-head recall/precision on an open planted-vuln
corpus — because most would lose. This is that corpus and that table.

## The corpus (ground truth)

Two fixtures ship in this repo, with the planted bugs documented in `fixtures/buggy-shop/BUGS.md`:

- **`fixtures/buggy-shop`** — a zero-dependency app with 5 planted bug classes (RBAC direct-URL,
  admin-API exposure, malformed-input 500, mobile overflow, missing security headers). A tool
  must catch all of them.
- **`fixtures/shop-fixed`** — the corrected variant. A tool must score it clean: **zero false
  positives.**

Recall = planted-bug categories caught on buggy-shop. Precision = 1 − (false positives on the
clean app). Both are computed by `npm run benchmark` (`scripts/calibrate.ts`) on every CI run,
so the number below is **earned, not asserted** — a drift fails the build.

## Leaderboard

| # | Tool | Recall | Precision | F1 |
|---|------|--------|-----------|-----|
| 1 | **80/20 Launch Audit** | 100% | 100% | 1.000 |
| — | OWASP ZAP (baseline) <sub>run to populate</sub> | — | — | — |
| — | Nuclei <sub>run to populate</sub> | — | — | — |
| — | Semgrep <sub>run to populate</sub> | — | — | — |

> **Truth Protocol in the leaderboard too:** only measured rows carry numbers. Competitor rows
> are placeholders until someone runs that tool against `fixtures/` — we never publish a score
> we didn't measure. The rendering (`src/lib/report/benchmark.ts`) enforces this: an unmeasured
> row shows "—" even if fields are set.

## Reproduce it

```bash
git clone https://github.com/Fusion-Data-Company/fusion-launchaudit.git
cd fusion-launchaudit && npm install && npx playwright install chromium
npm run benchmark    # runs both fixtures, prints recall/precision, exits non-zero on drift
```

To add a competitor: run it against the two fixture apps (`node fixtures/buggy-shop/server.js`
on :4400, `node fixtures/shop-fixed/server.js` on :4401), count caught planted-bug categories
and false positives, and fill its row. PRs welcome.

## Why this is the honest benchmark

- **Shared, open corpus** — the exact apps and the exact planted bugs are in this repo.
- **Measured on every push** — the calibration gate (`scripts/calibrate.ts`) recomputes it in CI.
- **No cherry-picking** — recall AND precision, together; a tool that flags everything to boost
  recall tanks its precision here.
