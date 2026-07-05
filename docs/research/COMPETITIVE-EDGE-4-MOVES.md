# 80/20 Launch Audit — 4 Ultra-High-Impact Moves

*Competitive + frontier intel, June 2026. Four scouts combed funded competitors, top open-source repos, and the research frontier (Karpathy / OpenAI eval / security-testing academia). Every claim carries a source. Cross-checked against `docs/planning/BEST-IN-CLASS-ROADMAP.md` so each move is either net-new or a sharper, proven version of something already planned.*

## The one thing the whole field agrees on
Verification is the bottleneck in AI right now — and it only works when the verdict is grounded in **external, deterministic evidence, not the model's own opinion**. Karpathy calls it the "verification gap" ([source](https://x.com/karpathy/status/1930305209747812559)); the academics proved LLM self-checking *hurts* without an external signal ([source](https://arxiv.org/abs/2402.08115)) and that LLM "judges" are trivially fooled ("one token" flips them to false-positive 80% of the time — [source](https://arxiv.org/abs/2507.08794)). **Your Watchdog + Truth Protocol are already on the right side of this.** All four moves below double down on that edge instead of diluting it.

Independent proof the wedge is the right wedge: the industry's own bug-finding benchmark (Bismuth SM-100) shows popular AI agents hit **~7% recall at 90%+ false-positive rates** on complex bugs ([source](https://www.zenml.io/llmops-database/benchmarking-ai-agents-for-software-bug-detection-and-maintenance-tasks)), and an independent field test found AI autofix fails most on **access-control bugs** specifically ([source](https://safeguard.sh/resources/blog/snyk-agent-fix-autofix-field-test-2026)). Authorization depth + honest classification is the field's hardest, least-solved problem. That's our moat.

---

## MOVE 1 — Two-identity "metamorphic" authorization probing (deepen the moat)
**Status: sharpens roadmap #5/#6 — and goes deeper, with named, peer-reviewed recipes.**

**Plain version:** Log in as a normal user *and* as an admin. Then, as the normal user, try to do everything the admin can — read it, change it, delete it, reach it by guessing the URL. The rule that needs no "right answer" to check: *a lower-privilege user's response must never contain more than a higher-privilege user's.* Strip the auth cookie entirely → the response must not grow. These are "metamorphic relations" — comparisons between two related requests — so they work on **any app with no spec and no oracle.**

