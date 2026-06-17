# Test Catalog — Cross-Domain Roll-Up

Compiled by the orchestrator from the nine domain catalogs. Every count below is
backed by sourced rows in the linked file; raw Perplexity evidence is in `raw/`.

## Totals

- **~770–860 sourced tests** catalogued across 9 domains (count is approximate only
  because domains use different row-ID schemes; per-domain figures below).
- **57 raw Perplexity JSON files** saved as the audit trail (`raw/`).
- **Provenance:** every domain file's "Unverified" and "[MODEL-SUGGESTED]" sections
  are empty — nothing was added from model training knowledge. All rows carry a
  source name + URL and, where one exists, a standard reference.

| # | Domain | File | Sourced rows | Notable standard refs |
|---|---|---|---|---|
| 01 | Web security | `01-web-security.md` | ~83 | WSTG-*, OWASP Top 10, CWE |
| 02 | API security & authz | `02-api-security-authz.md` | 66 | OWASP API1/3/5:2023, WSTG-ATHZ, CWE-639/862/863 |
| 03 | Accessibility | `03-accessibility.md` | ~56+ | WCAG 2.2 SC, axe rule IDs |
| 04 | Performance / CWV | `04-performance-web-vitals.md` | ~57 | Lighthouse audit IDs, LCP/INP/CLS |
| 05 | SEO / structured data | `05-seo-structured-data.md` | ~131 | Lighthouse SEO audits, Search Central, Schema.org |
| 06 | Functional / UI / E2E | `06-functional-ui-e2e.md` | 89 | ISTQB techniques, Testing Library, Playwright, Cypress |
| 07 | HTTP / TLS / headers | `07-http-tls-headers.md` | 158 | OWASP Secure Headers, Mozilla Observatory, CSP, TLS |
| 08 | Reliability + privacy/compliance | `08-reliability-privacy-compliance.md` | 113 | k6/Chaos, GDPR, PCI-DSS |
| 09 | Mobile + AI/voice | `09-mobile-ai-voice.md` | 122 | OWASP MASVS/MASTG, OWASP LLM Top 10, ElevenLabs |

## Research gaps (honestly flagged — these passes did NOT run)

These were cut off by the disk-full event and are documented in their files. Re-run
when convenient (disk is healthy now):

- **API security (02):** API2 AuthN/JWT, API4/6 resource consumption & business
  flows, API7/8 SSRF & misconfig, CORS, schema/contract validation, ASVS
  access-control enumeration, completeness sweep (calls 05–07 never saved).
- **Functional (06):** UI-state, navigation/responsive (WCAG breakpoints/touch/
  reflow/zoom), visual-regression + cross-browser detail (passes 08–10).
- **Reliability (08):** frontend/infra reliability (TTFB, HTTP/2-3, compression,
  caching, CDN, page-weight budgets, health checks); PCI-DSS v4.0 SAQ-A line items;
  US state privacy laws beyond California; "commonly-missed" sweep (call 05 lost).
- Minor "commonly-missed" sweeps in a few other domains.

## LaunchAudit coverage vs. this catalog (the build list)

What the engine runs today, mapped against the catalogued universe:

| Domain | LaunchAudit today | Biggest unbuilt opportunities (from catalog) |
|---|---|---|
| Web security | Partial — security headers, secret/VCS exposure, malformed-input 4xx, RBAC anon-block | Injection (SQLi/XSS/cmd), session mgmt, business-logic, crypto-at-rest, file-upload |
| API security & authz | Partial — anon write-authz (BOLA-ish), privileged-route guards | **IDOR/object-id swaps across users**, BFLA, mass-assignment/BOPLA, JWT flaws, rate-limit, **denied-mutation-state-change** |
| Accessibility | Covered (axe serious/critical) | Manual WCAG SC (focus order, reflow, target size 2.5.8), full AA sweep |
| Performance / CWV | Partial — cold-load LCP/CLS/FCP/TTFB | Most Lighthouse opportunities (render-blocking, unused/​unminified JS-CSS, image formats, caching) |
| SEO / structured data | Covered (title, viewport, meta, canonical, OG, JSON-LD, noindex) | hreflang, sitemap/robots validation, Rich-Results eligibility per type |
| Functional / UI / E2E | Partial — render, responsive 390/768, console/5xx | Forms validation depth, navigation, empty/error/loading states, visual regression, cross-browser |
| HTTP / TLS / headers | Covered headers + secrets | TLS/cipher/HSTS-preload, cookie attrs (Secure/HttpOnly/SameSite), CORS misconfig, SRI |
| Reliability + privacy | **Not covered** | Load/stress/soak, chaos/resilience, GDPR cookie-consent, PCI-DSS scope, caching/CDN |
| Mobile + AI/voice | Partial — ElevenLabs agent config | Mobile (MASVS/MASTG) entirely; LLM prompt-injection/jailbreak/hallucination eval |

### Highest-leverage next builds (already on LaunchAudit's roadmap)
1. **IDOR / object-id swaps across user boundaries** + **denied-mutation-state-change**
   (the last pieces of the authorization wedge — catalog domain 02).
2. **Cookie security attributes + CORS misconfig + TLS checks** (domain 07 — cheap, high-signal).
3. **Lighthouse performance opportunities** beyond CWV (domain 04 — directly actionable fixes).

## How to extend

Re-run the gap passes per `RESEARCH-PROTOCOL.md` (Perplexity, save raw JSON, append
sourced rows). The catalog is additive — never delete a sourced row; mark superseded
ones. Keep the provenance law: no row without a real source.
