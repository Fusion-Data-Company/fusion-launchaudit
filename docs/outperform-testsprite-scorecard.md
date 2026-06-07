# Outperform TestSprite Scorecard

This product wins only if evidence proves it is better in the categories below.

| Category | Required Fusion Behavior | Current Status |
|---|---|---|
| Codebase context | Local runner inspects repo, scripts, routes, API handlers, env expectations, and existing tests before planning. | Seeded contract implemented; real scanner next. |
| Runtime truth | Campaign crawls the live/local URL, captures console/network failures, screenshots, traces, and route reachability. | Contract implemented; Playwright runner next. |
| Test specificity | Every test card includes goal, risk, steps, data needs, expected evidence, and acceptance criteria. | Implemented in seeded test-card model. |
| Auth handling | User-guided auth state is captured locally; production credentials are not pasted into the web app. | Contract implemented; browser-state capture next. |
| Failure classification | Failures are classified as product bug, test bug, environment issue, missing context, flaky behavior, or unclear requirement. | Implemented in finding model. |
| Repair packets | Product bugs generate coding-agent-ready tasks with likely files, repro steps, expected behavior, verification command, and agent prompt. | Implemented in seeded repair tasks. |
| Blocked-gap honesty | Missing sandbox keys and unsupported integrations are reported as blocked, not silently skipped or counted as passed. | Implemented in seeded campaign and scorecard. |
| Model flexibility | Planning, repo analysis, runtime crawl, test generation, classification, repair writing, visual review, and traffic analysis can route to different models/providers. | Seed contract implemented with 5 provider slots, 7 routes, fallbacks, and quality gates; live invocation adapters next. |
| Deployment ownership | Web reporting deploys to Vercel while private code execution stays local through MCP. | Static/serverless structure implemented. |

## Proof Gates

The product cannot claim production readiness until these pass:

1. Connect a real JS/TS repo and staging/local URL.
2. Generate at least 12 nuanced test cards from repo + runtime context.
3. Execute at least one auth flow, one role flow, one form edge case, one responsive check, one API/console check, and one blocked integration check.
4. Produce artifacts for each executed test: screenshot and structured assertion at minimum; trace/video for failures.
5. Classify every failure with a finding type and severity.
6. Generate repair tasks for every product bug.
7. Re-run at least one repaired failure and show the before/after proof.
8. Export a client-ready launch audit with blocked checks and unsupported gaps visible.

## What Better Looks Like

Better is not “more tests.” Better is:

- More repo-aware.
- More specific.
- More honest about blocked areas.
- More useful to coding agents.
- More verifiable after fixes.
- More controllable over model/provider choice.
