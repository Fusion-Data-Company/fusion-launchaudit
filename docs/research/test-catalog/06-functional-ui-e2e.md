# Functional / UI / End-to-End — Test Catalog

Domain owner: functional, UI, and end-to-end testing, plus the overall test-type / test-level taxonomy.
Every row below is traceable to a named source surfaced by Perplexity (`sonar-pro`) and saved in `raw/functional-NN.json`.

> Status note: all 10 Perplexity passes completed (passes 08-10 were initially
> blocked by a full disk and run later). This file catalogs everything sourced in
> passes 01-10. Every row is compiled from the saved raw JSON.

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
| WCAG 2.1 / 2.2 | W3C (WAI) | Success criteria for states, navigation, responsive, target size, reflow | https://www.w3.org/TR/WCAG22/ |
| WAI-ARIA Authoring Practices (APG) | W3C (WAI) | Dialog/focus-trap, pagination, button, keyboard-interface patterns | https://www.w3.org/WAI/ARIA/apg/ |
| MDN HTTP status / History / img | Mozilla (MDN) | 404/500 semantics, scroll restoration, broken-image, feature detection, engines, graceful degradation, progressive enhancement | https://developer.mozilla.org/ |
| Can I use | caniuse.com | CSS/JS feature support matrices across browsers | https://caniuse.com/ |
| Applitools / Chromatic / BrowserStack Percy / Sauce Labs | vendors | Visual-regression & cross-browser/device tool approaches | https://applitools.com/blog/visual-regression-testing/ |
| Apple Human Interface Guidelines | Apple | 44pt minimum touch-target | https://developer.apple.com/design/human-interface-guidelines |
| Section 508 ICT Testing Baseline | U.S. Access Board | Web baseline tests for bypass blocks, consistent nav, focus | https://ictbaseline.access-board.gov/allwebbaselines.html |

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

## Part G — UI States & Page Behavior

