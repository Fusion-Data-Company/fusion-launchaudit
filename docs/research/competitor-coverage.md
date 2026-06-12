# Competitor Coverage Analysis — Automated Web-App Testing / QA-Automation Market

**Purpose:** A curated, concrete checklist of exactly what each competitor product checks for when it audits a web app or codebase, so **LaunchAudit** can provably out-test them and target the white space.

**Researched:** 2026-06-11 (web search + doc/feature-page review)
**Method note (skeptical framing):** Most vendor pages are marketing. Where a capability is only a marketing claim (not corroborated by docs, third-party review, or a comparison article), it is tagged **[claim]**. Where corroborated, it is tagged **[verified]**. Where a tool explicitly does NOT do something, it is tagged **[gap]**. The single most important pattern: **"security testing" is claimed by almost no one and substantiated by no one in this set** — and **authorization / RBAC / multi-role / server-side-authz / IDOR** is a near-universal blind spot.

---

## How to read this document

1. **Per-product profiles** — concrete test categories, discovery method, explicit coverage gaps, pricing/positioning.
2. **Master coverage matrix** — check-category × competitor, so the white space is visible at a glance.
3. **White-space synthesis** — where LaunchAudit wins.

---

## 1. Per-Product Profiles

---

### TestSprite (PRIMARY) — "autonomous AI testing agent, full lifecycle"

**Positioning (one line):** AI-first autonomous testing platform covering plan → generate → execute → debug for UI + backend APIs, delivered primarily via an MCP server inside the IDE (Cursor, Windsurf, Copilot). Self-serve, credit-based.

**What it tests (concrete):**
- Frontend: user journeys/flows, form validation & interactions, UI states/components, **auth flows (login)**, accessibility checks, responsiveness. [claim — testsprite.com E2E page]
- Backend/API: endpoint validation, **data schema checks**, simulated real API calls, response-content validation, edge cases & boundary limits, API status validation, error handling. [claim/[verified] via third-party review — traksource, dicloak]
- Cross-layer: business workflows, edge cases, performance metrics. [claim]
- It states it generates "functional **and security** tests" and "functional testing, error handling, **security testing, load testing**." [claim — GitHub README + testsprite.com] **BUT** the security depth is undocumented and unsubstantiated — its own API-testing-checklist page lists **no** concrete security checks (no authn/authz, RBAC, IDOR/BOLA, rate-limiting, security headers, status-code validation). The "security testing" label appears aspirational. [gap — verified absence on feature page]

**How it discovers what to test (this is the differentiator vs. crawl-only tools):**
- **Parses a PRD** (including informal ones) and/or **infers requirements directly from the codebase via its MCP server**, then converts findings into a **structured internal "standardized PRD"** so tests reflect intended behavior. (Tools: `testsprite_generate_standardized_prd`, `testsprite_generate_frontend_test_plan`, `testsprite_generate_backend_test_plan`, `testsprite_generate_code_and_execute`.) [verified — MCP tool surface]
- **URL-based exploration**: point it at a URL; it autonomously explores and creates tests for every flow it discovers. [claim]
- **Natural-language prompts**: "Test the login flow with valid credentials." [claim]
- Executes generated test code in **ephemeral cloud sandboxes**. [verified]

**Explicit coverage gaps / weaknesses:**
- **False positives**: "The AI sometimes flags working features as broken. Complex business logic, conditional UI states, and multi-step workflows trip it up." [verified — Bug0 KB]
- **No business-rule understanding**: "It explores apps visually and structurally. It doesn't understand your business rules." Works for simple flows (login, nav, form submit); struggles past that. [verified — Bug0 KB]
- **Security is label-only**: no documented authorization/RBAC/IDOR/headers/rate-limit checks despite "security testing" wording. [gap]
- **No admin-panel / multi-role / RBAC** testing described anywhere. [gap]
- **Needs a babysitter**: "still evolving and requires a watchful eye to filter out false positives." [verified — traksource]
- **Sends app context to their servers** (enterprise plan for stricter compliance). [verified]
- **Cost unpredictability**: no published credit-per-action breakdown; credits become a CI/CD bottleneck. [verified — Bug0 KB]
- **No managed/human-verification option** — pure self-serve; no human triage of failures. [verified]