**Who proves it:**
- Microsoft Research **RESTler** ships exactly these as named, peer-reviewed "security checkers": `NameSpaceRule` (replay user A's resource as user B → IDOR/BOLA), `ResourceHierarchy` (reach a child under the wrong parent), `UseAfterFree` (resource still reachable after DELETE), `Leakage` (a failed create still leaks the resource later). [Checker catalog](https://github.com/microsoft/restler-fuzzer/blob/main/docs/user-guide/Checkers.md)
- University of Luxembourg **SMRL** — a catalog of **22 system-agnostic security metamorphic relations**; caught 100% of an industrial system's and 75–85% of Jenkins/Joomla's target vulns. [SMRL](https://sntsvv.github.io/SMRL/) · [paper](https://arxiv.org/abs/2208.09505)
- Commercial confirmation: **StackHawk** shipped "Business Logic Testing" (multi-profile cross-user probing) in Dec 2025 — the closest competitor to our wedge, but **wire-only and OpenAPI-spec-dependent.** [launch](https://www.stackhawk.com/blog/business-logic-testing/)

**How it bolts onto us:** Extend the authz generators (`src/lib/generators/object-authz.ts`, `write-authz.ts`, `admin-rbac.ts`) with **dependency-aware request sequencing** — create a resource as the privileged user, then re-access it as the under-privileged user / wrong parent / after delete. Add a sequenced two-identity `ExecStep` in `runner/executor.ts` + dispatch in `execute-core.ts`, a classify branch, and wire the Conductor to fire it at **L2 (deep wedge)**. We already capture admin + user sessions (`runner/capture-auth.ts`, hints `admin_creds`/`user_creds`) — the substrate is there. Our edge over StackHawk: we read the **server-side guard source AND probe the running route**, no spec required.

**Impact:** This is the moat, made deeper and turned into proven, named test sequences competitors are racing to ship. Highest wedge leverage on the list.
**Effort:** Medium (new exec action + sequencing; reuses existing auth capture).

---

## MOVE 2 — Compounding triage memory (make honesty get smarter over time)
**Status: net-new capability (beyond the planned `.launchauditignore`, roadmap #11).**

**Plain version:** Every time a human says "that's fine, that admin route is *meant* to be public" or "the dev-bypass login is expected locally," the tool **remembers it** — as a reusable rule, not a one-off mute — and auto-applies it on every re-audit *and on other sites with the same pattern.* False alarms drop over time, and the tool quietly learns *your* way of building.

**Who proves it:** **Semgrep "Assistant Memories."** With memory off, it filtered 18 false positives on a sample; with memory on, **588 — a 30× swing.** Net effect: ~20% fewer findings to triage on day one, improving from there, with **users agreeing with the auto-triage 95% of the time across 250k+ findings.** [memories blog](https://semgrep.dev/blog/2025/announcing-ai-noise-filtering-and-triage-memories/) · [overview](https://semgrep.dev/docs/semgrep-assistant/overview). Conceptual frame from **Aikido's "Swiss-cheese" layered filtering** (stack independent honesty checks so only true positives survive every layer): [source](https://www.aikido.dev/blog/autotriage-and-the-swiss-cheese-model-of-security-noise-reduction).

**How it bolts onto us:** A small persistent store (local hub / PGlite now, Neon for the hosted center) keyed by a **finding signature + pattern** (route shape, guard idiom, framework). Consult it in `runner/classify.ts` / `verdict.ts` to auto-downgrade known-accepted patterns; surface an "accepted risk (N)" count in `render-report.ts`; the Conductor reads/writes it each run. Generalize the accept rule by pattern so it carries across a client's repos. **Hard rule:** never let memory silence a *confirmed* security/authz product bug without an explicit, logged override.

**Impact:** Your entire differentiator is trust. This makes accuracy **compound** — and directly delivers the "knows my ways" goal, because the tool literally learns your conventions.
**Effort:** Medium (store + lookup + override guardrail).

---

## MOVE 3 — `pass^k` consistency scoring (turn flakiness into a security finding)
**Status: net-new.**

**Plain version:** Run each check several times, not once. Only call it a pass if it passes **every single time.** And here's the kicker: if a protected door is locked 7 times but swings open the 8th — that's *worse* than always-open, because it hides from a single test. Flag intermittent authorization **loud**, as a high-severity finding, with the exact hit rate ("authorized 7/8, exposed 1/8").

**Who proves it:** Sierra's **τ-bench** introduced `pass^k` (probability of success across *all* k trials) precisely because even strong agents are wildly inconsistent — pass^8 under 25% where single-shot looked fine; it's now reported on frontier model cards. [paper](https://arxiv.org/abs/2406.12045) · [blog](https://sierra.ai/blog/tau-bench-shaping-development-evaluation-agents). **QA Wolf's** flake system validates the operational rules: retry on the same commit/env, **cap at 2–3**, and *change conditions on each retry* to actively surface timing/order flakes. [source](https://www.qawolf.com/blog/what-your-system-should-do-with-a-flaky-test). Backed by the self-correction literature: reliable verdicts come from re-running against fresh evidence, not re-thinking. [source](https://arxiv.org/abs/2402.08115)

**How it bolts onto us:** Extend the Watchdog (`runner/watchdog.ts`) and the retry path in `execute-core.ts` to re-probe a pass **k times under fixed conditions** (same build, network, seed — so the variance you report is the app's, not the harness's). Add a flakiness rate to the `Verdict` model (`verdict.ts`) and a new **"intermittent authorization"** severity in `classify.ts`; render it in the report. Upgrades your existing "passed on retry → flaky" logic from a footnote into a quantified risk class.

**Impact:** Turns the 0–100 readiness score from "a number" into "a *reproducible* number," and converts flakiness from noise into a finding nobody else reports. Cheap, and pure honesty-wedge.
**Effort:** Low–Medium (you already retry; this quantifies and re-routes it).

---

## MOVE 4 — Prove your catch-rate with mutation testing (a number competitors can't fake)
**Status: sharpens roadmap #12/#17 — with the rigorous method the eval field is converging on.**

**Plain version:** Deliberately break your *own* clean test site in small ways — flip an authz check, drop a guard, weaken a header — and measure what fraction your detectors catch. That gives you a hard, defensible number for the box: **"kills 92% of planted authorization bugs, zero false alarms on the clean app."** Every break that *slips through* is an auto-generated to-do for a new detector. You're testing your tests.

**Who proves it:** **Stryker / PITest** mutation testing — the standard method for proving a test suite actually catches bugs (coverage alone is a vanity metric). [Stryker](https://stryker-mutator.io) · [why coverage isn't enough](https://about.codecov.io/blog/mutation-testing-how-to-ensure-code-coverage-isnt-a-vanity-metric/). Why it matters now: OpenAI *retired* SWE-bench Verified after finding **59% of hard tasks had weak tests** that pass wrong fixes ([post-mortem](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/)); SWE-Bench+ found **31% of "passing" patches slipped through too-weak tests** ([source](https://arxiv.org/abs/2410.06992)). A passing weak check is worse than no check — which is exactly the logic behind your `[SPA_SHELL]` downgrade, generalized.

**How it bolts onto us:** A dev harness (`scripts/`) that programmatically mutates `fixtures/shop-fixed`, runs the audit, and reports the **kill rate** per detector family; wire it into CI (`.github/workflows/ci.yml`) so a detector that regresses fails the build. Publish the number in the README and the report. For every detector, also ask *"what plausible-but-wrong state would also pass this?"* and throw that mutation at it.

**Impact:** Converts your honesty claim into a **marketable, defensible metric** — a direct counter to the 90%-false-positive competitors — and gives you a self-refilling backlog of exactly which detectors to build next.
**Effort:** Medium (test harness; reuses fixtures + CI).

---

## Honorable mentions (build after the top 4)
- **Multi-signal evidence** — fuse screenshot + DOM + accessibility-tree snapshot per check (Skyvern, Playwright-MCP). Hardens the SPA-shell rule (a real exposed admin page *looks* different from an empty client shell) and feeds the a11y detector nearly free. [Playwright-MCP](https://github.com/microsoft/playwright-mcp) · [Skyvern](https://github.com/Skyvern-AI/skyvern)
- **Shrink failing inputs to minimal reproducers** before they hit the report (Hypothesis): `qty=-1 → 200 + negative total` beats a 2KB fuzz blob. [Hypothesis](https://hypothesis.readthedocs.io)
- **SARIF output** (`--format sarif`) → findings land as GitHub PR annotations with zero integration work (already roadmap #13). [GitHub SARIF](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning)
- **Agreement-as-confidence** — for borderline findings, require multiple independent aspect-checks to concur before escalating; a *split* is honest grounds to stay `needs_verification`. Distills to a laptop-sized local verifier (fits no-API-key). [Weaver](https://hazyresearch.stanford.edu/blog/2025-06-18-weaver)
- **EPSS + CISA KEV ranking** on dependency findings → "patch THIS today" (already roadmap #20). [EPSS](https://www.first.org/epss/) · [KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)

## One honest caveat
Most of the *quantified* numbers above come from coding/reasoning/security benchmarks, not web-app launch-auditing specifically. The *directional* lessons (external grounding, consistency, gameability-testing, compounding memory) are robust and architecture-agnostic; the exact magnitudes won't transfer. Validate every adopted idea against your own `buggy-shop` / `shop-fixed` ground truth before trusting it — which is itself Move 4.

## Net read of the field
No competitor combines (a) *running-app* authorization depth, (b) an *honesty/verification* protocol, and (c) *runs locally inside the dev's own coding agent, no backend, no API key*. StackHawk owns API-side authz but is wire-only and spec-dependent; Cursor Bugbot (2M PRs/mo) and CodeRabbit own scale but do diff-scoped PR review, not a standards-based launch verdict. The best technique donors are Semgrep (triage memory), QA Wolf (flake taxonomy), the RESTler/SMRL academics (named authz recipes), and the eval frontier (pass^k, mutation testing, agreement-as-confidence). Your Watchdog + two-identity capability + fixture harness are already the right substrate — these four moves are mostly *named, proven recipes* dropped onto it.
