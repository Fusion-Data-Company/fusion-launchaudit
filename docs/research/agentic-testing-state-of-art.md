# Agentic / AI-Driven Software Testing — State of the Art (2025–2026)

> Research brief to upgrade **LaunchAudit** and design its self-improvement loop.
> Compiled 2026-06-11. All external claims cited inline; sources listed at the end.
>
> **Read this against the current code.** LaunchAudit today is a deterministic
> Playwright + HTTP runner (`runner/execute-core.ts`) fed by four taxonomy
> generators (`src/lib/generators/{frontend,backend,admin-rbac,middleware}.ts`)
> and a runtime crawler (`runner/crawler.ts`). It already does the thing the
> rest of the industry is *converging toward*: deterministic execution with the
> model used for planning/diagnosis, not as the source of truth. The upgrades
> below sharpen that edge — they do not replace the engine with an LLM.

---

## 0. Executive summary (read this if nothing else)

The 2025–2026 field has settled on a clear architecture, and it matches
LaunchAudit's existing bet:

1. **Deterministic execution, AI planning/diagnosis.** The winning pattern is
   Playwright (or equivalent) doing the actual clicking and asserting, with an
   LLM agent generating the plan, classifying failures, and proposing repairs.
   Microsoft shipped exactly this as **Playwright Test Agents (planner /
   generator / healer)** in v1.56 ([playwright.dev/docs/test-agents][pw-agents]).
2. **Accessibility-tree-first, not screenshot-first.** MCP-driven agents read
   the a11y tree / DOM snapshot for element identification because it is
   deterministic, auditable, and far less prone to hallucination than pixels
   ([testeragents.com][testeragents], [TestDino][testdino-pw]).
3. **Failure classification is the hard part, and the literature is a warning.**
   OOPSLA 2025 found prior flaky-test classifiers were overstated by ~29 F1
   points because of data leakage and unrealistic class balance; corrected, the
   best fine-tuned classifier hit only **67.5% F1**
   ([SPLASH/OOPSLA 2025][oopsla]). LaunchAudit must treat its
   `product_bug | test_bug | flaky | needs_input` classifier as *fallible*,
   evidence-grounded, and self-measured — never as ground truth.
4. **Self-improvement is now a known recipe.** A self-improving agent needs four
   parts: a task, a benchmark harness, diagnostic feedback, and a persistent
   learning store ([MindStudio][mindstudio-loop], [o-mega][omega]). Claude Code
   + binary evals is the canonical hand-rolled version
   ([MindStudio binary evals][mindstudio-evals]); Anthropic's own eval guidance
   is the authoritative ruleset ([Anthropic][anthropic-evals]).

**Top 5 concrete upgrades** (detailed in §6):

| # | Upgrade | Why it wins |
|---|---|---|
| 1 | **Failure classifier with confidence + evidence bundle** (`product_bug / test_bug / flaky / needs_input`) backed by HAR + console + DOM snapshot + per-attempt trace | This is the differentiator and the riskiest part; do it grounded and humble (OOPSLA warning). |
| 2 | **Bounded retry + flake fingerprinting** (`trace: 'on-first-retry'`, 2–3 attempts, same commit/env, flip-rate tracking) | Industry-standard boundary between noise and signal; never silently re-run. |
| 3 | **Self-healing locators via accessibility tree** (getByRole/getByLabel preference + a healer pass that re-resolves a broken selector against the live a11y tree before declaring a product bug) | Microsoft's Healer hits >75% on selector failures; stops "test bug" masquerading as "product bug." |
| 4 | **Semantic / visual regression layer** (baseline screenshots + DOM-scoped diffing + dynamic-content masking; optional LLM-as-judge for "does this look broken") with strict false-positive controls | Catches the class of bugs HTTP/console checks never see; but must suppress noise. |
| 5 | **The improvement loop itself** (`launchaudit-evals/` fixture corpus + binary scorer + scheduled Claude Code job that proposes new check generators / skills and gates them behind eval deltas) | Turns LaunchAudit from a static tool into a compounding asset. |

**Improvement-loop design** in §5 and §6.5. **File written:**
`/Users/robertyeager/Dev/ACTIVE PROJECTS/fusion-launchaudit/docs/research/agentic-testing-state-of-art.md`.

---

## 1. Agentic e2e testing patterns

### 1.1 Playwright Test Agents (the reference implementation)

Microsoft shipped **Playwright Test Agents** in **v1.56** — three agents in an
agentic loop ([playwright.dev/docs/test-agents][pw-agents],
[DEV community][dev-pw], [TestDino][testdino-pw]):

- **Planner** — explores the app, executes a **seed test** to establish
  environment/fixtures, and emits a human-readable Markdown plan to
  `specs/[name].md`. Optionally takes a PRD as input.
- **Generator** — turns the Markdown plan into executable Playwright test files
  under `tests/`, *verifying selectors and assertions live as it performs each
  scenario*. Output may contain initial errors.