**Pricing:** Free $0 / 150 credits · Starter $19/mo / 400 credits · Standard $69/mo / 1,600 credits · Enterprise custom. All tiers include the AI generation engine + MCP server + cloud execution. [verified — Bug0 KB]

Sources: https://www.testsprite.com/ · https://www.testsprite.com/use-cases/en/ai-e2e-testing-tool · https://www.testsprite.com/use-cases/en/api-testing-checklist · https://docs.testsprite.com/steps · https://github.com/TestSprite/Docs · https://bug0.com/knowledge-base/testsprite-ai · https://bug0.com/knowledge-base/testsprite-pricing · https://traksource.com/testsprite-review/ · https://dicloak.com/video-insights-detail/testsprite-review-2025-this-ai-agent-running-your-software-tests-for-you

---

### Qodo (formerly CodiumAI / Codiumate) — "code-aware unit/integration test generation + code review"

**Positioning (one line):** Agentic AI code-integrity platform: generates meaningful unit tests, enhances coverage, and does AI code review inside the IDE/PR. **Code-level, not runtime/E2E.**

**What it tests (concrete):**
- **Unit tests** with meaningful assertions + edge-case coverage; behavior examples for e.g. user registration: valid-input success, duplicate-email rejection, empty/null name fields, email-format validation, password-strength enforcement, DB-interaction patterns. [verified — DEV/Qodo blog]
- **Edge-case detection**: null/undefined, empty strings/arrays, numeric boundaries (zero, negatives, max-int), special chars/Unicode. [verified]
- **Qodo Cover**: analyzes existing coverage, generates additional tests that **provably run, pass, and increase coverage** (validated, not just emitted). [verified — qodo.ai, GitHub qodo-cover]
- **"Behavior coverage"**: maps logical behaviors and which are validated, vs. line counting. [verified]
- Languages: Python/JS/TS/Java/Go/C++/C#/Ruby/PHP/Kotlin/Rust (strongest with mature ecosystems: pytest, Jest, Vitest, JUnit). [verified]

**How it discovers what to test:** **Static analysis of source code** (function/class under cursor or in PR); no runtime crawl, no URL exploration. [verified]

**Explicit coverage gaps:**
- **No runtime / E2E / browser testing** — it writes tests, doesn't drive a live app. [gap]
- **No visual, accessibility, performance, or API-status-against-live-endpoint** testing. [gap]
- **No authorization/RBAC/admin-panel/IDOR** awareness — it tests code units in isolation, not multi-role runtime authz. [gap]
- Quality drops on less-mature test ecosystems. [verified]

**Pricing/positioning:** Free tier + paid Teams/Enterprise (per-seat, dev-tool pricing). Marketed to developers, not QA orgs.

Sources: https://www.qodo.ai/ · https://www.qodo.ai/blog/automate-test-coverage-introducing-qodo-cover/ · https://github.com/qodo-ai/qodo-cover · https://dev.to/rahulxsingh/qodo-ai-test-generation-how-it-works-with-examples-4abk

---

### Meticulous — "no-code visual/behavioral regression from recorded sessions"

**Positioning (one line):** Auto-generates and self-maintains a visual + behavioral E2E suite by recording real user sessions and replaying them against new code — zero test authoring.

**What it tests (concrete):**
- **Visual regression** — pixel-level screenshot diffs before/after a change, captured after each user event. [verified]
- **Behavioral/logic regressions & UI bugs** surfaced during replay. [verified]
- Captures DOM mutations, JS events, and network traffic; reconstructs interactions against current code. [verified]

