# LaunchAudit — Master Test Catalog

Goal: the most exhaustive, **fully sourced** catalog of tests a web-application
launch-readiness auditor could run — across security, accessibility, performance,
SEO, functional, infrastructure, reliability, privacy/compliance, mobile, and AI/voice.
Every entry traces to a real published source. Nothing invented.

## Method (provenance-first)

- **Research engine:** Rob's Perplexity (`sonar-pro`) via the API. Chosen because it
  returns citations with every answer.
- **Audit trail:** every raw Perplexity response is saved under `raw/`. Any catalog
  claim can be traced back to the JSON it came from.
- **Provenance law:** a test only enters the main table if it maps to a canonical
  source + (where one exists) a standard reference. Unsourced assertions are
  quarantined under "Unverified" / "[MODEL-SUGGESTED]" so Rob can see exactly what is
  not yet backed by a standard. See `RESEARCH-PROTOCOL.md` for the full rules.

## Files

- `00-SOURCES.md` — the master list of places we research from (canonical sources by domain).
- `RESEARCH-PROTOCOL.md` — the rules every researcher follows.
- `raw/` — raw Perplexity JSON (the evidence trail).

## Domain catalogs

| # | Domain | File | Anchor sources |
|---|---|---|---|
| 01 | Web application security | `01-web-security.md` | OWASP WSTG, Top 10, ASVS, MITRE CWE, PortSwigger |
| 02 | API security & authorization | `02-api-security-authz.md` | OWASP API Top 10, API Security Testing Guide, BOLA/IDOR/BFLA |
| 03 | Accessibility | `03-accessibility.md` | WCAG 2.1/2.2, WAI-ARIA APG, axe-core, Section 508 |
| 04 | Performance & Core Web Vitals | `04-performance-web-vitals.md` | Lighthouse, web.dev CWV, CrUX, RAIL |
| 05 | SEO & structured data | `05-seo-structured-data.md` | Google Search Central, Schema.org, Open Graph |
| 06 | Functional / UI / E2E + taxonomy | `06-functional-ui-e2e.md` | ISTQB, Testing Library, Playwright/Cypress, WPT |
| 07 | HTTP / TLS / security headers | `07-http-tls-headers.md` | OWASP Secure Headers, Mozilla Observatory, CSP, TLS |
| 08 | Reliability + privacy/compliance | `08-reliability-privacy-compliance.md` | k6/Chaos, GDPR, PCI-DSS |
| 09 | Mobile + AI/voice agents | `09-mobile-ai-voice.md` | OWASP MASVS/MASTG, OWASP LLM Top 10, ElevenLabs docs |

## Status — v2 complete (2026-06-17)

All 9 domain catalogs written by the research team, under the shared protocol, with
gap passes folded in. **~1,545 sourced test rows.** Evidence: 93 raw Perplexity JSON
files + WebFetch citations for the v3 gap passes. After the Perplexity API credit ran
out, the remaining gaps (ElevenLabs + garak, SEO rich-result types / X-Cards /
IndexNow, reliability & privacy commonly-missed) were closed with free WebSearch/
WebFetch. Only a couple of residuals stay honestly flagged (reliability log-volume
cost + cross-border SCC disclosure; one ElevenLabs item) — no source could be fetched.
Nothing invented.

- Per-domain counts, totals, remaining residuals, and the **LaunchAudit coverage-vs-
  catalog build list** are in **`ROLLUP.md`**.
- `CLAUDE.md` (repo root) points building agents here and explains how to turn catalog
  rows into detectors.
