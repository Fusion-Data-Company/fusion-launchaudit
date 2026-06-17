# Functional / UI / End-to-End — Test Catalog

Domain owner: functional, UI, and end-to-end testing, plus the overall test-type / test-level taxonomy.
Every row below is traceable to a named source surfaced by Perplexity (`sonar-pro`) and saved in `raw/functional-NN.json`.

> Status note: 7 of a planned 10 Perplexity passes completed before the machine's
> disk filled and blocked all further `curl` calls (see "Incomplete passes"
> below). This file catalogs everything sourced in passes 01-07. Passes 08-10
> (UI states, navigation/responsive, visual-regression/cross-browser detail) were
> NOT retrieved and are listed as gaps. No new API calls were made when writing
> this file — it is compiled entirely from the saved raw JSON.

## Sources used

| Source | Org | Covers | URL |
|---|---|---|---|
| ISTQB CTFL v4.0.1 Syllabus | ISTQB (International Software Testing Qualifications Board) | Test levels, test types, black-box/white-box techniques | https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf |
| ISTQB Glossary | ISTQB | Definitions of techniques (e.g. boundary value analysis) | https://glossary.istqb.org/ |
| ISO/IEC/IEEE 29119 | ISO / IEC / IEEE | Generic testing concepts, processes, documentation, techniques (Parts 1-5) | https://iso.org/standard/45142.html |
| Testing Library — Guiding Principles | Testing Library (OSS) | User-centric UI/component query philosophy | https://testing-library.com/docs/guiding-principles/ |
| Testing Library — Queries | Testing Library (OSS) | Query priority order & variants | https://testing-library.com/docs/queries/about |
| Playwright — Best Practices | Microsoft | E2E browser-automation best practices | https://playwright.dev/docs/best-practices |
| Cypress — Best Practices | Cypress.io | E2E best practices and anti-patterns | https://docs.cypress.io/guides/references/best-practices |
| MDN — Client-side form validation | Mozilla (MDN) | HTML constraint validation, form-field rules | https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Form_validation |
| OWASP WSTG — Input Validation | OWASP | Input-validation security tests (server-side, injection, file upload) | https://owasp.org/www-project-web-security-testing-guide/ |
| Nielsen Norman Group | NN/g | Form usability, error messaging, reset/cancel, wizards | https://www.nngroup.com/articles/form-validation/ |
| Baymard Institute | Baymard | Inline form-validation usability | https://baymard.com/blog/inline-form-validation |
| web.dev | Google | Sign-in/sign-up form best practices, autofill, masking | https://web.dev/articles/sign-in-form-best-practices |
| W3C / WHATWG + Web Platform Tests | W3C / WHATWG | Rendering/conformance baseline for visual & cross-browser | https://wpt.fyi |

---

## Part A — Test-Type & Test-Level Taxonomy (ISTQB CTFL v4.0)

These are the organizing categories every functional test rolls up to. Source: `raw/functional-02.json` (ISTQB CTFL v4.0.1, Chapter 2.2). Standard ref = syllabus section.

### Test Levels

| # | Level | What it verifies | Standard ref | Source | Source URL | Automatable by LaunchAudit? |
|---|---|---|---|---|---|---|
| L1 | Component / Unit testing | Individual components (functions, classes, modules) behave per spec; inputs, data structures, control flow, error handling | CTFL 2.2.1 | ISTQB CTFL v4.0.1 | https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf | Indirect — detect presence/coverage of unit tests |
| L2 | Component integration testing | Interactions & interfaces between integrated components within a subsystem (data exchange, APIs, protocols) | CTFL 2.2.1 | ISTQB CTFL v4.0.1 | (same) | Indirect |
| L3 | System testing | Complete integrated system vs system requirements; end-to-end functional + some non-functional behavior | CTFL 2.2.1 | ISTQB CTFL v4.0.1 | (same) | Yes — E2E flows via Playwright/Cypress |
| L4 | System integration testing | Interactions between the SUT and other/external systems; cross-system workflows, formats, protocols | CTFL 2.2.1 | ISTQB CTFL v4.0.1 | (same) | Partial — depends on access to external systems |
| L5 | Acceptance testing | System is fit for use and meets acceptance criteria (release decision) | CTFL 2.2.1 | ISTQB CTFL v4.0.1 | (same) | Partial |
| L5a | — User Acceptance Testing (UAT) | System supports user needs & business processes in operational context | CTFL 2.2.1 | ISTQB CTFL v4.0.1 | (same) | Partial |
| L5b | — Operational Acceptance Testing (OAT) | Operational readiness: backup/restore, monitoring, scheduling, DR, maintainability | CTFL 2.2.1 | ISTQB CTFL v4.0.1 | (same) | Partial |
| L5c | — Contractual / Regulatory Acceptance | Compliance with contractual acceptance criteria and regulatory/legal/standards requirements | CTFL 2.2.1 | ISTQB CTFL v4.0.1 | (same) | No — needs human/legal sign-off |
| L5d | — Alpha testing | Evaluation by potential/existing customers at the developer's site before wider release | CTFL 2.2.1 | ISTQB CTFL v4.0.1 | (same) | No |
| L5e | — Beta testing | Evaluation by customers/users at their own sites in production-like environments | CTFL 2.2.1 | ISTQB CTFL v4.0.1 | (same) | No |