**How it discovers what to test:** A **script tag** in the app head records user-interaction sessions (dev/staging/preview); AI clusters sessions into unique flows/code paths and generates the suite. Self-maintaining: adds tests for new features, removes stale ones. [verified]

**Explicit coverage gaps (stated by competitor analysis):**
- **"Does not replace structured automated test suites or validate backend side effects in real time."** [verified — QA Wolf comparison] → i.e., **no backend/API assertion, no server-state validation**.
- **Regression-only** — catches *changes* vs. a baseline; it does not assert *correctness* of net-new behavior or business rules. [gap]
- **No authorization/RBAC/admin/IDOR/security** testing. [gap]
- Coverage is bounded by **what users actually clicked** — unexercised flows (and most admin/error paths) are invisible. [gap]
- False positives from minor rendering diffs (inherent to visual diffing). [verified]

**Pricing/positioning:** Usage/seat-based, sales-assisted; aimed at frontend-heavy product teams.

Sources: https://www.meticulous.ai/ · https://www.qawolf.com/blog/the-12-best-ai-testing-tools-in-2026

---

### Mabl — "low-code unified test-automation platform"

**Positioning (one line):** Enterprise low-code platform unifying browser, mobile, **API, email, PDF, accessibility, and performance** testing with self-healing + GenAI test creation.

**What it tests (concrete, broadest functional surface in this set):**
- Functional E2E (web + mobile). [verified]
- **Visual regression** via computer vision (layout-change detection). [verified]
- **API testing**: schema checking + response validation. [verified]
- **Accessibility**: WCAG checks, color contrast, screen-reader compatibility. [verified]
- **Performance**: page-load + test-run-time tracking with clustering for regression detection. [verified]
- **Email & PDF** validation. [verified]

**How it discovers what to test:** Screen recordings, low-code visual builders, prompts (GenAI test creation), and from **user stories / Jira tickets**. Self-healing adapts tests to UI changes. [verified]

**Explicit coverage gaps (stated):**
- **"Coverage strategy, failure investigation, and long-term suite maintenance remain your team's responsibility."** [verified — QA Wolf]
- **"Complex auth flows, dynamic SPAs, and integration with AI-coding-agent workflows still require workarounds."** [verified — Shiplight]
- **No authorization/RBAC/admin-panel/IDOR/server-side-authz** testing — its "API testing" is schema + response validation, not access-control or business-logic-authz. [gap]
- No security-header / middleware testing. [gap]

**Pricing/positioning:** Enterprise SaaS, quote-based; among the most mature/expensive.

Sources: https://www.mabl.com/ · https://moge.ai/product/mabl · https://www.qawolf.com/blog/the-12-best-ai-testing-tools-in-2026 · https://www.shiplight.ai/blog/best-agentic-qa-tools-2026

---

### Reflect.run (SmartBear) — "no-code, AI-prompt E2E + visual + API"

**Positioning (one line):** No-code, cloud-recorded E2E testing where plain-English steps become resilient automated actions; the AI re-consults at runtime so steps survive UI change.

**What it tests (concrete):**
- No-code **E2E** functional flows. [verified]
- **Visual testing**. [verified]
- **API testing** (no-code). [verified]
- **Cross-browser** testing. [verified]
- AI runtime steps, e.g. "fill out all form fields with realistic values" resolves dynamically. [verified]

**How it discovers what to test:** **User records actions** in-browser → repeatable test; plus natural-language AI steps. (Human-driven authoring, not autonomous crawl.) [verified]

**Explicit coverage gaps:**
- Coverage is **only what a human recorded** — no autonomous discovery of untested flows. [gap]
- **No authorization/RBAC/admin/IDOR/security-header/server-authz** testing. [gap]
- Backend testing limited to API request/response, not access-control or error-handling-under-auth. [gap]

**Pricing:** Team $200/mo (500 runs, 10 users) · Professional $500/mo · Reflect AI custom. 2-week free trial. [verified]