Source: `raw/functional-08.json` (NN/g, web.dev, MDN, WCAG 2.2, WAI-ARIA APG). Standard ref = WCAG SC where applicable, else doc/guideline.

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable? |
|---|---|---|---|---|---|---|---|
| S1 | Loading / skeleton state | Immediate "loading" feedback; stable layout; content not shown as finished early | Loading | web.dev / NN/g | web.dev / NN/g | https://web.dev/articles/skeleton-screens | Yes |
| S2 | Empty state: no data | Clearly explains no content exists; offers next action; not "broken" | Empty | NN/g | NN/g | https://www.nngroup.com/articles/empty-state/ | Yes |
| S3 | Empty state: zero results | Distinguishes "no matching results" from "no data"; guides query/filter change | Empty | NN/g | NN/g | https://www.nngroup.com/articles/empty-state/ | Yes |
| S4 | Error state: failed fetch | Clear non-technical error + recovery action; page stays usable, not blank/frozen | Error | web.dev / NN/g | web.dev / NN/g | https://web.dev/articles/error-handling-best-practices | Yes |
| S5 | Error state: 404 | Useful "page not found" with nav/search recovery, not generic failure | Error | MDN 404 | MDN | https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404 | Yes |
| S6 | Error state: 500 | Server failure treated as recoverable; not misrepresented as client issue | Error | MDN 500 | MDN | https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/500 | Yes |
| S7 | Error state: network timeout | Communicates wait threshold exceeded; gives retry path | Error | web.dev | web.dev | https://web.dev/articles/reliable | Yes |
| S8 | Success / confirmation state | Confirms action completion; reduces uncertainty | Success | NN/g | NN/g | https://www.nngroup.com/articles/response-times-3-important-limits/ | Yes |
| S9 | Success message accessibility | Status messages perceivable by assistive tech without focus change | Success | WCAG 4.1.3 Status Messages | W3C WCAG | https://www.w3.org/TR/WCAG22/#status-messages | Yes |
| S10 | Partial / optimistic-update state | UI reflects partial update; reconciles on server accept/reject; no stale-as-final | State | web.dev | web.dev | https://web.dev/articles/optimistic-updates | Partial |
| S11 | Offline state | Detects connectivity loss; informs user actions may be unavailable; cached content handled | Offline | web.dev | web.dev | https://web.dev/articles/offline | Partial |
| S12 | Slow-network state | Communicates progress/partial readiness; progressive rendering keeps page useful | Performance | web.dev | web.dev | https://web.dev/articles/slow-connection | Partial |
| S13 | Broken-image fallback | Missing/failed images get meaningful fallback; text alternative exists | Media | WCAG 1.1.1 / MDN img | W3C WCAG / MDN | https://www.w3.org/TR/WCAG22/#non-text-content | Yes |
| S14 | Long-text overflow / truncation | Long labels/content don't break layout/overlap; full text reachable; resizable | Layout | WCAG 1.4.10 / 1.4.4 / NN/g | W3C WCAG / NN/g | https://www.w3.org/TR/WCAG22/#reflow | Yes |
| S15 | Pagination | Predictable page-to-page movement; current/total/controls shown; keyboard accessible | Navigation | NN/g / WAI-ARIA APG | NN/g / W3C | https://www.nngroup.com/articles/pagination/ | Yes |
| S16 | Infinite scroll | Content loads near list end; no duplicates/skips; position remains understandable | Navigation | NN/g | NN/g | https://www.nngroup.com/articles/infinite-scrolling/ | Yes |
| S17 | Sort behavior | Sorting reorders results correctly per criterion; control shows state; keyboard-operable | Data | WCAG 3.2.2 / WAI-ARIA APG | W3C WCAG | https://www.w3.org/TR/WCAG22/#on-input | Yes |
| S18 | Filter behavior | Filters refine result set correctly; preserve criteria; no disruptive context change | Data | WCAG 3.2.2 / NN/g | W3C WCAG / NN/g | https://www.nngroup.com/articles/faceted-search/ | Yes |
| S19 | Modal/dialog open-close + focus restore | Opens/closes correctly; returns focus on close; background non-interactive; accessible name | Dialog | WAI-ARIA APG Dialog (Modal) | W3C WAI | https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ | Yes |
| S20 | Modal/dialog focus trap | Keyboard focus stays inside modal until dismissed | Dialog | WAI-ARIA APG Dialog (Modal) | W3C WAI | https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ | Yes |
| S21 | Toast / notification dismissal | Status exposed to AT without disruptive focus; dismissable/timed perceptibly | Notification | WCAG 4.1.3 / NN/g | W3C WCAG / NN/g | https://www.w3.org/TR/WCAG22/#status-messages | Yes |
| S22 | Focus-visible state | Interactive elements show visible focus indicator for keyboard users | Visual state | WCAG 2.4.7 Focus Visible | W3C WCAG | https://www.w3.org/TR/WCAG22/#focus-visible | Yes |
| S23 | Content on hover/focus | Hover-only content not the sole access path; dismissable/hoverable/persistent | Visual state | WCAG 1.4.13 Content on Hover or Focus | W3C WCAG | https://www.w3.org/TR/WCAG22/#content-on-hover-or-focus | Yes |
| S24 | Disabled-state distinction | Disabled controls distinguishable from enabled; not falsely presented as interactive | Visual state | WAI-ARIA APG Button | W3C WAI | https://www.w3.org/WAI/ARIA/apg/patterns/button/ | Yes |
| S25 | Keyboard navigation (reachable) | Every interactive element reachable & operable via keyboard in logical order | Keyboard | WCAG 2.1.1 Keyboard | W3C WCAG | https://www.w3.org/TR/WCAG22/#keyboard | Yes |
| S26 | Focus order | Focus order preserves meaning and operability | Keyboard | WCAG 2.4.3 Focus Order | W3C WCAG | https://www.w3.org/TR/WCAG22/#focus-order | Yes |
| S27 | Widget keyboard interface | Tab/arrow/escape/enter/space behavior matches expected widget pattern | Keyboard | WAI-ARIA APG Keyboard Interface | W3C WAI | https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/ | Yes |
| S28 | Scroll restoration | Navigation returns expected scroll position; back/forward preserves context | Navigation | MDN History.scrollRestoration | MDN | https://developer.mozilla.org/en-US/docs/Web/API/History/scrollRestoration | Yes |

---

## Part H — Navigation / Link & Responsive / Cross-Device

Source: `raw/functional-09.json` (W3C WCAG 2.1/2.2, Section 508 ICT Baseline, Apple HIG, USWDS). Standard ref = WCAG SC number where applicable.