### Test Types (most apply at any level)

| # | Type | What it verifies | Standard ref | Source | Source URL | Automatable by LaunchAudit? |
|---|---|---|---|---|---|---|
| T1 | Functional testing | System's functional behavior vs functional requirements (outputs for inputs, business rules, calculations, state transitions, interactions) | CTFL 2.2.2 | ISTQB CTFL v4.0.1 | https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf | Yes |
| T2 | Non-functional testing | Quality characteristics: performance/efficiency, usability, reliability, security, compatibility, portability, maintainability | CTFL 2.2.2 | ISTQB CTFL v4.0.1 | (same) | Partial (other catalog domains) |
| T3 | Black-box (specification-based) testing | External behavior vs specs without knowledge of internals | CTFL 2.2.2 / 4.2 | ISTQB CTFL v4.0.1 | (same) | Yes |
| T4 | White-box (structural) testing | Internal structure/implementation exercised (statement, branch, condition, path coverage) | CTFL 2.2.2 / 4.3 | ISTQB CTFL v4.0.1 | (same) | Indirect — read coverage reports |
| T5 | Change-related: Confirmation (re-)testing | A specific fixed defect is corrected, by re-running the failing test | CTFL 2.2.2 | ISTQB CTFL v4.0.1 | (same) | Yes |
| T6 | Change-related: Regression testing | Changes have not introduced new defects in unchanged parts (re-run existing suite) | CTFL 2.2.2 / 2.3 | ISTQB CTFL v4.0.1 | (same) | Yes |

### ISO/IEC/IEEE 29119 technique families (generic standard)

| # | Family | What it covers | Standard ref | Source | Source URL | Automatable? |
|---|---|---|---|---|---|---|
| T7 | Specification-based (black-box) techniques | EP, BVA, decision tables, state transition, use-case testing | ISO/IEC/IEEE 29119-4 | ISO/IEC/IEEE | https://iso.org/standard/45142.html | Yes |
| T8 | Structure-based (white-box) techniques | Statement, decision/branch coverage | ISO/IEC/IEEE 29119-4 | ISO/IEC/IEEE | (same) | Indirect |
| T9 | Experience-based techniques | Exploratory testing, error guessing | ISO/IEC/IEEE 29119-4 | ISO/IEC/IEEE | (same) | No — human-driven |
| T10 | Keyword-driven testing | Test design via keywords | ISO/IEC/IEEE 29119-5 | ISO/IEC/IEEE | (same) | Partial |

---

## Part B — Black-box / White-box Test Design Techniques

Source: `raw/functional-03.json` (ISTQB CTFL v4.0.1, Ch. 4.2 / 4.3).

