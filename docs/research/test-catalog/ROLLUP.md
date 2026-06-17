# Test Catalog — Cross-Domain Roll-Up

Compiled by the orchestrator from the nine domain catalogs. Every count below is
backed by sourced rows in the linked file; raw Perplexity evidence is in `raw/`.

## Totals (v2 — gap passes folded in, 2026-06-17)

- **~1,485 sourced test rows** catalogued across 9 domains (counted across all nine
  files; per-domain figures below).
- **93 raw Perplexity JSON files** saved as the audit trail (`raw/`).
- **Provenance:** every domain file's "Unverified" section is empty. The ONLY
  flagged-unsourced rows are in domain 09 (ElevenLabs ConvAI config + garak probe
  taxonomy), left as `[MODEL-SUGGESTED]`/`[UNVERIFIED]` because the Perplexity quota
  was exhausted before those two could be sourced — honestly tagged, never faked.

| # | Domain | File | Sourced rows | Notable standard refs |
|---|---|---|---|---|
| 01 | Web security | `01-web-security.md` | 164 | WSTG v4.2 (incl. CLNT, APIT), OWASP Top 10:2021, ASVS 4.0.3, CWE |
| 02 | API security & authz | `02-api-security-authz.md` | 175 | OWASP API1–API10:2023, WSTG-ATHZ/ATHN, RFC 8725, CWE, ASVS V4 |
| 03 | Accessibility | `03-accessibility.md` | 93 | WCAG 2.2 A+AA SC, axe rule IDs, WAI-ARIA APG |
| 04 | Performance / CWV | `04-performance-web-vitals.md` | 111 | Lighthouse audit IDs, LCP/INP/CLS, web.dev |
| 05 | SEO / structured data | `05-seo-structured-data.md` | 229 | Lighthouse SEO, Search Central, Schema.org, OGP, sitemaps.org |
| 06 | Functional / UI / E2E | `06-functional-ui-e2e.md` | 167 | ISTQB, Testing Library, Playwright, Cypress, WCAG, Apple HIG |
| 07 | HTTP / TLS / headers | `07-http-tls-headers.md` | 158 | OWASP Secure Headers, Mozilla Observatory, CSP, TLS RFCs |
| 08 | Reliability + privacy/compliance | `08-reliability-privacy-compliance.md` | 208 | k6/Chaos, web.dev, PCI-DSS v4.0.1, GDPR/CCPA/4 state laws, EDPB |
| 09 | Mobile + AI/voice | `09-mobile-ai-voice.md` | 147 | OWASP MASVS/MASTG, OWASP LLM Top 10, MITRE ATLAS, NIST AI RMF, ITU-T |

## Research gaps remaining (after the v2 gap passes)

Most v1 gaps are now CLOSED (API2-API10, CORS, schema validation, full WSTG
CLNT/APIT, ASVS, infra reliability, PCI SAQ-A line items, 4-state privacy laws,
cookie-consent, UI states, visual-regression, full WCAG 2.2 A+AA). What remains is
narrow and blocked by the **Perplexity quota running out mid-run** (top up at
perplexity.ai/settings/api, then re-run these):

- **Mobile/AI (09):** ElevenLabs ConvAI config checks ([MODEL-SUGGESTED]) and the
  garak LLM-scanner probe taxonomy ([UNVERIFIED]) — never sourced; one round closes both.
- **Reliability (08):** the "commonly-missed" sweep (cold-start, conn-pool exhaustion,
  N+1, clock drift, SIGTERM draining, queue backpressure, DNS TTL, cert-expiry; DSR
  SLA timers, IAB TCF, COPPA, breach-notification, session-replay masking).
- **SEO (05):** first-party X-Cards image-constraint confirmation; JobPosting/Dataset/
  Course rich-result types; Bing/IndexNow for multi-engine coverage.
- **Web security (01):** PortSwigger lab-level checks per topic (topic-level done);
  WSTG-ATHN-11 MFA URL stays slug-inferred (a /latest/-only test).

No row was faked to paper over a gap; each is documented in its file with the cause.

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
