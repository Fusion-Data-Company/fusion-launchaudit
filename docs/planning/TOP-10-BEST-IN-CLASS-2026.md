# 80/20 Launch Audit — 10 Moves to Best-in-Class (evidence-ranked, July 2026)

This is not a fresh brainstorm. It's the **decision-grade distillation** of the existing
20-item `BEST-IN-CLASS-ROADMAP.md`, re-ranked against a July 2026 read of the actual
competitive class, with three net-new strategic moves that list misses. Every item below
carries a real, checkable source and a way to *prove* it's done — nothing invented, nothing
that breaks "free, local, in-your-agent."

## The class we're actually in (why the ranking below)

80/20 Launch Audit sits at the intersection of four markets, and best-in-class means beating
each on its home turf while keeping the wedge:

1. **DAST scanners** — OWASP ZAP, Burp Suite, StackHawk, Nuclei, Detectify. Home turf:
   runtime vuln detection, CI-native gating, community template breadth.
2. **Site/quality auditors** — Lighthouse / Lighthouse CI, Unlighthouse, Sitebulb. Home turf:
   performance budgets enforced as CI quality gates.
3. **Accessibility engines** — axe-core, Pa11y, WAVE. Home turf: WCAG rule coverage — now with
   legal teeth (see move 7).
4. **The new fight — autonomous QA agents** — Momentic (raised a $15M Series A, Nov 2025;
   customers include Notion, Webflow, Retool), QA.tech, Meticulous, Ranger. Over **$1.5B of
   VC has flowed into AI testing agents**, 40+ startups. This is the category that will try to
   own "QA that runs at the speed of your coding agent" — *your* positioning. You beat them on
   the one thing they can't credibly claim: **an honest, zero-LLM engine that refuses to call
   anything done without evidence, running on the dev's own subscription, code never leaving the
   machine.** ([Momentic](https://momentic.ai/blog/ai-agents-in-qa-testing),
   [AgentMarketCap](https://agentmarketcap.ai/blog/2026/04/08/momentic-autonomous-qa-agent-testing-market-2026),
   [QA.tech](https://qa.tech/blog/the-13-best-ai-testing-tools-in-2026))

**The strategic read:** the engine is already strong. The gap to best-in-class is *less about
more detectors* and *more about* (a) CI-native distribution, (b) prioritization intelligence,
(c) continuous/regression use, (d) an extensibility platform, and (e) provably-earned trust.
The 10 below are ordered by impact-to-effort toward exactly that.

---

## Tier 1 — Distribution & gating (turn a great engine into an adopted one)

### 1. Ship as a first-class GitHub Action that emits SARIF 2.1.0 into Code Scanning
**Move.** Package the audit as a reusable GitHub Action that runs on every PR, posts the Launch
Gate as a **required commit status check**, comments the top fixes, and uploads findings as
**SARIF 2.1.0** so they render as native code-scanning alerts on the diff.
**Why best-in-class.** SARIF is an **OASIS standard** and the universal interop format for
security tooling — CodeQL, Semgrep, SonarQube, ZAP all speak it, and GitHub parses it natively
into PR annotations. Every serious CI-native competitor (StackHawk, Semgrep) ships exactly this;
right now you have neither an `action.yml` nor any SARIF emitter (confirmed: no `action.yml`, no
`SARIF` string anywhere in the tree). This is the single biggest "table-stakes plumbing" gap.
**Maps to.** Existing roadmap #13 + #14, elevated and merged. Pure serializer in
`render-report.ts` + one `action.yml`.
**Verify.** Output validates against the SARIF 2.1.0 JSON schema; `actions/upload-sarif`
succeeds; the Action fails the build on a confirmed security/authz `product_bug` against
`fixtures/buggy-shop` and passes on `fixtures/shop-fixed`.
**Sources.** [GitHub — SARIF support for code scanning](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning),
[About SARIF files](https://docs.github.com/en/code-security/concepts/code-scanning/sarif-files).

### 2. Enforced budgets/assertions policy file (the Lighthouse-CI move)
**Move.** A `launchaudit.config` (or `budget.json`) where a team declares per-category
thresholds and severities — e.g. "zero confirmed authz bugs, a11y serious=0, readiness ≥ 85" —
and the Launch Gate fails the build when policy is breached. Turns the 0–100 *score* into
enforceable *policy*.
**Why best-in-class.** This is the feature that made Lighthouse CI the default performance gate:
assertions + `budget.json` "fail builds when metrics exceed thresholds to prevent regressions
from reaching production." A score informs; a **budget enforces**. Competitors gate; today you
report.
**Maps to.** Extends the existing `launchGate()` in `render-report.ts` — mostly config parsing +
gate logic.
**Verify.** Unit test: a config with `authz_bugs_max: 0` fails on buggy-shop, passes on
shop-fixed; a loosened budget flips the result deterministically.
**Sources.** [web.dev — Performance monitoring with Lighthouse CI](https://web.dev/articles/lighthouse-ci),
[Unlighthouse — LHCI budgets & assertions](https://unlighthouse.dev/learn-lighthouse/lighthouse-ci/budgets).

### 3. Continuous regression mode — diff runs, gate on NEW findings only
**Move.** A `--since <git-ref>` / baseline-diff mode: store a run (the PGlite hub already
persists them), compare the next run, and gate on *newly introduced* findings so re-runs on big
legacy apps aren't a wall of red. Turns a one-shot audit into a **per-PR guardrail**.
**Why best-in-class.** This is precisely the wedge the autonomous-QA category is winning on —
Meticulous "catches UI regressions automatically by replaying real user sessions against new code
changes," and LHCI's diff model is why teams keep it in CI. "Clean-as-you-code" (Sonar's signature)
is what makes a scanner *livable* on a real codebase instead of a one-time novelty.
**Maps to.** Existing roadmap #10, reframed as continuous CI use; leverages the hub you already
built. Logic in the generator + `render-report.ts`.
**Verify.** Two runs against a fixture with one new planted bug: diff surfaces exactly the new
finding; unchanged findings are suppressed from the gate.
**Sources.** [Momentic — AI agents in QA](https://momentic.ai/blog/ai-agents-in-qa-testing),
[web.dev — Lighthouse CI](https://web.dev/articles/lighthouse-ci).

---

## Tier 2 — Deepen the moat (the authorization depth no one else automates)

### 4. Make the authenticated two-identity harness a bulletproof, zero-hand-authoring flow
**Move.** Elevate auth capture (`runner/capture-auth.ts`, `hints.roles`) into a first-class
`launchaudit init` wizard that detects routes from the repo scan and walks the user through
supplying **two real logins**. Without two sessions, the entire authorization wedge can't fire —
and most users never hand-author a hints file, so today the best checks silently don't run.
**Why best-in-class.** **BOLA (Broken Object Level Authorization) is the #1 risk in the OWASP API
Security Top 10:2023 and accounts for ~40% of API attacks** — T-Mobile leaked 37M records through
exactly one unauthenticated/authz-broken endpoint. You cannot test the thing that matters most
without authenticated sessions; making that trivial is the biggest single adoption unlock for the
moat.
**Maps to.** Existing roadmap #16 (init wizard) as the *enabler* for #5–#6.
**Verify.** `init` against a fixture scaffolds a valid hints file with two roles; the wedge
generators fire (previously `blocked → now runs`).
**Sources.** [OWASP API1:2023 — BOLA](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/),
[Salt Security — BOLA in the wild](https://salt.security/blog/api1-2023-broken-object-level-authentication).

### 5. Complete the cross-identity authorization matrix: BOLA/IDOR + BFLA + BOPLA
**Move.** Building on the two-identity probe already landed (`two-identity.ts`,
`object-authz.ts`, `mutation-authz.ts`): run every privileged route/object as
**anon → user A → user B → admin** and assert the gradient. Add **BFLA** (function-level:
a normal user hitting an admin function) and **BOPLA/mass-assignment** (writing a property you
shouldn't own) to complete the OWASP API authorization trio.
**Why best-in-class.** ZAP's own docs concede scanners can't automate authorization logic — it's
the category-defining gap. BOLA/BFLA/BOPLA are **API1, API5, and API3 of the 2023 Top 10**. Doing
all three across *real* identities is the headline competitors structurally cannot match.
**Maps to.** Existing roadmap #5 + #6, unified into one truth-table probe.
**Verify.** Per-user object fixture: catch cross-user read/update/delete; **no false positive** on
correctly-scoped objects or under dev-stub auth (honest `needs_verification`, already handled).
**Sources.** [OWASP API3:2023 — BOPLA](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/),
[OWASP API Security Top 10:2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/).

### 6. Reproducible evidence bundle per finding (the Truth Protocol, hardened)
**Move.** Every finding ships with a one-line **repro** — the exact `curl` / Playwright step plus
a redacted response slice, and a saved trace/screenshot artifact for browser findings — embedded
in the report and the verdict.
**Why best-in-class.** The whole autonomous-QA category sells "confidence scores"; you sell
**"here's the proof, run it yourself."** That's a stronger claim than any competitor's number, it
hardens the Watchdog re-verification, and it's what makes a `product_bug` undeniable to a
skeptical developer. Reproducible evidence *is* the differentiator — lean into it.
**Maps to.** Existing roadmap #9, hardened with Playwright trace artifacts.
**Verify.** Each `product_bug` writes a runnable repro + artifact path; a test asserts the repro
command is present and non-empty for every confirmed finding.
**Sources.** [Meticulous — session-replay regression model](https://momentic.ai/blog/ai-agents-in-qa-testing)
(category benchmark for reproducible evidence), Playwright trace viewer.

---

## Tier 3 — Prioritization, breadth, and platform (match the specialists, then out-scale them)

### 7. WCAG 2.2 AA depth beyond axe-auto — and sell it on the EAA deadline
**Move.** Add the high-value checks axe/Lighthouse *can't* auto-detect: focus order, reflow
(1.4.10), and **target size (2.5.8)**. Frame a11y as a compliance wedge, not a checkbox.
**Why best-in-class.** The **European Accessibility Act took effect June 28, 2025** across all 27
EU member states, with penalties **up to 4% of global annual turnover** — and enforcement is
already live (French injunctions filed Nov 2025). Lighthouse/axe only catch a **limited
auto-detectable subset**; "a high score does not mean the page is accessible." Depth here is a
sellable, deadline-driven reason to run the audit — not a nice-to-have.
**Maps to.** Extends `accessibility.ts` beyond axe serious/critical (roadmap breadth, Theme A).
**Verify.** Fixtures with an undersized tap target and a reflow break are caught; a compliant page
produces zero false positives.
**Sources.** [EAA enforcement & penalties](https://www.levelaccess.com/compliance-overview/european-accessibility-act-eaa/),
[WAI — accessibility tools can't fully determine compliance](https://www.w3.org/WAI/test-evaluate/tools/list/).

### 8. EPSS + CISA KEV + reachability prioritization on the dependency detector
**Move.** Enrich the CVE findings from `dependencies.ts` (already on OSV) with free **EPSS
probabilities** and the **CISA KEV** catalog, and sort "fix these first." Wire the ranking into
the Launch Gate.
**Why best-in-class.** CVSS-only triage is noise: **only ~2.3% of CVEs scored 7+ are ever
observed being exploited.** A blend of EPSS (likelihood) + KEV (known-exploited) + reachability
**cuts the actionable vuln population 90–95%.** This is the exact intelligence Endor Labs and Snyk
charge enterprise money for — you can do the EPSS+KEV layer *free* off public feeds and keep it
local.
**Maps to.** Existing roadmap #20, elevated to a Tier-3 headline.
**Verify.** A fixture `package.json` with one KEV-listed CVE and one low-EPSS CVE ranks the KEV
item first; unit-test the ordering.
**Sources.** [EPSS v4 (released Mar 17, 2025)](https://www.first.org/epss/),
[Endor Labs — EPSS + reachability cuts noise 90–95%](https://www.endorlabs.com/learn/epss-exploit-prediction-reachability-analysis).

### 9. An extensible rule-pack system — the Nuclei model
**Move.** A documented, versioned way for a team to drop in their own checks (a YAML/TS "rule
pack") that generate cards through the existing detector pipeline — org-specific routes, internal
header policies, house conventions — without forking the engine.
**Why best-in-class.** **Nuclei is the category leader precisely because of extensibility:
9,000+ community templates, 10,000+ contributors, new detections landing within hours of a CVE.**
A closed detector set caps your ceiling at what you personally ship; a rule-pack system turns
80/20 Launch Audit from a *tool* into a *platform* — and it's a natural fit for the vibecoder
audience who'll want per-client checks. This move is **absent from the current roadmap** (which
only plans to grow the *internal* catalog).
**Maps to.** Net-new. Builds on the documented generator pattern in `CLAUDE.md`; add a loader in
`card-generator.ts`.
**Verify.** Load an external rule pack from a fixture directory → its cards appear in the run and
execute; a malformed pack fails safe with a `test_bug`/skip, never a fake pass.
**Sources.** [ProjectDiscovery — Nuclei templates (9,000+, community-powered)](https://github.com/projectdiscovery/nuclei-templates),
[Nuclei overview](https://docs.projectdiscovery.io/opensource/nuclei/overview).

### 10. Earn the Truth-Protocol claim: precision/recall calibration gate + published benchmark
**Move.** Measure per-category precision/recall against the fixtures on **every CI run**; if a
category drifts below threshold, fail CI. Expand to one planted-bug fixture per detector and
publish the recall/precision report as a runnable command.
**Why best-in-class.** The entire market — DAST *and* autonomous-QA — competes on "fewer false
positives." You don't get to *assert* the Truth Protocol; you **earn it, measurably, on every
push.** "Catches 5/5 on buggy-shop, 0 false positives on shop-fixed — verify it yourself" is your
Show-HN proof and the credibility spine that lets you add surface without eroding trust. The
current CI already runs the fixture gate + mutation kill-rate; this makes precision a *first-class,
enforced* metric.
**Maps to.** Existing roadmap #12 + #17, merged into the credibility headline.
**Verify.** CI job computes precision/recall vs fixtures; an injected false positive drops the
score below threshold and fails the build.
**Sources.** Your own `fixtures/buggy-shop` (`BUGS.md`) + `fixtures/shop-fixed`; the sourced
`docs/research/test-catalog/`.

---

## Suggested sequence (impact-to-effort)

1. **Distribution first (1 → 2 → 3).** The engine is already good; SARIF + a PR-gate Action +
   continuous diff are what convert "great tool" into "in every repo's CI." Highest leverage,
   lowest engine risk.
2. **Moat second (4 → 5 → 6).** The authorization depth is the marketing line and the thing
   nobody else can automate — but it's gated on the two-identity harness (4) being effortless.
3. **Specialist parity + platform (7 → 8 → 9).** Match axe/Snyk/Endor on their turf with free,
   local equivalents, then out-scale everyone with the rule-pack platform.
4. **Trust throughout (10).** Not last in importance — the calibration gate must land *alongside*
   every new detector so recall stays honest as surface grows.

## Guardrail (unchanged — defend the wedge)

Nothing above adds a hosted backend, a required paid dependency, or a finding you can't prove.
No CSPM, no cloud firewall, no proprietary SAST platform. **Free + local + in-the-agent +
authorization-depth + provable honesty** is the whole pitch — every one of these 10 sharpens it
rather than diluting it.