| # | Technique / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable? |
|---|---|---|---|---|---|---|---|
| D1 | Equivalence Partitioning | Divide input/output domains into partitions; one representative test per valid/invalid partition | Black-box | CTFL 4.2 | ISTQB CTFL v4.0.1 | https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf | Yes — generate field-value cases |
| D2 | Boundary Value Analysis | Test min-1, min, min+1, max-1, max, max+1 of ordered partitions | Black-box | CTFL 4.2 | ISTQB CTFL v4.0.1 (glossary) | https://glossary.istqb.org/en/search/boundary%20value%20analysis | Yes |
| D3 | Decision Table Testing | Execute combinations of conditions (causes) → actions (effects); one test per relevant rule | Black-box | CTFL 4.2 | ISTQB CTFL v4.0.1 | (same) | Yes |
| D4 | State Transition Testing | Exercise valid and invalid state transitions from a state model; state & transition coverage | Black-box | CTFL 4.2 | ISTQB CTFL v4.0.1 | (same) | Yes — model multi-step/auth flows |
| D5 | Use Case Testing | Execute main, alternate, and exception flows of a use case end-to-end | Black-box | CTFL 4.2 | ISTQB CTFL v4.0.1 | (same) | Yes |
| D6 | Statement Coverage | % of executable statements exercised by the test suite (weakest structural metric) | White-box | CTFL 4.3 | ISTQB CTFL v4.0.1 | (same) | Indirect — read coverage tool output |
| D7 | Branch / Decision Coverage | % of decision outcomes (true/false branches) exercised | White-box | CTFL 4.3 | ISTQB CTFL v4.0.1 | (same) | Indirect |
| D8 | Pairwise / Combinatorial testing | Every pair of input-parameter values appears in ≥1 test (covering array, strength 2) | Combinatorial approach (not a core CTFL v4.0 named technique; per ISTQB Advanced + industry) | ISTQB (approach) | (same) | Yes — generate combination matrix |

---

## Part C — UI Component / Query Testing (Testing Library)

Source: `raw/functional-04.json` (testing-library.com). Standard ref = doc page. Guiding principle: "The more your tests resemble the way your software is used, the more confidence they can give you."

### Guiding principles

| # | Principle | What it verifies | Source | Source URL | Automatable? |
|---|---|---|---|---|---|
| TL1 | Tests resemble real usage | Tests assert user-visible behavior, not implementation details | Testing Library | https://testing-library.com/docs/guiding-principles/ | Yes |
| TL2 | Work with DOM nodes, not component instances | Queries target DOM, not framework internals | Testing Library | (same) | Yes |
| TL3 | User-centric, accessibility-first | Find elements by role/label/text like a screen reader would | Testing Library | (same) | Yes |
| TL4 | Simple, consistent APIs | get/query/find prefixes have consistent semantics | Testing Library | (same) | Yes |

### Query priority order (highest → lowest) — assert each element is found by the most user-facing locator available

| # | Query | Targets | When to use | Source URL | Automatable? |
|---|---|---|---|---|---|
| TL5 | `*ByRole` | Accessible ARIA role + accessible name | First choice for interactive/landmark elements (buttons, links, headings, dialogs) | https://testing-library.com/docs/queries/byrole | Yes |
| TL6 | `*ByLabelText` | Text of associated `<label>` | Form inputs with visible labels | https://testing-library.com/docs/queries/bylabeltext | Yes |
| TL7 | `*ByPlaceholderText` | `placeholder` attribute | Fields identified by placeholder (use sparingly; label preferred) | https://testing-library.com/docs/queries/byplaceholdertext | Yes |
| TL8 | `*ByText` | Visible text content (innerText) | Static text / interactive elements found by visible copy | https://testing-library.com/docs/queries/bytext | Yes |
| TL9 | `*ByDisplayValue` | Current value of a form element | Assert what value the user currently sees in a field | https://testing-library.com/docs/queries/bydisplayvalue | Yes |
| TL10 | `*ByAltText` | `alt` attribute on images | Non-text content (images/icons) via alt text | https://testing-library.com/docs/queries/byalttext | Yes |
| TL11 | `*ByTitle` | `title` attribute / `<title>` | Only when role/label/text/alt don't apply | https://testing-library.com/docs/queries/bytitle | Yes |
| TL12 | `*ByTestId` | `data-testid` (not user-facing) | Escape hatch / last resort | https://testing-library.com/docs/queries/bytestid | Yes |

### Query variant families (apply to every base above)

| # | Prefix | Throws on missing? | Async? | Use when | Source URL | Automatable? |
|---|---|---|---|---|---|---|
| TL13 | `getBy*` / `getAllBy*` | Yes | No | Element must be present immediately | https://testing-library.com/docs/queries/about | Yes |
| TL14 | `queryBy*` / `queryAllBy*` | No (null/[]) | No | Assert absence / optional presence | (same) | Yes |
| TL15 | `findBy*` / `findAllBy*` | Yes | Yes (Promise) | Element appears asynchronously (network, timers) | (same) | Yes |