- **Healer** — runs failing tests in debug mode; inspects **console logs,
  network requests, and page snapshots** to find root cause; suggests patches
  (locator updates, wait adjustments, data fixes); re-runs until passing or a
  guardrail halts it. **May *skip* a test if the functionality itself appears
  broken** — i.e. it distinguishes "my selector is stale" from "the product is
  broken," which is exactly LaunchAudit's classification problem.

Setup: `npx playwright init-agents --loop=[claude|vscode|opencode]`. Agent
definitions regenerate on each Playwright update. Microsoft's published
benchmark: **Healer >75% success on selector-related failures**
([testeragents.com][testeragents], [TestDino][testdino-pw]).

**Relevance to LaunchAudit:** the planner→generator→healer split is a clean
mental model for LaunchAudit's own pipeline (crawl→generate→execute→heal/classify).
LaunchAudit already owns the generator and executor; the **healer** is the
biggest missing piece and the highest-leverage add (Upgrade #3).

### 1.2 The MCP browser-tool model

Playwright MCP (`microsoft/playwright-mcp`, npm + Docker) exposes the browser as
a fixed tool set (`browser_click`, `browser_navigate`, `browser_snapshot`, …).
The LLM receives **DOM snapshots and accessibility trees on each step**, decides
an action, and the MCP server executes it ([testeragents.com][testeragents]).
The default **snapshot mode reads the accessibility tree** for fast,
deterministic, auditable element identification instead of relying on
screenshots ([testeragents.com][testeragents], [TestDino][testdino-pw]).

**Strengths:** reproducible, auditable, low hallucination, runs locally (no
vendor cloud), works with Claude/Cursor/VS Code.

**Documented failure modes** (cite these in LaunchAudit's own docs as known
risks):
- MCP-driven agents **over-confidently click the first element matching a goal**
  even when several similar elements exist, and **silently skip steps that
  depend on transient state** ([testeragents.com][testeragents]).
- The Planner needs **well-structured apps with good a11y markup** to produce
  useful plans; the Generator still produces tests that **need human review**
  before CI ([Playwright AI ecosystem / TestDino][testdino-ecosystem]).

### 1.3 browser-use / computer-use agents (autonomous exploration)

These are LLM-driven agents that navigate by understanding page context rather
than scripted selectors, adapting in real time when the UI changes:

- **Benchmarks (WebVoyager):** Browser Use ~**89.1%**, OpenAI CUA **87%** (and
  **58.1%** on the harder WebArena), Project Mariner **83.5%**
  ([o-mega benchmarks][omega-bench], [Firecrawl][firecrawl-agents]).
- **Autonomous exploratory testing** = curiosity-driven probing of interaction
  paths engineers never anticipated, correlating visual anomalies with
  functional failures and maintaining a live state-machine model of the app
  ([TestQuality][testquality]). Teams report *different defect profiles* — fewer
  escaped edge cases, more coverage of unintended interaction paths
  ([o-mega][omega-bench]).

**Limitations / failure modes:**
- **Cost & resource intensity** — Operator/agent modes gated behind Plus/Pro/Ultra
  tiers; autonomous browsing is expensive ([o-mega benchmarks][omega-bench]).
- **Non-determinism** — WebArena/WebVoyager numbers are *single-attempt* success;
  reliability for a gating QA tool needs pass^k thinking (see §5.4).
- **Prompt-injection vulnerabilities** documented across agentic browsers;
  cloud testing also hits bot-detection/CAPTCHA that local testing avoids
  ([o-mega benchmarks][omega-bench]).

**Relevance to LaunchAudit:** use an autonomous-exploration pass as a
**card-discovery / coverage-gap finder** (feeding the deterministic generators),
**not** as the gate. LaunchAudit already does a deterministic crawl
(`runner/crawler.ts`); an optional agentic crawl that proposes additional
flows/routes — then hands them to the deterministic generators — is the safe way
to borrow this power. Keep the gate deterministic.

### 1.4 Meta's "JiTTesting" signal

Meta argues agentic development broke traditional always-on test suites and is
reviving **just-in-time testing** — generate/run the tests relevant to *this*
change, on demand ([Meta Engineering][meta-jit]). This validates LaunchAudit's
campaign model: an on-demand deep audit scoped to a launch, not a permanently
green CI wall.

---

## 2. Flaky / false-failure handling (the core of LaunchAudit's honesty)

This section is the most important for the `product_bug vs test_bug vs flaky vs
needs_input` requirement.

### 2.1 The research warning — do not trust your own classifier

**OOPSLA 2025, "Understanding and Improving Flaky Test Classification"**
([SPLASH 2025][oopsla]):

- Prior flaky-test classifiers **over-estimated accuracy** due to (1) flawed
  experiment design (information leakage between train/test) and (2)
  misrepresenting the **real distribution** of flaky vs non-flaky tests.
- Corrected, performance fell from **85.38% → 56.62% F1** (−28.76 pts).
- Their best fine-tuned model, **FlakyLens**, reached **67.5% F1** — and *beat
  general-purpose LLMs* on the same task.

**Implications for LaunchAudit (bake these in):**
1. Validate any classifier against a **realistic class balance** (real apps are
   mostly non-flaky; a 50/50 eval set lies to you).
2. **Prevent leakage** — never evaluate on fixtures the generators/classifier
   were tuned on.
3. **A narrow, domain-tuned classifier beats a generic LLM** here — so
   LaunchAudit's classifier should be heavily evidence-grounded and rule-assisted,
   not "ask the model what it thinks."
4. **Always attach a confidence and the evidence.** Never emit a bare verdict.

### 2.2 Retry as the noise/signal boundary

Consensus across QA Wolf, TestDino, Functionize, Katalon, minware
([QA Wolf][qawolf], [TestDino flaky][testdino-flaky],
[testleaf retry][testleaf-retry]):

- **Re-run only the failed check, same commit + same environment** (eliminate
  drift). **Cap at 2–3 attempts.** **Log every retry** alongside the result for
  traceability.
- **Fails once, passes on retry → flake** (usually timing/env). **Fails across
  successive retries → real, reproducible → investigate.**
- **Never silently auto-retry to green** — that masks genuine regressions.
  Classify and *report*, don't hide ([QA Wolf][qawolf]).
- **Capture evidence on the *first* failure, before the retry** — Playwright's
  `trace: 'on-first-retry'` gives a full trace with no per-run storage cost
  ([TestDino flaky][testdino-flaky]).

### 2.3 Root-cause buckets + targeted remediation

Don't default every failure to "update the locator." Categorize, then remediate
([TestDino flaky][testdino-flaky], [Functionize][functionize], [Katalon][katalon]):

| Bucket | Signal | LaunchAudit verdict |
|---|---|---|
| **Timing / async-wait** | bare `waitForTimeout`, race; ~45% of UI flakes (ICSE 2021) | `flaky` → recommend event-driven wait |
| **Shared state / order** | passes isolated, fails in parallel; data leakage | `test_bug` (or env) |
| **Environment** | CI≠local, resource limits, fails under `--cpus=1 --memory=2g` | `test_bug`/`needs_input` (infra) |
| **External dependency** | upstream API flaky / rate-limited | `flaky` or `needs_input` (blocked) |
| **Selector / UI change** | element moved/renamed, healer re-resolves it | `test_bug` (heal it) — **only `product_bug` if the element/flow is genuinely gone** |
| **Assertion intermittent** | semantic/visual diff fires inconsistently | `flaky` → tighten assertion |
| **Reproducible non-2xx / blocked-leak / 500-on-bad-input** | deterministic across retries | **`product_bug`** (high confidence) |

### 2.4 Probabilistic Flakiness Score (PFS) + thresholds

Track a per-check score over a rolling window
([TestDino flaky][testdino-flaky], [ContextQA][contextqa]):

```
Flakiness_Score = (failures_in_window / total_runs_in_window) * 100   # 14-day window
PFS (richer)    = f(flip_rate, retry_rate, pass/fail unpredictability, data_confidence)

Thresholds (practical starting points):
  > 2%          → investigate root cause      (Google baseline ~1.5% still problematic)
  4–6%          → active triage / quarantine
  ≤ 5% of suite → hard cap on quarantine (else noise is being normalized)
  unresolved in 1–2 sprints → fix or delete (quarantine needs a deadline)
```

Weight by environment: failures tied to one runner vs scattered imply different
root causes ([TestDino flaky][testdino-flaky]).

### 2.5 Error fingerprinting

Normalize each failure into a **stable fingerprint** (normalized error message +
failed step + route + status) so recurring failures are tracked, deduped, and
linked to a product/test/infra issue rather than re-surfaced as novel each run
([QA Wolf][qawolf], [TestDino flaky][testdino-flaky]). This is the basis for the
persistent learning store the improvement loop needs (§5).

### 2.6 The decisive distinction LaunchAudit must implement

> **Flake** = *different results on the same code with no change.* Run twice on
> the same commit; if results differ, it's flaky → likely a **test_bug**, not a
> product bug, and tracked/fixed at the test level
> ([TestDino flaky][testdino-flaky], [Test IO][testio]).
>
> **Real (possibly intermittent) bug** = reproducible under specific conditions
> (concurrency, load, env). The category is *usually obvious from the artifact*
> (trace + screenshot + DOM snapshot) — extract it from the failure context, not
> from a pre-written assertion ([Bug0][bug0]).

---

## 3. Visual regression + semantic diffing

LaunchAudit currently captures a single non-full-page screenshot per card
(`execute-core.ts`) and never diffs it. That is evidence, not a check. The
industry moved from pixel diffing to **semantic/AI diffing** specifically to kill
false positives ([Autonoma tools][autonoma-vrt], [BrowserStack VRT][bs-vrt],
[Sauce Labs][sauce-vrt]).

| Tool | Baseline capture | Diff mechanism | False-positive control |
|---|---|---|---|
| **Chromatic** (Storybook makers) | Automatic, component-level via Storybook | Component-scoped snapshots; **TurboSnap** only renders changed components | Noise reduced *by design* — isolated components, not full pages ([Autonoma][autonoma-vrt]) |
| **Argos** | Auto, branch-aware; integrates in PRs | Screenshot diff surfaced in GitHub PRs | PR-scoped review workflow ([Autonoma][autonoma-vrt], [Sauce][sauce-vrt]) |
| **Percy** | Automatic, branch-aware | **AI Visual Review Agent** (late 2025): detects meaningful layout/style/content shifts | Auto-filters ~**40% of false positives**, ~**3× faster** review ([Autonoma][autonoma-vrt]) |
| **Applitools / Autonoma** | Automatic | **AI/semantic** — distinguishes intentional change from regression; Autonoma "reads your codebase to understand what each component is *supposed* to do" | Semantic understanding instead of pixel threshold ([Autonoma][autonoma-vrt]) |
| **Meticulous** | **Records real user sessions** and replays them as the corpus | Replay + visual diff over realistic flows | Avoids hand-authored brittle baselines |
| **Playwright `toHaveScreenshot`** | Auto-generated snapshots in repo | Pixel diff with `maxDiffPixelRatio` / threshold | Threshold + `mask:`/`hideSelectors` for dynamic regions |

**Standard noise-suppression techniques** to adopt
([Autonoma][autonoma-vrt], [BrowserStack][bs-vrt]):
- **Element-scoped assertions**, not full-page captures.
- **Mask dynamic content** (timestamps, carousels, ads) via `mask:`/`hideSelectors`.
- **Stabilize rendering**: pin viewport, `reducedMotion: 'reduce'` (LaunchAudit
  already does this), disable animations, fixed Docker/font environment, freeze
  the clock (Playwright Clock API).
- Conservative threshold (`maxDiffPixelRatio`), and treat a diff as
  **`needs_input`/low-confidence**, never an automatic `product_bug`.

**Recommendation for LaunchAudit:** add a **DOM-scoped + threshold** visual layer
first (deterministic, free, Playwright-native), with an **optional LLM-as-judge
"does this region look broken / is text overlapping / is it blank"** semantic
pass for the cases pixels can't classify. Gate the semantic judge hard (§4).

---

## 4. LLM-as-judge & semantic assertions — use, but distrust

LaunchAudit will be tempted to use the dev's Claude to "look at the page and
say if it's broken." The 2025 literature says: useful, but calibrate and never
let it author its own ground truth.

- **Don't let the agent write its own assertions as truth.** Konstantinou et al.
  (ICST 2025): LLM-authored assertions tend to encode the *current, possibly
  buggy* implementation rather than intended behavior. **Humans validate golden
  regression assertions** ([Maxim][maxim-judge]).
- **Judges are overconfident** — they express higher confidence than their
  accuracy supports; **35.9% of false negatives** come from semantic mismatch
  (rejecting valid implementations over surface differences) ([Maxim][maxim-judge]).
- **Calibrate against a held-out set.** Keep a **200–500 example calibration set**
  with human-verified ground truth; flag the judge for review when correlation
  with humans drops (Pearson **r < 0.7**, or Krippendorff's **α < 0.80**)
  ([Maxim][maxim-judge]).
- **Anthropic's rules** ([Anthropic evals][anthropic-evals]): prefer
  **deterministic graders where possible, model graders where necessary**; grade
  **outcomes (final state), not the path**; **read transcripts** to catch graders
  that penalize valid solutions; design graders to resist gaming.

**LaunchAudit policy:** the deterministic checks (HTTP status, headers,
blocked-leak, overflow, console/network) are the **gate**. The LLM judge is an
**advisory classifier** that can *raise* a finding to human attention or
*downgrade* a likely flake — its verdicts carry a confidence and always cite the
evidence artifact. It never silently flips a deterministic result.

---

## 5. Self-improving agent loops — architecture

### 5.1 The four required components

A self-improving agent needs ([MindStudio loop][mindstudio-loop],
[o-mega][omega]):

1. **A task** — "raise LaunchAudit's catch-rate on a labeled bug corpus while
   keeping false-positive rate low."
2. **A benchmark harness** — runs the tool against fixtures and scores it.
3. **Diagnostic feedback** — *which* bugs were missed, *which* checks misfired,
   *what* the classifier got wrong (vs ground truth).
4. **A persistent learning store** — fingerprinted findings, labeled outcomes,
   accepted/rejected repair packets, accumulated over campaigns. *Without a
   serious memory layer, any self-improving system plateaus fast*
   ([o-mega][omega]; Dec-2025 agent-memory survey).

### 5.2 Reflexion / multi-level reflection

- **Reflexion** = the agent reflects on its failures in natural language and
  carries that reflection forward as guidance on the next attempt.
- **SAMULE / multi-agent reflexion (2025)** add multi-level reflection and
  multiple agents reflecting on shared failures from different perspectives to
  avoid "cognitive entrenchment" ([SAMULE][samule], [o-mega][omega]).
- For LaunchAudit: after a campaign, a **reflection pass** reads the missed-bug
  diagnostics and writes a structured "lesson" (e.g. "we never check optimistic
  UI rollback on failed mutations") that becomes a candidate new generator/check.

### 5.3 Binary evals + Claude Code (the canonical hand-rolled loop)

The most directly applicable pattern ([MindStudio binary evals][mindstudio-evals]):

- **Evals are binary** — each assertion returns exactly true/false; aggregate to
  `all_pass`. Mix string/schema checks with LLM-as-judge for semantic qualities.
- **Loop**: harness runs the artifact → runs all assertions → reports *named*
  failures → **Claude Code edits only the artifact file** → re-run → repeat to a
  **hard iteration cap**.
- **Safety gates (non-negotiable):**
  - **Lock the evals.** *"Your CLAUDE.md must explicitly prohibit changes to
    `evals.py`. If Claude Code can modify the eval file, it'll 'fix' failures by
    making the tests easier, not the skill better."*
  - **Hard iteration cap** (cost + runaway control).
  - **Git branch isolation** + **per-file rollback**; review the first 5–10
    cycles before unattended runs.
  - **15–30 representative inputs** minimum (avoid over/underfitting).
- Runs overnight: `claude -p "Follow CLAUDE.md to improve … Run autonomously."`

### 5.4 Anthropic's eval discipline (authoritative)

From [Anthropic — Demystifying evals for AI agents][anthropic-evals]:

- **Start with 20–50 tasks sourced from real failures.** Grow from actual misses,
  not synthetic.
- **Balanced sets** — test both when a behavior *should* and *should not* fire
  (avoid one-sided optimization → directly answers the false-positive concern).
- **Grade outcomes, not paths.** Isolated env, clean state per trial.
- **pass@k vs pass^k:** for a customer-facing gate, care about **pass^k**
  (all *k* trials succeed) — a flaky catch is not a catch.
- **Watch for saturation** (~100% pass = make tasks harder).
- **Swiss-cheese model**: evals + production monitoring + human transcript review;
  no single layer catches everything.

### 5.5 Proposed → eval → approve → ship (with audit)

Harness shape used by real self-improving harnesses (OpenTracy, SICA)
([OpenTracy][opentracy], [SICA via o-mega][omega]):

```
propose candidate edit → critique → run eval suite → keep winners (eval delta > 0)
   → apply with per-file rollback → human approval gate before "live"
```

SICA (Robeyns 2025): an agent that edits its **own** script, re-evaluates, keeps
metric-improving changes — reported **17–53%** gains on coding tasks
([o-mega][omega]). The **audited skill-graph self-improvement** work
([arXiv 2512.23760][arxiv-skillgraph]) frames improvements as additions to a
**verifiable skill graph** with continual memory — the right model for
LaunchAudit's growing check library.

### 5.6 Skill libraries & Claude Code subagents (LaunchAudit's native substrate)

LaunchAudit already ships as a Claude Code layer (`claude-code/skills/launchaudit/`,
MCP server, `/launch-audit` command). That is the **ideal substrate** for a skill
library: new check families are new generator modules + a skill doc; the dev's
own subscription powers reasoning; subagents can run the
generate/execute/classify/heal stages in parallel. The improvement loop *writes
new skills/generators*, evals them, and only then registers them.

---

## 6. Concrete recommendations for LaunchAudit

Grounded in the actual code:
`runner/execute-core.ts`, `runner/crawler.ts`, `runner/executor.ts`,
`src/lib/card-generator.ts`, `src/lib/generators/*`, `runner/mcp-server.ts`.

### 6.1 Runner upgrades (deterministic core — do first)

1. **Bounded retry with first-failure trace.**
   - In `executeCards`/`executeOne`, on a `failed` card, **re-run up to 2 more
     times, same context config and `appUrl`**. Record `attempts: Result[]`.
   - Enable Playwright **tracing** and keep the trace **from the first failing
     attempt** (`trace: 'on-first-retry'` semantics). Today `CardResult` has no
     trace; add `tracePath`.
   - Decision: `pass,pass` first try → `passed`; `fail→pass` → **`flaky`**;
     `fail→fail→fail` → candidate **`product_bug`** (deterministic).
   - **Log every attempt** in the result (honesty requirement).

2. **Per-attempt evidence bundle.** Extend `CardResult` to capture, per failing
   attempt: console errors (have it), failed requests (have it, but widen from
   `>=500` to also record 4xx on cards that expected 2xx), **HAR/network log**,
   **DOM snapshot** (`page.content()` + a11y snapshot
   `page.accessibility.snapshot()`), screenshot (have it), and trace. This bundle
   *is* the classifier's input (§2.6) and the report's evidence.

3. **Accessibility-first locators in generators.** In `frontend.ts` (and any
   future flow cards), prefer `getByRole`/`getByLabel`/`getByText` semantics over
   raw CSS (`"button, a, [role=button]"`). Reduces selector flake at the source
   ([TestDino flaky][testdino-flaky]).

4. **Stabilize the visual environment** (already partly done: `reducedMotion`).
   Add: pin fonts/Docker where possible, optional **Clock API freeze** for
   time-dependent UI, and disable CSS animations before screenshot.

5. **Widen network capture for classification.** `execute-core.ts` only records
   `status >= 500`. Also record **4xx on assets/APIs that should be 2xx** and
   **failed (aborted) requests** — these separate `product_bug` (broken endpoint)
   from `flaky` (transient abort).

### 6.2 Check-generator upgrades (close the depth gaps)

New generator modules / cards to add (each becomes a skill + eval fixture):

- **Self-healing locator pass (`generators` + healer step).** When a `click`/
  `fill`/`expect_visible` step fails, **re-resolve the intent against the live
  a11y tree** (role + accessible name) before failing. If a semantically
  equivalent element is found and the step then succeeds → classify the original
  as **`test_bug` (stale selector)** and emit a locator-update repair, *not* a
  product bug. Mirrors Microsoft's Healer (>75% on selector failures)
  ([pw-agents][pw-agents], [testeragents][testeragents]).
- **Visual regression cards** (§3): baseline + DOM-scoped diff with masking;
  diff → `needs_input`/low-confidence finding, never auto `product_bug`.
- **Form semantics depth** (`frontend.ts` only counts forms today): required-field
  enforcement, client+server validation parity, malformed submit → 4xx not 5xx,
  success/empty/error states, optimistic-UI rollback on a failed mutation.
- **API contract depth** (`backend.ts`): malformed body → 400 not 500 (extend the
  existing `expectBodyExcludes` stack-trace check), content-type enforcement,
  method-not-allowed → 405, idempotency on retried POST, pagination bounds.
- **AuthN/Z edge depth** (`admin-rbac.ts` is the crown jewel — extend it):
  IDOR / horizontal privilege (user A's id on user B's resource), expired/
  tampered token → 401, role escalation via mutation payload, **direct-URL to
  admin *detail* pages** (PRD calls this out; ensure a card exists per detail
  route, not just index).
- **Middleware depth** (`middleware.ts`): full security-header matrix (CSP, HSTS,
  X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy),
  http→https, **rate-limit on login/sensitive endpoints** (PRD), cookie flags
  (HttpOnly/Secure/SameSite).
- **Optional agentic exploration crawl** (§1.3): an LLM pass over the live app
  that *proposes additional routes/flows*, which are then handed to the
  deterministic generators. Discovery only — never the gate.

### 6.3 The failure classifier (the differentiator — build it humble)

Add `runner/classify.ts`, invoked after the bounded-retry attempts. Output:

```ts
type Verdict = "product_bug" | "test_bug" | "flaky" | "needs_input";
type Classification = {
  verdict: Verdict;
  confidence: number;              // 0..1, calibrated, never 1.0 by default
  rootCauseBucket: "timing" | "shared_state" | "environment"
    | "external_dependency" | "selector_ui_change" | "assertion_intermittent"
    | "reproducible_defect" | "blocked";
  rationale: string;               // grounded in the evidence bundle
  evidenceRefs: string[];          // screenshot/trace/HAR/DOM snapshot ids
  fingerprint: string;             // normalized error+step+route+status
  suggestedRepair?: RepairPacket;  // only when product_bug or test_bug
};
```

Rules (deterministic first, LLM-judge second — §2.3, §2.6, §4):

1. **Deterministic shortcuts win and carry high confidence**: blocked-leak
   exposed (admin route returns 200 anon), 500-on-malformed-input, missing
   security header, reproducible non-2xx across all retries → **`product_bug`,
   confidence high**.
2. **Retry pattern**: `fail→pass` → **`flaky`** (timing/external), bucket from
   the error fingerprint.
3. **Healer resolved it** (a11y re-resolve made the step pass) → **`test_bug`
   (selector_ui_change)** + locator-update repair.
4. **Missing creds/env/sandbox** (already modeled as `blocked` cards) →
   **`needs_input`**.
5. **Ambiguous** (visual diff, semantic) → LLM-as-judge produces verdict +
   **confidence**; if confidence < threshold or it contradicts a deterministic
   signal → **`needs_input`** for a human. **Never** let the judge override a
   deterministic gate (§4).
6. **Always** attach `confidence`, `evidenceRefs`, `fingerprint`. Per OOPSLA,
   treat the classifier as ~mid-60s%-F1 reliable and design the UX around that
   (show the evidence, invite the dev to confirm) ([oopsla][oopsla]).

This maps cleanly onto the existing `findings` + `repair_tasks` tables in
`docs/production-architecture.md`.

### 6.4 Artifacts the runner should produce (per campaign)

- `findings.jsonl` — one fingerprinted finding per failing card with the
  classification block above.
- `evidence/<cardId>/{screenshot.png, trace.zip, network.har, dom.html,
  a11y.json}` — the classifier's inputs and the report's proof (extends the
  current single-PNG behavior; matches the Blob path scheme already designed).
- `readiness.json` — score + "what's left to 100%" (already the 80→100 model),
  now annotated with confidence and `needs_input` items separated from confirmed
  bugs.
- `flake-ledger.jsonl` — per-check rolling flip-rate / PFS history (§2.4) for the
  learning store.

### 6.5 The self-improvement loop (design)

Create `launchaudit-evals/` — the locked benchmark the loop is graded against.

**What it measures (binary evals, balanced set — §5.4):**
- **Bug-catch recall**: a labeled fixture corpus of apps with *planted* bugs
  (the repo already has a 5-bug fixture → grow to 30–50, balanced across FE/BE/
  RBAC/middleware/visual). Each planted bug = one binary assertion "was it
  caught with the right verdict?".
- **False-positive rate**: **clean** fixtures with *no* bugs → assertion "did the
  audit stay green / not invent a finding?". This is the OOPSLA-mandated negative
  half and the guardrail against an over-eager classifier.
- **Classifier accuracy**: for each known failure, assertion "verdict == ground
  truth?" — scored on a **realistic class balance** (mostly clean), reported as
  F1, expecting mid-60s% and improving (don't chase a fake 95%).
- **Flake stability**: run the suite **k times** (pass^k) on a deterministic
  fixture → assertion "zero spurious verdicts across k runs."
- **Repair efficacy**: apply each generated repair packet to its fixture, re-run,
  assertion "finding resolved AND nothing else regressed."

**Artifacts the loop produces:**
- `launchaudit-evals/report.json` — per-eval pass/fail + aggregate scores +
  deltas vs last run.
- `launchaudit-evals/transcripts/` — full run transcripts for human review
  (Anthropic: *read the transcripts*).
- `docs/research/improvement-log/<date>.md` — a **reflection pass** (Reflexion,
  §5.2): what was missed, the lesson, the proposed new generator/skill.
- New/edited files under `src/lib/generators/` + `claude-code/skills/` (the
  candidate improvement), on a branch.

**How it adds skills/tools safely (gates):**
1. **Locked evals.** A `launchaudit-evals/CLAUDE.md` *forbids editing the eval
   suite or fixture ground-truth.* The loop may only edit generators/classifier/
   skills ([MindStudio binary evals][mindstudio-evals]).
2. **Eval-delta gate.** A candidate is kept only if **catch-recall and/or
   classifier-F1 improve AND false-positive rate does not rise.** (No trading
   recall for noise.)
3. **pass^k stability gate.** Candidate must not introduce new flakiness in the
   eval suite itself.
4. **Branch isolation + per-file rollback + hard iteration cap** ([MindStudio][mindstudio-evals]).
5. **Human approval before "live"** — propose→critique→eval→approve→ship
   ([OpenTracy][opentracy]). New skills register only after approval.
6. **Persistent learning store** — `flake-ledger.jsonl` + accepted/rejected
   repair outcomes + fingerprints accumulate across campaigns; the loop reads
   them so it compounds instead of plateauing ([o-mega][omega]).

**How it runs:** a scheduled Claude Code job (the repo is a Claude Code layer
already; FDC runs scheduled improvement jobs as a pattern). Nightly/weekly:
`claude -p "Follow launchaudit-evals/CLAUDE.md: run the eval harness, read the
diagnostics + reflection log, propose ONE new generator or classifier
improvement, eval it, and open a branch if (and only if) it beats the gates."`
Iteration-capped, branch-isolated, human-gated before merge.

**Loop shape:**
```
run audit on eval corpus
   → score (recall, FP-rate, classifier-F1, pass^k, repair efficacy)
   → diagnose gaps (which bugs missed / which verdicts wrong / which checks flaked)
   → reflect → write lesson + propose ONE candidate generator/skill/classifier edit
   → re-run evals on candidate (branch)
   → keep iff delta gate passes (recall↑/F1↑, FP-rate not↑, no new flake)
   → human approval → register skill → append to learning store
```

---

## 7. What to build, in order (prioritized)

1. **Bounded retry + per-attempt evidence bundle (HAR/DOM/a11y/trace)** —
   `runner/execute-core.ts`. *(unblocks classification & flake handling)*
2. **Failure classifier `runner/classify.ts`** with confidence + evidence +
   fingerprint, deterministic-first. *(the differentiator)*
3. **Self-healing locator (a11y re-resolve) healer step** — stops `test_bug`
   masquerading as `product_bug`. *(biggest precision win)*
4. **`launchaudit-evals/` harness** (balanced fixtures + binary scorer +
   locked CLAUDE.md). *(makes everything else measurable & safe)*
5. **Visual regression layer** (DOM-scoped diff + masking; optional LLM judge,
   gated). *(new bug class)*
6. **Generator depth packs** (forms, API contract, IDOR/authz, header matrix,
   rate-limit). *(coverage)*
7. **Scheduled self-improvement job** (propose→eval→approve→ship) +
   reflection log + learning store. *(compounding)*
8. **Optional agentic exploration crawl** feeding the deterministic generators.
   *(discovery, never the gate)*

This keeps LaunchAudit's core bet intact — **deterministic execution, AI for
planning, diagnosis, and self-improvement** — while adding exactly the
capabilities the 2025–2026 field converged on, and the honesty guardrails the
research demands.

---

## Sources

**Agentic e2e / Playwright Agents**
- [Playwright Test Agents — official docs][pw-agents]
- [Playwright Agents: Planner, Generator, Healer in Action — DEV][dev-pw]
- [Playwright Test Agents guide — TestDino][testdino-pw]
- [Playwright AI: MCP, Copilot, and the Agentic Test Stack 2026 — testeragents.com][testeragents]
- [Playwright AI Ecosystem 2026 — TestDino][testdino-ecosystem]
- [The Death of Traditional Testing / JiTTesting — Meta Engineering][meta-jit]

**browser-use / computer-use / autonomous exploration**
- [2025–2026 AI Computer-Use Benchmarks & Top Agents — o-mega][omega-bench]
- [11 Best AI Browser Agents 2026 — Firecrawl][firecrawl-agents]
- [Autonomous Exploratory Testing — TestQuality][testquality]

**Flaky / false-failure handling**
- [Understanding and Improving Flaky Test Classification — OOPSLA/SPLASH 2025][oopsla]
- [Flaky Tests: Complete Guide to Detection & Prevention — TestDino][testdino-flaky]
- [How to Handle Flaky Tests: What Your System Should Do — QA Wolf][qawolf]
- [The Flaky Test Problem: Root Cause & How AI Solves It — Functionize][functionize]
- [Flaky Tests in Test Automation — Katalon][katalon]
- [Retry Logic in CI/CD to Fix Flaky Tests — Testleaf][testleaf-retry]
- [Flaky Test Detection — ContextQA][contextqa]
- [Agentic QA and Humans in the Loop — Test IO][testio]
- [Types of bugs in software testing — Bug0][bug0]

**Visual regression / semantic diffing**
- [Visual Regression Testing Tools Compared — Autonoma][autonoma-vrt]
- [Visual Regression Testing Tools Compared — BrowserStack][bs-vrt]
- [20 Best Visual Testing Tools of 2026 — Sauce Labs][sauce-vrt]

**LLM-as-judge / semantic assertions**
- [Can LLMs Actually Judge Web Development Quality? — Maxim][maxim-judge]
- [Demystifying evals for AI agents — Anthropic][anthropic-evals]

**Self-improving agent loops**
- [Self-Improving AI Skills with Binary Evals and Claude Code — MindStudio][mindstudio-evals]
- [Build a Self-Improving AI Agent That Learns From Its Mistakes — MindStudio][mindstudio-loop]
- [Self-Improving AI Agents: The 2026 Guide — o-mega][omega]
- [OpenTracy — self-improving agent harness (propose/eval/approve/ship)][opentracy]
- [SAMULE: Self-Learning Agents Enhanced by Multi-level Reflection (arXiv 2509.20562)][samule]
- [Audited Skill-Graph Self-Improvement for Agentic LLMs (arXiv 2512.23760)][arxiv-skillgraph]

<!-- link refs -->
[pw-agents]: https://playwright.dev/docs/test-agents
[dev-pw]: https://dev.to/playwright/playwright-agents-planner-generator-and-healer-in-action-5ajh
[testdino-pw]: https://testdino.com/blog/playwright-test-agents
[testeragents]: https://testeragents.com/playwright-ai/
[testdino-ecosystem]: https://testdino.com/blog/playwright-ai-ecosystem
[meta-jit]: https://engineering.fb.com/2026/02/11/developer-tools/the-death-of-traditional-testing-agentic-development-jit-testing-revival/
[omega-bench]: https://o-mega.ai/articles/the-2025-2026-guide-to-ai-computer-use-benchmarks-and-top-ai-agents
[firecrawl-agents]: https://www.firecrawl.dev/blog/best-browser-agents
[testquality]: https://testquality.com/autonomous-exploratory-testing-ai-agents/
[oopsla]: https://2025.splashcon.org/details/OOPSLA/116/Understanding-and-Improving-Flaky-Test-Classification
[testdino-flaky]: https://testdino.com/blog/flaky-tests
[qawolf]: https://www.qawolf.com/blog/what-your-system-should-do-with-a-flaky-test
[functionize]: https://www.functionize.com/blog/the-flaky-test-problem-root-cause-and-how-ai-solves-it
[katalon]: https://katalon.com/resources-center/blog/flaky-tests-in-test-automation
[testleaf-retry]: https://www.testleaf.com/blog/retry-logic-ci-cd-handle-flaky-tests/
[contextqa]: https://learning.contextqa.com/reporting/flaky-test-detection
[testio]: https://test.io/ai-in-qa/agentic-qa
[bug0]: https://bug0.com/knowledge-base/types-of-bugs-in-software-testing
[autonoma-vrt]: https://getautonoma.com/blog/visual-regression-testing-tools
[bs-vrt]: https://www.browserstack.com/guide/visual-regression-testing-tool
[sauce-vrt]: https://saucelabs.com/resources/blog/comparing-the-20-best-visual-testing-tools-of-2026
[maxim-judge]: https://www.getmaxim.ai/blog/can-llms-actually-judge-web-development-quality-spoiler-not-really/
[anthropic-evals]: https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
[mindstudio-evals]: https://www.mindstudio.ai/blog/self-improving-ai-skills-binary-evals-claude-code
[mindstudio-loop]: https://www.mindstudio.ai/blog/self-improving-ai-agent-feedback-loop
[omega]: https://o-mega.ai/articles/self-improving-ai-agents-the-2026-guide
[opentracy]: https://github.com/OpenTracy/OpenTracy
[samule]: https://arxiv.org/pdf/2509.20562
[arxiv-skillgraph]: https://arxiv.org/pdf/2512.23760