Sources: https://reflect.run/ · https://reflect.run/pricing/ · https://reflect.run/api-testing/ · https://reflect.run/docs/recording-tests/testing-with-ai/

---

### Checkly — "Playwright-native synthetic monitoring (production), now 'reliability layer for agents'"

**Positioning (one line):** Monitoring-first, code-based: runs Playwright in production as continuous synthetic checks for UI + API uptime/correctness. **Not a test-generation tool — a runtime monitor.**

**What it tests (concrete):**
- **Browser checks** — Playwright scripts against the UI (real user actions). [verified]
- **Playwright Check Suites** — your whole Playwright project ported to production monitoring. [verified]
- **API checks** — assert status, payload, **response time** on endpoints. [verified]
- **Multistep checks** — chain API calls to test backend workflows (auth → create → verify). [verified]

**How it discovers what to test:** It does **not** discover — **you write Playwright code** (or bring your existing suite). Discovery is the engineer's job. [verified]

**Explicit coverage gaps:**
- **No AI test generation / no autonomous discovery / no codebase scan.** You must author everything. [gap]
- **No visual, accessibility** testing. [gap]
- **No authorization/RBAC/admin/IDOR** testing unless you hand-code it (and the matrix below counts only out-of-box capability). [gap]
- It is a **monitor**, not a pre-launch auditor — assumes tests already exist. [gap — important positioning contrast with LaunchAudit]

**Pricing:** Free Hobby (10k API + 1.5k browser runs/mo) · Team from $30/mo, scales by check volume. [verified]

Sources: https://www.checklyhq.com/ · https://www.checklyhq.com/product/synthetic-monitoring/ · https://www.checklyhq.com/pricing/

---

### Bug0 — "managed AI QA engineer (human-in-the-loop) on Passmark/Playwright"

**Positioning (one line):** Managed service: a forward-deployed QA engineer + AI platform that builds, heals, and human-verifies Playwright E2E/cross-browser coverage and gates releases. **Honesty/human-verification is the product.**

**What it tests (concrete):**
- CI/CD test automation, **E2E + cross-browser**, Playwright suites. [verified]
- Powered by **Passmark** (open-source): AI step execution, **multi-model assertion consensus**, smart caching, auto-healing. [verified]
- Targets **100% of critical user flows in ~7 days**, full app in ~4 weeks. [claim]

**How it discovers what to test:** A human QA engineer + AI plan and generate tests; engineer joins your Slack/sprint, verifies every failure, files bugs with video + repro, gates releases. [verified]

**Explicit coverage gaps:**
- **Human-gated throughput** — coverage speed bounded by the assigned engineer. [inherent]
- E2E/UI-flow focus; **no documented authorization/RBAC/admin/IDOR/security-header/server-authz** test category. [gap]
- No "scan-the-repo, audit-before-launch" self-serve mode (Bug0 Studio self-serve is the lighter tier). [partial]
- **Strength to copy:** every failure is human-verified with video + repro — the "blocked/needs-human honesty" bar LaunchAudit must meet or beat with provenance/evidence. [verified]

**Pricing:** $2,500/mo flat (dedicated engineer + platform, month-to-month); Bug0 Studio self-serve from $250/mo. [verified]

Sources: https://bug0.com/ · https://bug0.com/pricing

---

### QA Wolf — "managed AI E2E, 80% coverage guarantee, zero-flake"

**Positioning (one line):** Managed AI + human service that autonomously explores the app, writes **deterministic Playwright/Appium code you own**, targets 80% E2E coverage in ~4 months, with human-verified bug reports and a zero-flake guarantee.