---

## Part D — End-to-End Best Practices (Playwright)

Source: `raw/functional-05.json` (playwright.dev/docs/best-practices). Standard ref = doc section.

| # | Practice / Check | What it ensures | Standard ref | Source | Source URL | Automatable? |
|---|---|---|---|---|---|---|
| PW1 | Test user-visible behavior | Tests robust to refactors; assert rendered UI not internals | best-practices | Playwright | https://playwright.dev/docs/best-practices | Yes |
| PW2 | Use locators / role-based selectors | Stable selectors via user-facing attributes & accessible names | best-practices | Playwright | (same) | Yes |
| PW3 | Web-first assertions with auto-waiting | Built-in assertions retry/wait, reducing flakiness vs manual sleeps | test-assertions | Playwright | https://playwright.dev/docs/test-assertions | Yes |
| PW4 | Avoid testing third-party dependencies | Only test what you control; no external-site/server dependence | best-practices | Playwright | https://playwright.dev/docs/best-practices | Yes — lint for external nav |
| PW5 | Test isolation | Each test runs independently (own cookies/storage/data) | best-practices | Playwright | (same) | Yes |
| PW6 | Use fixtures & hooks | Structured setup/teardown, reusable state | test-fixtures | Playwright | https://playwright.dev/docs/test-fixtures | Yes |
| PW7 | Run across all browsers (Chromium/Firefox/WebKit) | Cross-browser coverage via config projects | test-projects | Playwright | https://playwright.dev/docs/test-projects | Yes |
| PW8 | Use soft assertions | Collect multiple failures in one run | test-assertions | Playwright | https://playwright.dev/docs/test-assertions | Yes |
| PW9 | Manage flakiness with retries + tracing | Distinguish intermittent failures; rich debug artifacts in CI | test-retries / trace-viewer | Playwright | https://playwright.dev/docs/test-retries | Yes |
| PW10 | Use codegen to bootstrap tests | Fast initial coverage of user journeys | codegen | Playwright | https://playwright.dev/docs/codegen | Partial |
| PW11 | Debug with UI Mode + Trace Viewer | Efficient triage of failures/flakiness | test-ui-mode / trace-viewer | Playwright | https://playwright.dev/docs/trace-viewer | Partial |
| PW12 | Test against production-like / controlled data | Deterministic, reproducible runs; control DB/staging data | best-practices | Playwright | https://playwright.dev/docs/best-practices | Yes |
| PW13 | Lint + type-check tests (TS + ESLint) | Catch errors early (e.g. no-floating-promises, tsc --noEmit) | best-practices | Playwright | (same) | Yes |
| PW14 | Run tests frequently in CI | Fast regression feedback; consistent pinned environment | best-practices / ci | Playwright | https://playwright.dev/docs/ci | Yes |

---

## Part E — End-to-End Best Practices & Anti-Patterns (Cypress)

Source: `raw/functional-06.json` (docs.cypress.io/guides/references/best-practices).

| # | Practice / Anti-pattern | What it ensures / reason | Standard ref | Source | Source URL | Automatable? |
|---|---|---|---|---|---|---|
| CY1 | Use `data-*` attributes to select elements | Selectors isolated from CSS/JS changes | best-practices#Selecting-Elements | Cypress | https://docs.cypress.io/guides/references/best-practices | Yes |
| CY2 | Anti-pattern: brittle CSS/ID selectors | Fragile when UI changes | best-practices#Selecting-Elements | Cypress | (same) | Yes — detect |
| CY3 | Anti-pattern: arbitrary `cy.wait(time)` | Slow, doesn't express the actual condition | best-practices#Unnecessary-Waiting | Cypress | (same) | Yes — detect |
| CY4 | Wait on route aliases / assertions | Proceed only when app is ready | best-practices#Unnecessary-Waiting | Cypress | (same) | Yes |
| CY5 | Keep tests independent | Run alone & pass; no order dependency | best-practices#Having-tests-rely-on-the-state-of-previous-tests | Cypress | (same) | Yes |
| CY6 | Anti-pattern: tests rely on previous test state | Cascading failures, non-deterministic | (same) | Cypress | (same) | Yes — detect |
| CY7 | Control state programmatically (not via UI) | Avoid slow/brittle UI setup (e.g. programmatic login) | best-practices#Organizing-Tests-Logging-In-Controlling-State | Cypress | (same) | Yes |
| CY8 | Anti-pattern: don't assign command return values | Cypress commands are async; assignment unreliable | best-practices#Assigning-Return-Values | Cypress | (same) | Yes — detect |
| CY9 | Use `.then()` closures or `.as()` aliases | Reliable access to yielded values | best-practices#Assigning-Return-Values | Cypress | (same) | Yes |
| CY10 | Write meaningful multi-assertion E2E tests | Avoid tiny single-assertion unit-style tests | best-practices#Creating-tiny-tests-with-a-single-assertion | Cypress | (same) | Partial |
| CY11 | Set a global `baseUrl`; use relative `cy.visit()` | Maintainability across environments | best-practices#Setting-a-global-baseUrl | Cypress | (same) | Yes |
| CY12 | Anti-pattern: start a web server inside tests | Server should start before the run | best-practices#Web-Servers | Cypress | (same) | Yes — detect |
| CY13 | Clean up state BEFORE tests, not after | Each test starts from a known state | best-practices#Using-after-or-afterEach-hooks | Cypress | (same) | Yes — detect after/afterEach cleanup |