### Navigation / Link tests

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable? |
|---|---|---|---|---|---|---|---|
| N1 | Broken internal/external link detection | All links resolve (no 404/500); destinations match stated purpose | Links | WCAG 2.4.4 / 3.2.4 | W3C WCAG | https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-in-context | Yes |
| N2 | Correct anchor targets | Fragment links (#section) move focus/viewport to existing target IDs | Links | WCAG 2.4.1 / 2.4.3 / 2.4.4 | W3C WCAG | https://www.w3.org/TR/WCAG21/ | Yes |
| N3 | Breadcrumb correctness | Trail reflects hierarchy; items are working links; consistent across pages | Navigation | WCAG 2.4.8 / 3.2.3 | W3C WCAG | https://www.w3.org/TR/WCAG21/ | Yes |
| N4 | Nav active-state / current page | Current page indicated visually + programmatically (aria-current); only one current | Navigation | WCAG 1.3.1 / 2.4.4 / 2.4.8 | W3C WCAG | https://www.w3.org/TR/WCAG21/ | Yes |
| N5 | Redirect chains / canonical link | No excessive redirect chains; canonical tag indicates preferred URL | SEO/Links | (no direct SC; indirect 2.4.4/3.2.3) | W3C WCAG | https://www.w3.org/TR/WCAG21/ | Yes |
| N6 | Hash / deep-link navigation | Deep links open correct view/state; focus placed; no lost content/function | Routing | WCAG 2.4.1 / 2.4.3 / 4.1.2 | W3C WCAG | https://www.w3.org/TR/WCAG21/ | Yes |
| N7 | Browser back/forward behavior | Returns to expected state; no lost input/context; focus stays logical | Routing | WCAG 2.4.3 / 3.2.1 / 3.2.2 | W3C WCAG | https://www.w3.org/TR/WCAG21/ | Yes |
| N8 | 404 / error page existence | Custom 404 reachable for invalid URLs; clear message; nav/search recovery; titled | Error | WCAG 2.4.1 / 2.4.2 / 2.4.5 / 3.3.1 | W3C WCAG | https://www.w3.org/TR/WCAG21/ | Yes |
| N9 | Skip-to-content link | "Skip to main content" present, keyboard-focusable, visible on focus, moves focus to main | Navigation | WCAG 2.4.1 Bypass Blocks | W3C WCAG / Sec 508 | https://www.w3.org/TR/WCAG21/ | Yes |
| N10 | Consistent navigation & naming | Repeated nav in same relative order; same function identified consistently | Navigation | WCAG 3.2.3 / 3.2.4 | W3C WCAG / Sec 508 | https://ictbaseline.access-board.gov/allwebbaselines.html | Partial |
| N11 | Keyboard navigation of menus/links | Operable via keyboard alone; no keyboard trap; logical focus order | Keyboard | WCAG 2.1.1 / 2.1.2 / 2.4.3 | W3C WCAG | https://www.w3.org/TR/WCAG21/ | Yes |
| N12 | Link text clarity & purpose | Link text (alone or in context) conveys destination; no bare "click here" | Links | WCAG 2.4.4 / 2.4.9 | W3C WCAG | https://www.w3.org/TR/WCAG21/ | Partial |

### Responsive / Cross-device tests

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable? |
|---|---|---|---|---|---|---|---|
| R1 | Viewport meta tag | `<meta name="viewport" width=device-width, initial-scale=1>` present so layout adapts | Responsive | WCAG 1.4.10 (technique) | W3C WCAG | https://www.w3.org/TR/WCAG21/ | Yes |
| R2 | Breakpoint coverage (320/375, 768, 1024/1440) | Layout usable at key widths; no hidden/lost content or overlap; reading order preserved | Responsive | WCAG 1.4.10 / 1.3.2 (320 is normative; others industry) | W3C WCAG | https://www.w3.org/TR/WCAG21/ | Yes |
| R3 | No horizontal scroll at 320px | Text reflows at 320 CSS px without 2-D scrolling (exempt: images, tables) | Responsive | WCAG 1.4.10 Reflow | W3C WCAG | https://www.w3.org/TR/WCAG21/ | Yes |
| R4 | Orientation support | Content/function not locked to single orientation unless essential | Responsive | WCAG 1.3.4 Orientation | W3C WCAG | https://www.w3.org/TR/WCAG21/ | Yes |
| R5 | Reflow at 320px incl. zoom 400% | At 320 CSS px OR 400% zoom on 1280px: no 2-D scrolling; all content/function available | Responsive | WCAG 1.4.10 Reflow | W3C WCAG | https://www.w3.org/TR/WCAG21/ | Yes |
| R6 | Resize text to 200% | Text resizable to 200% without AT; no loss of content/function; no clipping/overlap | Responsive | WCAG 1.4.4 Resize Text | W3C WCAG | https://www.w3.org/TR/WCAG21/ | Yes |
| R7 | Text spacing override | Readable when user overrides line-height 1.5×, paragraph 2×, letter 0.12×, word 0.16× | Responsive | WCAG 1.4.12 Text Spacing | W3C WCAG | https://www.w3.org/TR/WCAG21/ | Yes |
| R8 | Target size minimum (24×24) | Pointer targets ≥ 24×24 CSS px (with exceptions) | Touch | WCAG 2.5.8 Target Size (Minimum, AA, WCAG 2.2) | W3C WCAG | https://www.w3.org/TR/WCAG22/#target-size-minimum | Yes |
| R9 | Target size enhanced (44×44) | Pointer targets ≥ 44×44 CSS px | Touch | WCAG 2.5.5 Target Size (Enhanced, AAA) | W3C WCAG | https://www.w3.org/TR/WCAG21/ | Yes |
| R10 | Apple HIG 44pt touch target | Interactive controls ≥ 44×44 pt on iOS/touch devices | Touch | Apple HIG (aligns WCAG 2.5.5) | Apple | https://developer.apple.com/design/human-interface-guidelines | Yes |
| R11 | Responsive nav behavior | Menus/in-page nav usable at all breakpoints & zoom; keyboard + screen-reader friendly; no clip/overlap | Responsive | WCAG 1.4.10 / 2.1.1 / 4.1.2 | W3C WCAG / USWDS | https://designsystem.digital.gov/components/in-page-navigation/accessibility-tests/ | Partial |
| R12 | Logical reading order at breakpoints | DOM/reading order matches visual order; related items grouped logically as layout changes | Responsive | WCAG 1.3.1 / 1.3.2 | W3C WCAG | https://www.w3.org/TR/WCAG21/ | Partial |
| R13 | Cross-device focus visibility | Visible focus indicator on all sizes; no focus loss on rotate/resize | Responsive | WCAG 2.4.3 / 2.4.7 | W3C WCAG / Sec 508 | https://www.w3.org/TR/WCAG21/ | Yes |

---

## Part I — Visual Regression & Cross-Browser / Cross-Device Compatibility

Source: `raw/functional-10.json` (Playwright, Cypress, Applitools, Chromatic, BrowserStack Percy, Sauce Labs, MDN, caniuse, Chrome DevTools, ISTQB).

### Visual regression approaches

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable? |
|---|---|---|---|---|---|---|---|
| V1 | Baseline screenshot capture | Current UI matches approved baseline (golden master); unintended changes caught | Visual regression | Applitools / Ranorex | Applitools | https://applitools.com/blog/visual-regression-testing/ | Yes |
| V2 | Pixel-by-pixel image diff | Exact pixel equality baseline vs current (color/layout/shift) | Visual regression | Applitools | Applitools | https://applitools.com/blog/visual-regression-testing/ | Yes |
| V3 | Per-component visual snapshots | Individual components (Storybook stories) render consistently; regressions isolated | Visual regression | Chromatic | Chromatic | https://www.chromatic.com/blog/visual-testing/ | Yes |
| V4 | Full-page visual snapshots | Entire page layout (header/footer/content/grid) renders as expected | Visual regression | Applitools / Ranorex | Applitools | https://applitools.com/blog/visual-regression-testing/ | Yes |
| V5 | Cross-viewport / responsive snapshots | UI correct at multiple viewport sizes (mobile/tablet/desktop) | Visual regression | BrowserStack Percy | BrowserStack | https://www.browserstack.com/percy/visual-regression-testing | Yes |
| V6 | Threshold / tolerance config | Only significant diffs fail; minor pixel noise tolerated (reduce false positives) | Visual regression | Applitools / Keploy | Applitools | https://applitools.com/blog/visual-regression-testing/ | Yes |
| V7 | Dynamic-content masking / ignore regions | Non-deterministic areas (ads/timestamps) excluded; reduces flakiness | Visual regression | BrowserStack Percy / Keploy | BrowserStack | https://www.browserstack.com/percy/visual-regression-testing | Yes |
| V8 | Font-render / anti-aliasing tolerance | Robust to minor font/AA differences across platforms; still catches real changes | Visual regression | Applitools / Keploy | Applitools | https://applitools.com/blog/visual-regression-testing/ | Yes |
| V9 | Animation freezing / stabilization | Snapshots taken at stable state (animations paused, spinners gone, network idle) | Visual regression | BrowserStack Percy | BrowserStack | https://www.browserstack.com/percy/visual-regression-testing | Yes |
| V10 | Visual AI / perceptual comparison | Human-perceptible diffs via computer vision rather than strict pixel diff | Visual regression | Applitools Eyes | Applitools | https://applitools.com/blog/visual-regression-testing/ | Yes |
| V11 | Git-integrated snapshots in CI | PR changes don't introduce regressions; cloud diffs per commit with review workflow | Visual regression | BrowserStack Percy / Sauce Labs | BrowserStack | https://www.browserstack.com/percy/visual-regression-testing | Yes |
| V12 | Playwright `toHaveScreenshot` | Page/locator screenshots match stored snapshots (thresholds/regions) | Visual regression | Playwright Visual comparisons | Playwright | https://playwright.dev/docs/test-snapshots | Yes |
| V13 | Cypress visual testing (Percy/Applitools) | Cypress pages/components look correct via snapshot integrations | Visual regression | Cypress Visual Testing | Cypress | https://docs.cypress.io/guides/tooling/visual-testing | Yes |

### Cross-browser / cross-device compatibility

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable? |
|---|---|---|---|---|---|---|---|
| X1 | Browser test matrix (Chrome/Firefox/Safari·WebKit/Edge) | App functions/renders correctly across representative browsers & engines | Compatibility | ISTQB compatibility / BrowserStack | ISTQB / BrowserStack | https://www.browserstack.com/guide/browser-compatibility-testing | Yes |
| X2 | Mobile browser coverage (iOS Safari, Chrome Android) | Correct behavior/render in mobile browsers incl. touch & viewport handling | Compatibility | BrowserStack / Sauce Labs | BrowserStack | https://www.browserstack.com/guide/mobile-browser-compatibility-testing | Yes |
| X3 | Feature detection vs browser sniffing | App adapts on actual feature support, not unreliable UA checks | Compatibility | MDN / web.dev | MDN | https://developer.mozilla.org/en-US/docs/Web/HTTP/Browser_detection_using_the_user_agent | Yes |
| X4 | CSS feature support analysis (caniuse) | Chosen CSS features supported in targets; fallbacks/progressive enhancement where not | Compatibility | Can I use / MDN | caniuse | https://caniuse.com/ | Partial |
| X5 | JS API support & polyfill verification | Required JS APIs (fetch/Promise/IntersectionObserver) supported or polyfilled | Compatibility | Can I use / MDN | caniuse / MDN | https://caniuse.com/ | Partial |
| X6 | Rendering-engine differences (Blink/Gecko/WebKit) | Layout/CSS/paint acceptable across engines; engine-specific quirks caught | Compatibility | MDN / web.dev | MDN | https://developer.mozilla.org/en-US/docs/Glossary/Layout_engine | Yes |
| X7 | Graceful degradation | App still works in reduced form when newer features unavailable | Compatibility | MDN | MDN | https://developer.mozilla.org/en-US/docs/Glossary/Graceful_degradation | Partial |
| X8 | Progressive enhancement | Core experience works on basic tech; enhancements layered when supported | Compatibility | MDN / web.dev | MDN | https://developer.mozilla.org/en-US/docs/Glossary/Progressive_enhancement | Partial |
| X9 | Device emulation | UI correct in simulated device conditions (viewport/DPR/UA) for early responsive checks | Compatibility | Chrome DevTools / Playwright | Chrome / Playwright | https://playwright.dev/docs/emulation | Yes |
| X10 | Real-device testing (device cloud) | App works on actual devices/browsers (real GPU/touch/OS behavior) | Compatibility | BrowserStack / Sauce Labs | BrowserStack | https://www.browserstack.com/real-device-cloud | Partial |
| X11 | Cross-browser cloud grid in CI | App renders/behaves across browser/version/OS/device matrix automatically | Compatibility | BrowserStack / Sauce Labs | BrowserStack | https://www.browserstack.com/cross-browser-testing | Yes |
| X12 | Compatibility testing (ISTQB) | System meets compatibility reqs across browsers/OS/hardware/network; interoperability + co-existence | Compatibility | ISTQB Glossary (compatibility testing) | ISTQB | https://www.istqb.org/ | Partial |

---

## Incomplete passes
None. All 10 planned Perplexity passes completed (passes 08-10 were initially
blocked by a full disk and have since been run; see Parts G, H, I). No documented
gaps remain.

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
- `raw/functional-08.json` — UI states & page behavior (NN/g, web.dev, MDN, WCAG, WAI-ARIA APG)
- `raw/functional-09.json` — Navigation/link + responsive/cross-device (WCAG 2.1/2.2, Section 508, Apple HIG, USWDS)
- `raw/functional-10.json` — Visual-regression + cross-browser/device (Playwright, Cypress, Applitools, Chromatic, BrowserStack/Percy, Sauce Labs, MDN, caniuse, ISTQB)