**What it tests (concrete — broadest "owned-code" E2E in this set):**
- Web (Playwright), **mobile (Appium)**, **APIs**, **backend-dependent flows**, **multi-user workflows**. [verified — QA Wolf's own comparison]
- API setup, **database state management**, SMS/email verification support. [verified]
- "Triple-A" narrowly-focused tests; unlimited parallel runs; AI maintenance agent. [verified]

**How it discovers what to test:** AI mapping agent **autonomously explores** the app + documents workflows; natural-language prompts; then automation agent writes code. [verified]

**Explicit coverage gaps:**
- **"Tests live in their system"** (per Shiplight) — though QA Wolf counters you own the Playwright code; control/portability is debated. [mixed]
- **No coding-agent / IDE integration** for the dev loop. [verified — Shiplight]
- **E2E-flow framing**: covers multi-user workflows but **does not market authorization/RBAC enforcement, admin-panel role-matrix, IDOR/BOLA, security-headers, or middleware** as test categories. "Multi-user" ≠ "negative authz testing." [gap]
- Expensive + onboarding-heavy (managed model). [verified]

**Pricing:** ~$40–44/test/mo; median ACV ~$90k; typically $60k–$250k+/yr. [verified]

Sources: https://www.qawolf.com/ · https://www.qawolf.com/blog/the-12-best-ai-testing-tools-in-2026 · https://bug0.com/knowledge-base/qa-wolf-pricing

---

### Autify — "no-code record-and-replay E2E with AI self-healing"

**Positioning (one line):** No-code, Chrome-extension record-and-replay E2E for web + mobile across browsers/real devices, with AI self-healing and AI-generated test cases. (Autify NoCode + Autify Nexus/Genesis/Aximo lines.)

**What it tests (concrete):**
- E2E (primary), regression, smoke, functional. [verified]
- **Visual regression** (auto-diff). [verified]
- Cross-browser + real-device, parallel execution. [verified]

**How it discovers what to test:** **Human records** interactions via Chrome extension; AI generates/updates test cases and self-heals on app change. [verified]

**Explicit coverage gaps:**
- Coverage bounded by **recorded** scenarios — no autonomous codebase/authz discovery. [gap]
- **No authorization/RBAC/admin/IDOR/API-error/security-header** testing. [gap]
- No backend/API-status testing emphasis. [gap]

**Pricing:** Quote-based; tiered by run-steps, seats, platforms. [verified]

Sources: https://nocode.autify.com/ · https://nocode.autify.com/pricing · https://autify.com/

---

### Ranger — "always-on autonomous AI QA engineer; PR-style feature review"

**Positioning (one line):** Autonomous web agents explore the app and generate **Playwright** code (QA-expert-reviewed); designed to verify AI-coding-agent work in a real browser and turn passing verifications into permanent E2E tests.

**What it tests (concrete):**
- Autonomous **E2E** exploration → Playwright code. [verified]
- **Feature verification for AI coding agents** (e.g., Claude Code tests its own work before human review). [verified]
- Evidence per run: **screenshots, video, Playwright traces**, in a GitHub-PR-style review UI. [verified]
- Self-healing, intelligent bug triage / flaky-test filtering. [verified]

**How it discovers what to test:** AI web agents **autonomously explore**; humans turn successful verifications into permanent tests with one click. [verified]

**Explicit coverage gaps:**
- **UI/E2E-flow focus** — no documented authorization/RBAC/admin-role-matrix, IDOR/BOLA, security-headers, middleware, or backend-error-handling category. [gap]
- Evidence/review UX is strong (copy-worthy), but **what** it checks is still happy-path + feature-flow, not negative-authz/security. [gap]

**Pricing:** Custom, by suite size + frequency; flexible for small teams. [verified]

Sources: https://www.ranger.net/ · https://www.ranger.net/post/ranger-vs-qa-wolf · https://docs.ranger.net/ · https://www.xyz.vc/theorems/ranger-becomes-your-first-and-only-fully-automated-qa-engineer

---

### Momentic — "AI-native intent-based E2E + visual + API + accessibility"

**Positioning (one line):** AI-native platform where natural-language intent ("click the OK button") resolves to runtime element interaction via screenshots + a11y tree + network/console; bundles E2E, visual, API, accessibility. Includes an autonomous exploratory agent.

**What it tests (concrete):**
- **E2E** (intent-based, self-healing locators). [verified]
- **Visual** testing. [verified]
- **API** testing. [verified]
- **Accessibility** testing. [verified]
- Autonomous agent crawls app → identifies critical flows → generates tests. [verified]

**How it discovers what to test:** Natural-language authoring **+** autonomous exploratory crawl (screenshots, a11y tree, network logs, console). [verified]

**Explicit coverage gaps:**
- **Browser support**: Chromium/Chrome only; Safari/Firefox on roadmap (not available). [verified]
- **No authorization/RBAC/admin-role-matrix, IDOR/BOLA, security-headers, middleware** testing documented. "API testing" = functional, not access-control. [gap]
- Quote-based, demo-first (no self-serve), so hard for indie/SMB. [verified]

**Pricing:** Quote-based, demo-first. [verified]

Sources: https://momentic.ai/ · https://bug0.com/knowledge-base/what-is-momentic · https://www.ycombinator.com/companies/momentic

---

### Adjacent / also-notable tools (lighter profiles)

| Tool | What it tests | Discovery | Key gap |
|---|---|---|---|
| **Octomind** | E2E (Playwright code you own) | **Auto-discovery**: point at URL, agent explores critical flows; "AI doesn't belong in runtime" — authoring-time only, deterministic Playwright execution | No authz/RBAC/admin/IDOR/security; happy-path flow focus. [Bug0 KB; testsprite compare] |
| **Checksum** | E2E (Playwright/Cypress) | **Real production session recordings** → tests of actual usage | "Actual usage only, not the happy paths an engineer thought to test" — and **no** admin/error/authz paths users don't hit; no backend-authz. [Shiplight; QA Wolf] |
| **Testim** | Web UI E2E | Visual editor + recording, smart locators | "Coverage planning, failure triage, suite maintenance owned by your team"; no authz/security. [QA Wolf] |
| **Applitools / Percy** | Visual regression only | Screenshot vs. baseline | Visual-only; minor rendering diffs → false positives; nothing functional/authz/backend. [QA Wolf] |
| **Replay.io** | Browser regression / time-travel debug | Session replay | Debugging-focused, not a structured suite or authz/security. [QA Wolf] |
| **Functionize** | Web | NL inputs / ML fine-tuned to app | "Execution remains non-deterministic"; enterprise sales; no authz/security category. [QA Wolf; Shiplight] |
| **testRigor** | Web, mobile native, API | Plain-English descriptions | Marketed to non-technical; no authz/RBAC/security depth. [Shiplight] |
| **ACCELQ / Virtuoso** | Web/mobile/API/desktop/SAP (ACCELQ); functional/visual/cross-browser (Virtuoso) | Codeless AI / user-story + visual | Enterprise codeless; no documented authz/RBAC/IDOR/security category. [Shiplight] |
| **IDE copilots (Copilot / Cursor / Claude Code)** | Unit/integration/E2E **scaffolding** | NL prompts in IDE | "Execution, infra, coverage modeling, CI/CD, maintenance remain your team's responsibility." [QA Wolf] |
| **Security-native tools (ZeroThreat, Aptori, Escape, StackHawk, Levo)** | **BOLA/IDOR, broken access control, business-logic authz**, OWASP, DAST across REST/GraphQL/gRPC | API spec + simulated attacker traffic, multi-user/permission-boundary modeling | These **do** cover authz/IDOR — but they are **security scanners, not QA/functional-correctness tools**. They don't do form-validation, visual, a11y, UX-flow, or "is the build launch-ready" auditing. **This is the seam LaunchAudit straddles.** |

Sources: https://bug0.com/knowledge-base/octomind-ai-testing-platform-features · https://www.shiplight.ai/blog/best-agentic-qa-tools-2026 · https://www.qawolf.com/blog/the-12-best-ai-testing-tools-in-2026 · https://www.aptori.com/glossary/bola-broken-object-level-authorization · https://escape.tech/blog/best-ai-pentesting-tools/ · https://securityboulevard.com/2026/04/dast-tools-complete-buyers-guide-10-solutions-to-know-in-2026/ · https://www.levo.ai/resources/blogs/what-is-api-authorization-testing

---

## 2. Master Coverage Matrix (check-category × competitor)

Legend: **Y** = out-of-box capability (verified or strongly claimed) · **~** = partial / shallow / claim-only / requires hand-coding · **N** = not offered / no evidence · **(sec)** = only the dedicated security scanners.

| Check category | TestSprite | Qodo | Meticulous | Mabl | Reflect | Checkly | Bug0 | QA Wolf | Autify | Ranger | Momentic | Octomind | Checksum | Sec-scanners |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Functional E2E / user flows** | Y | N | ~ (replay) | Y | Y | Y (code) | Y | Y | Y | Y | Y | Y | Y |
| **Form validation (client)** | Y | ~ | ~ | Y | Y | ~ | Y | Y | Y | Y | Y | Y | N |
| **Unit / integration tests (code)** | ~ | Y | N | N | N | N | N | N | N | N | N | N | N |
| **Code-coverage enhancement** | N | Y | N | N | N | N | N | N | N | N | N | N | N |
| **Visual regression** | ~ | N | Y | Y | Y | N | ~ | ~ | Y | ~ | Y | ~ | N |
| **Accessibility (WCAG)** | ~ | N | N | Y | N | N | N | ~ | N | N | Y | N | N |
| **Performance / page-load** | ~ | N | N | Y | N | Y (resp-time) | N | ~ | N | N | N | N | N |
| **API status / contract / schema** | Y | N | N | Y | Y | Y | Y | Y | ~ | ~ | Y | ~ | Y(sec) |
| **API multi-step backend workflow** | ~ | N | N | ~ | ~ | Y | Y | Y | N | ~ | ~ | ~ | Y(sec) |
| **Backend error-handling / negative paths** | ~ | ~ | N | ~ | ~ | ~ | ~ | ~ | N | ~ | ~ | ~ | Y(sec) |
| **Auth flow (login happy path)** | Y | N | ~ | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| **Authorization / RBAC multi-role matrix** | N | N | N | N | N | N | N | ~ | N | N | N | N | **Y(sec)** |
| **Admin-panel / privileged-route testing** | N | N | N | N | N | N | N | N | N | N | N | N | ~ (sec) |
| **Server-side authz (not UI-hidden-only)** | N | N | N | N | N | N | N | ~ | N | N | N | N | **Y(sec)** |
| **IDOR / BOLA (object-level authz)** | N | N | N | N | N | N | N | N | N | N | N | N | **Y(sec)** |
| **Security headers / middleware** | ~claim | N | N | N | N | N | N | N | N | N | N | N | Y(sec) |
| **Rate-limiting / abuse** | N | N | N | N | N | N | N | N | N | N | N | N | Y(sec) |
| **Autonomous discovery (no human authoring)** | Y | N | Y | ~ | N | N | Y | Y | ~ | Y | Y | Y | ~ |
| **Repo / codebase scan as discovery source** | Y | Y | N | N | N | N | ~ | N | N | N | N | N | ~ (spec) |
| **PRD / requirements-aware testing** | Y | N | N | ~ (Jira) | N | N | ~ | ~ | N | N | N | N | N |
| **"Blocked / needs-human" honesty + evidence** | ~ | N | N | ~ | N | N | **Y** | **Y** | N | **Y** | ~ | ~ | ~ |
| **You own the test code (portable)** | ~ | Y | N | N | N | Y | Y | Y | N | Y | ~ | Y | ~ |
| **Self-serve / SMB-priced** | Y | Y | ~ | N | Y | Y | ~ | N | ~ | ~ | N | Y | ~ |

---

## 3. White-Space Synthesis — Where LaunchAudit Wins

The matrix exposes a hard, defensible truth: **the entire functional-QA market clusters on the same columns (E2E flows, visual, a11y, API-schema) and the entire authorization/security column is empty** — except dedicated security scanners that don't do functional QA and aren't positioned as "is this build launch-ready" auditors. LaunchAudit can own the seam between them.

**The empty columns (true white space — no functional-QA competitor covers these):**

1. **Authorization / RBAC multi-role matrix testing.** Nobody logs in as role A, role B, and anonymous and asserts each can/can't reach each route+action. QA Wolf's "multi-user workflows" is the closest, and it's still positive-path, not a negative-authz matrix. **This is the single biggest gap.**

2. **Admin-panel / privileged-route auditing.** Zero competitors enumerate admin routes and verify they're protected. Crawl-based tools (Meticulous, Checksum) are structurally blind here — admins/error paths aren't in recorded user sessions.

3. **Server-side authorization vs. UI-hidden-only.** Every tool that "tests auth" tests the login screen. None verify that a hidden/disabled button's endpoint actually rejects an unauthorized direct request. This is exactly the FDC-relevant failure class (middleware logs "admin access granted" but never checks role — the documented Clerk-middleware bug pattern).

4. **IDOR / BOLA (object-level authorization).** Owned only by security scanners (Aptori, Escape, ZeroThreat, StackHawk). No QA tool touches it. LaunchAudit bringing this into a "pre-launch audit" is novel.

5. **Security headers + middleware correctness** (CSP, HSTS, auth middleware ordering, route guards). TestSprite *claims* "security testing" but documents none of it; everyone else is silent.

6. **Backend error-handling under auth (negative paths).** Broadly "~" everywhere — claimed, rarely concrete. Real coverage of 401/403/404/409/422/500 behavior on protected endpoints is unclaimed white space.

**The "honesty" wedge (partially contested — must match Bug0/QA Wolf/Ranger):**
7. **"Blocked / needs-human" honesty with evidence.** Bug0, QA Wolf, and Ranger set the bar: human-verified failures with **video + repro + traces**. The self-serve AI tools (TestSprite especially) are criticized for **false positives and no triage**. LaunchAudit must ship **provenance-grade evidence** (screenshot + request/response + repro + an explicit "I could not verify X, human needed" state) to win trust where TestSprite loses it. This is table-stakes-to-leapfrog, not pure white space.

**The discovery wedge (contested but winnable):**
8. **Repo-scan + PRD-aware + runtime-crawl, fused.** Only TestSprite combines codebase-scan + PRD + URL-crawl, and it does authz none. Crawl-only tools (Octomind, Checksum, Meticulous) can't see role-gated routes they never reach. LaunchAudit using a **repo scan to enumerate every route, role, and guard** — then driving them at runtime under each role — is a discovery method none of them fully implement, and it's the only way to reach admin/authz coverage.

**Positioning contrast to exploit:** Checkly = monitor (assumes tests exist). QA Wolf/Bug0 = managed + expensive ($90k+/$2.5k+). Momentic/Autify/Mabl = quote-based/enterprise. TestSprite = cheap self-serve but shallow + false-positive-prone + zero authz. **LaunchAudit's lane: self-serve, pre-launch, repo-aware, and the only one that audits authorization/RBAC/admin/server-authz/IDOR with honest, evidenced, blocked-when-uncertain results.**

---

*All capability claims tagged [claim] are vendor marketing not independently verified; [verified] are corroborated by docs or third-party comparison; [gap] are confirmed absences (either explicitly stated by the vendor/comparison or absent from all reviewed material). The authorization/RBAC/IDOR column being empty across functional-QA tools is the highest-confidence finding in this report.*