---

## Part F — Form & Input Validation Tests

Source: `raw/functional-07.json` (MDN, OWASP WSTG, ISTQB, NN/g, Baymard, web.dev).

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable? |
|---|---|---|---|---|---|---|---|
| F1 | Required-field validation | Required fields can't be empty; form blocked until provided; correct `:required`/`:invalid` states | Required | HTML constraint validation | MDN | https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Form_validation | Yes |
| F2 | Field-format validation (email/phone/URL/CC/date) | `type=`/`pattern` inputs reject syntactically invalid values; server validates semantics (e.g. Luhn) | Format | WSTG-INP-01 / HTML | OWASP WSTG / MDN | https://owasp.org/www-project-web-security-testing-guide/ | Yes |
| F3 | Min/max length validation | `minlength`/`maxlength` enforced client + server | Length | WSTG-INP-01 / HTML | OWASP / MDN | (same) | Yes |
| F4 | Boundary-value tests | Values just below/at/just above limits behave correctly | Boundary | ISTQB BVA | ISTQB | https://glossary.istqb.org/en/search/boundary%20value%20analysis | Yes |
| F5 | Client- vs server-side validation parity | Server enforces all constraints; bypassing client checks (JS off, tampered request) still rejected | Security parity | WSTG-INP-01 | OWASP WSTG / MDN | https://owasp.org/www-project-web-security-testing-guide/ | Yes |
| F6 | Inline error messaging | Errors shown inline near the field, timely and specific, no full reload | UX | Usability | Baymard / A List Apart | https://baymard.com/blog/inline-form-validation | Partial |
| F7 | Error message clarity | Messages clear, specific, actionable; accessible to assistive tech | UX | NN/g | NN/g | https://www.nngroup.com/articles/form-validation/ | Partial |
| F8 | Disabled submit until valid | Submit disabled while invalid; enabled when valid; server still validates | UX/flow | web.dev | web.dev / MDN | https://web.dev/articles/sign-in-form-best-practices | Yes |
| F9 | Double-submit prevention | Multiple rapid submits handled safely (disable/spinner); server idempotent/token | Reliability | OWASP CSRF/auth cheatsheets | OWASP / web.dev | https://cheatsheetseries.owasp.org/ | Yes |
| F10 | Autofill / autocomplete behavior | Correct `autocomplete` tokens; autofilled values still validated | UX | MDN / web.dev | MDN / web.dev | https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete | Partial |
| F11 | Input masking | Masks (phone/CC) guide input, transform to canonical form before validation | UX | web.dev | web.dev / CXL | https://web.dev/articles/building-better-forms | Partial |
| F12 | Paste handling | Pasted values trimmed/normalized; invalid paste rejected; paste allowed where appropriate | Input | web.dev / WSTG business logic | web.dev / OWASP | https://web.dev/articles/sign-in-form-best-practices | Partial |
| F13 | Whitespace trimming | Leading/trailing whitespace trimmed (email/username) before validation | Input | HTML / WSTG canonicalization | MDN / OWASP | https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Form_validation | Yes |
| F14 | Special-character / Unicode handling | Accept/reject special chars & Unicode per rules; canonicalize before validation; no encoding-trick bypass | Input/Security | WSTG-INP-01 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/ | Yes |
| F15 | SQL / script injection rejection | Malicious payloads (SQLi, `<script>`, JS URLs) rejected/safely handled; parameterized queries, output encoding | Security | WSTG Input Validation (SQLi/XSS) | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/ | Yes |
| F16 | File-upload type & size validation | Allowed MIME/extensions enforced; dangerous types rejected; max size enforced client+server | Upload | WSTG-BUSL / file upload | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/ | Yes |
| F17 | Multi-step form state persistence | State persists across steps/back-forward; errors on later steps don't lose earlier data | Flow | web.dev / NN/g wizards | web.dev / NN/g | https://www.nngroup.com/articles/wizards/ | Yes |
| F18 | Form reset behavior | Reset clears/restores defaults consistently; validation state reset; no unexpected data loss | Flow | HTML form element / NN/g | MDN / NN/g | https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form | Yes |
| F19 | Validation timing (blur vs submit) | Inline feedback on blur (not aggressively while typing); summary on submit | UX | Baymard / A List Apart | Baymard | https://baymard.com/blog/inline-form-validation | Partial |

