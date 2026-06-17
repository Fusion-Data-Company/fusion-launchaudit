# Master Source List — where every test in this catalog comes from

This is the authoritative list of **places we research tests from**. Every test in
the domain catalogs (`01`–`09`) must trace back to one of these. Researched via
Rob's Perplexity (`sonar-pro`); raw API responses are preserved under `raw/` as the
audit trail.

## How to read provenance (important)

Perplexity returns two things, and they are NOT equal:

1. **Canonical sources** — the named standards/specs/official docs in the answer body
   (OWASP, W3C, Google, NIST, IETF, Mozilla, Ecma). **These are what we trust and cite.**
2. **Retrieval citations** — the numbered `citations[]` array in the raw JSON (often
   blogs/aggregators Perplexity read to compose the answer). These are kept for the
   audit trail but are **not** treated as the source of a test.

A catalog row is only "sourced" if it maps to a canonical source URL + (where one
exists) a standard reference (e.g. `WSTG-ATHZ-01`, `WCAG 1.1.1`, `CWE-639`, a
Lighthouse audit id). Anything Perplexity asserts without a real source is quarantined
under "Unverified" / "[MODEL-SUGGESTED]" in each domain file.

Raw evidence for this page: `raw/00-sources.json`.

## Canonical sources by domain

### Web & API security
| Source | Org | Covers | URL |
|---|---|---|---|
| Web Security Testing Guide (WSTG) | OWASP | End-to-end web security test procedures (info gathering, config, auth, authz, session, input validation, error handling, crypto, business logic, client-side, API) | https://owasp.org/www-project-web-security-testing-guide/ |
| Application Security Verification Standard (ASVS) | OWASP | Security verification requirements/taxonomy by assurance level | https://owasp.org/www-project-application-security-verification-standard/ |
| OWASP Top 10 | OWASP | Top web app risk categories to structure security coverage | https://owasp.org/www-project-top-ten/ |
| OWASP API Security Top 10 | OWASP | API risks: BOLA/IDOR, broken auth, BFLA, resource consumption, etc. | https://owasp.org/www-project-api-security/ |
| OWASP API Security Testing Guide | OWASP | Practical API test procedures (authz, rate limit, schema validation, BOLA) | https://owasp.org/www-project-api-security-testing-guide/ |
| NIST SP 800-115 | NIST | Security testing & assessment methods (review, scanning, vuln testing, pentest) | https://csrc.nist.gov/publications/detail/sp/800-115/final |
| MITRE CWE | MITRE | Common Weakness Enumeration — weakness IDs behind security tests | https://cwe.mitre.org/ |

### Accessibility
| Source | Org | Covers | URL |
|---|---|---|---|
| WCAG 2.2 | W3C WAI | Accessibility conformance success criteria (A/AA/AAA) | https://www.w3.org/TR/WCAG22/ |
| WAI-ARIA Authoring Practices Guide (APG) | W3C WAI | Keyboard/focus/role-state behavior for interactive widgets | https://www.w3.org/WAI/ARIA/apg/ |
| ACT Rules Format | W3C | Machine-expressible accessibility test rules + expected outcomes | https://www.w3.org/WAI/standards-guidelines/act/rules-format/ |

### Performance
| Source | Org | Covers | URL |
|---|---|---|---|
| Chrome Lighthouse | Google | Automated perf/a11y/SEO/best-practices audits (audit ids) | https://developer.chrome.com/docs/lighthouse/overview/ |
| Core Web Vitals | Google | LCP / INP / CLS metrics + thresholds | https://web.dev/vitals/ |
| web.dev Performance | Google | Rendering/loading/responsiveness testing & measurement | https://web.dev/learn/performance/ |

### SEO / structured data
| Source | Org | Covers | URL |
|---|---|---|---|
| Google Search Central | Google | Crawl/index/canonical/metadata/sitemaps/robots/search appearance | https://developers.google.com/search/docs |
| Schema.org | Schema.org | Structured-data vocabulary + rich-result types | https://schema.org/ |
| Rich Results Test | Google | Structured-data / rich-result eligibility validation | https://search.google.com/test/rich-results |
| Search Console docs | Google | Index-coverage & discoverability diagnostics | https://support.google.com/webmasters/ |

### Functional / interoperability / JS
| Source | Org | Covers | URL |
|---|---|---|---|
| Web Platform Tests (WPT) | W3C/WHATWG/vendors | Cross-browser functional/interop suite (HTML/DOM/CSS/Web APIs) | https://web-platform-tests.org/ |
| Test262 | Ecma International | JavaScript (ECMAScript) conformance tests | https://github.com/tc39/test262 |
| WHATWG HTML Standard | WHATWG | Normative HTML behavior (spec tests derive from it) | https://html.spec.whatwg.org/ |

### HTTP / TLS / headers
| Source | Org | Covers | URL |
|---|---|---|---|
| OWASP Secure Headers Project | OWASP | Recommended security response headers + values | https://owasp.org/www-project-secure-headers/ |
| Mozilla Observatory | Mozilla | Practical security-header checklist + scoring | https://observatory.mozilla.org/ |
| MDN HTTP Headers | Mozilla | HTTP header semantics reference | https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers |
| HTTP Semantics (RFC 9110) | IETF | Canonical HTTP behavior driving header/response tests | https://www.rfc-editor.org/rfc/rfc9110 |

> Domain researchers extend this list with the additional canonical sources they
> confirm (ISTQB, PortSwigger Web Security Academy, k6/Chaos, OWASP MASVS/MASTG,
> OWASP Top 10 for LLM Apps, ElevenLabs docs, etc.). Each domain file lists the exact
> sources it used in its own "Sources used" section.