---

## Incomplete passes (NOT yet sourced — must be run when disk space allows)

The machine disk filled mid-run, blocking all `curl`/Bash. These three planned
Perplexity passes did NOT complete and their raw JSON does not exist. The
corresponding catalog sections are therefore **absent and unsourced**:

- **functional-08** — UI states & page behavior (loading/skeleton, empty, error,
  success, offline, broken-image, overflow/truncation, pagination, infinite
  scroll, sort/filter, modal/focus-trap, toast dismissal, hover/focus/active/
  disabled states, keyboard nav, scroll restoration, back/forward, deep-linking,
  404 page, redirect correctness). Intended sources: NN/g, web.dev, MDN, WCAG.
- **functional-09** — Navigation/link tests + responsive/cross-device (broken-link
  detection, anchor targets, breadcrumb, active nav state, redirect chains,
  canonical link, breakpoints 320/375/768/1024/1440, no horizontal scroll, touch
  target size WCAG 2.5.8 / Apple HIG, viewport meta, reflow WCAG 1.4.10, zoom 400%
  WCAG 1.4.4). Intended sources: WCAG success criteria, web.dev, MDN, Google.
- **functional-10** — Visual-regression detail + cross-browser compatibility detail
  (baseline capture, pixel-diff, per-component/full-page snapshots, threshold
  tolerance, dynamic-content masking, font/anti-aliasing; browser matrix, feature
  detection vs sniffing, caniuse, polyfill verification, JS API support, rendering
  differences, mobile browsers, graceful degradation). Intended sources:
  Playwright/Cypress docs, BrowserStack/Sauce, web.dev, MDN, caniuse, ISTQB.

(High-level pointers to these areas exist in `raw/functional-01.json` — the
sources pass already named WCAG, Web Platform Tests, caniuse, and the
Playwright/Cypress cross-browser doc pages — but the per-check enumeration was
not retrieved, so no rows are claimed here.)

## Unverified / needs a source
None. Every row above carries a Perplexity-surfaced source + URL. Items that were
asked for but not retrieved are listed under "Incomplete passes," not fabricated.

## [MODEL-SUGGESTED — confirm]
None added. Per protocol, no rows were inserted from model training knowledge.

## Raw evidence
- `raw/functional-01.json` — Sources pass (ISTQB, ISO 29119, Testing Library, Playwright, Cypress, W3C/WPT, visual/cross-browser sources)
- `raw/functional-02.json` — ISTQB test levels & test types enumeration
- `raw/functional-03.json` — ISTQB black-box / white-box test design techniques
- `raw/functional-04.json` — Testing Library guiding principles & query priority/variants
- `raw/functional-05.json` — Playwright best-practices enumeration
- `raw/functional-06.json` — Cypress best-practices & anti-patterns
- `raw/functional-07.json` — Form & input validation tests (MDN/OWASP/NN/g/Baymard/web.dev)
- `raw/functional-08.json` — NOT PRODUCED (disk full; UI states pass)
- `raw/functional-09.json` — NOT PRODUCED (disk full; navigation/responsive pass)
- `raw/functional-10.json` — NOT PRODUCED (disk full; visual/cross-browser pass)
