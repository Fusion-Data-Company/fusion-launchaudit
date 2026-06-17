# HTTP Security Headers, TLS/HTTPS & Infrastructure — Test Catalog

Domain: HTTP security response headers, TLS/HTTPS configuration, cookie security,
CORS, and web infrastructure / deployment configuration testing for a web-application
launch-readiness auditor. Every row below traces to a real, named source surfaced by
Perplexity (`sonar-pro`) and its citations. Raw retrieval JSON is in `raw/infra-01.json`
… `raw/infra-08.json`.

Automatable column legend: **Yes** = a launch-time scanner can determine pass/fail by
sending HTTP(S) requests / inspecting headers, certs, or DNS; **Partial** = detectable
but needs active probing or heuristics that may produce false positives; **Manual** =
requires code review, business-logic knowledge, or human judgment.

## Sources used

| Source | Org | Covers | URL |
|---|---|---|---|
| OWASP Secure Headers Project (OSHP) | OWASP | Catalog of security HTTP response headers + recommended values | https://owasp.org/www-project-secure-headers/ |
| OWASP HTTP Headers Cheat Sheet | OWASP Cheat Sheet Series | Per-header recommended config, removal of fingerprinting headers, cookie attrs | https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html |
| OWASP CSP Cheat Sheet | OWASP Cheat Sheet Series | CSP directive guidance, reporting directives | https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html |
| Mozilla HTTP Observatory — Tests & Scoring | Mozilla / MDN | Automated header + config scan tests and score modifiers | https://developer.mozilla.org/en-US/observatory/docs/tests_and_scoring |
| W3C Content Security Policy Level 3 | W3C WebAppSec WG | Normative CSP directive set & semantics | https://www.w3.org/TR/CSP3/ |
| MDN — Content Security Policy | Mozilla / MDN | Browser-facing CSP directive reference | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP |
| Qualys SSL Labs — SSL Server Rating Guide | Qualys SSL Labs | TLS protocol/cipher/cert scoring methodology | https://www.ssllabs.com/projects/rating-guide/index.html |
| SSL Labs Rating Guide (wiki) | Qualys SSL Labs | Detailed grading rules & vuln tests | https://github.com/ssllabs/research/wiki/SSL-Server-Rating-Guide |
| Mozilla Server Side TLS | Mozilla | Recommended TLS protocols, ciphers, key sizes | https://wiki.mozilla.org/Security/Server_Side_TLS |
| Mozilla SSL Configuration Generator | Mozilla | Modern/Intermediate/Old TLS config profiles | https://ssl-config.mozilla.org/ |
| RFC 6265bis (draft-22) — Cookies | IETF HTTP WG | Cookie syntax + Secure/HttpOnly/SameSite/prefixes | https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22 |
| OWASP WSTG — Testing for Cookies Attributes (WSTG-SESS-02) | OWASP | Cookie attribute test methodology | https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/02-Testing_for_Cookies_Attributes |
| WHATWG Fetch Standard (CORS) | WHATWG | Normative CORS algorithm & headers | https://fetch.spec.whatwg.org/ |
| MDN — CORS | Mozilla / MDN | CORS header reference & misconfig warnings | https://developer.mozilla.org/docs/Web/HTTP/CORS |
| OWASP WSTG — Configuration & Deployment Management (WSTG-CONF-01..12) | OWASP | Infra/platform/file/admin/HSTS/CSP/cloud tests | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/README |
| OWASP WSTG — Information Gathering (WSTG-INFO-01..10) | OWASP | Fingerprinting, metafiles, sensitive-file exposure | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/01-Information_Gathering/ |
| W3C Subresource Integrity (SRI) | W3C | integrity/crossorigin attribute verification | https://www.w3.org/TR/sri-2/ |
| MDN — Subresource Integrity | Mozilla / MDN | SRI practical reference | https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Subresource_Integrity |
| RFC 7034 — X-Frame-Options | IETF | Clickjacking header semantics | https://www.rfc-editor.org/rfc/rfc7034 |
| W3C Mixed Content | W3C | Active/passive mixed content + upgrade-insecure-requests | https://www.w3.org/TR/mixed-content/ |
| RFC 9116 — security.txt | IETF | .well-known/security.txt format | https://www.rfc-editor.org/rfc/rfc9116 |
| RFC 8659 — DNS CAA | IETF | Certification Authority Authorization records | https://www.rfc-editor.org/rfc/rfc8659 |
| RFC 9162 — Certificate Transparency v2 | IETF | CT / SCT verification | https://www.rfc-editor.org/rfc/rfc9162 |
| RFC 4033/4034/4035 — DNSSEC | IETF | DNSSEC signing & chain of trust | https://www.rfc-editor.org/rfc/rfc4033 |
| RFC 7208 — SPF | IETF | Email sender authorization DNS record | https://www.rfc-editor.org/rfc/rfc7208 |
| RFC 6376 — DKIM | IETF | DomainKeys Identified Mail signatures | https://www.rfc-editor.org/rfc/rfc6376 |
| RFC 7489 — DMARC | IETF | Mail auth reporting & conformance | https://www.rfc-editor.org/rfc/rfc7489 |
| RFC 9110 — HTTP Semantics | IETF | HTTP methods (GET/PUT/DELETE/TRACE/OPTIONS) | https://www.rfc-editor.org/rfc/rfc9110 |
| RFC 9111 — HTTP Caching | IETF | Cache semantics / cache-key reasoning | https://www.rfc-editor.org/rfc/rfc9111 |
| CWE-444 — HTTP Request Smuggling | MITRE | Request/response desync classification | https://cwe.mitre.org/data/definitions/444.html |
| CWE-113 — CRLF / HTTP Response Splitting | MITRE | Header injection classification | https://cwe.mitre.org/data/definitions/113.html |
| CWE-601 — Open Redirect | MITRE | URL redirect to untrusted site | https://cwe.mitre.org/data/definitions/601.html |
| CWE-74 — Injection (Host header) | MITRE | Host header injection classification | https://cwe.mitre.org/data/definitions/74.html |
| RFC 8446 — TLS 1.3 | IETF | Cipher negotiation, 0-RTT early data | https://www.rfc-editor.org/rfc/rfc8446 |
| RFC 8470 — Using Early Data in HTTP | IETF | 0-RTT replay handling | https://www.rfc-editor.org/rfc/rfc8470 |
| RFC 6797 — HSTS | IETF | HSTS incl. includeSubDomains | https://www.rfc-editor.org/rfc/rfc6797 |
| RFC 6125 — Cert Identity Verification | IETF | SAN/hostname coverage | https://www.rfc-editor.org/rfc/rfc6125 |
| CA/Browser Forum Baseline Requirements | CA/B Forum | Cert issuance / SAN scope rules | https://cabforum.org/baseline-requirements-documents/ |
| RFC 8200 — IPv6 | IETF | IPv6 protocol / dual-stack parity | https://www.rfc-editor.org/rfc/rfc8200 |
| RFC 7540 — HTTP/2 | IETF | HTTP/2 availability & negotiation | https://www.rfc-editor.org/rfc/rfc7540 |
| RFC 9114 — HTTP/3 | IETF | HTTP/3 availability | https://www.rfc-editor.org/rfc/rfc9114 |
| RFC 9000 — QUIC | IETF | QUIC transport for HTTP/3 | https://www.rfc-editor.org/rfc/rfc9000 |
| W3C Reporting API | W3C | Reporting-Endpoints / Report-To config | https://www.w3.org/TR/reporting-1/ |
| W3C Network Error Logging (NEL) | W3C | NEL header config | https://www.w3.org/TR/network-error-logging/ |
| MDN — Cross-Origin Isolation (COOP+COEP) | Mozilla / MDN | SharedArrayBuffer isolation requirements | https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated |
| OWASP — Web Cache Poisoning | OWASP | Unkeyed-header cache poisoning testing | https://owasp.org/www-community/attacks/Cache_Poisoning |
| securityheaders.com | Scott Helme | Automated header scanner / scoring reference | https://securityheaders.com |

## Tests

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable by LaunchAudit? |
|---|---|---|---|---|---|---|---|
| 1 | `Strict-Transport-Security` present | HSTS header forces HTTPS; recommended `max-age=63072000; includeSubDomains; preload` | Security Headers | OSHP / WSTG-CONF-07 / CWE-319 | OWASP HTTP Headers Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html | Yes |
| 2 | HSTS `max-age` long enough | `max-age` is not too short (≥ ~6 months; ≥31536000 for preload) | Security Headers | OWASP Cheat Sheet | OWASP HTTP Headers Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html | Yes |
| 3 | HSTS `includeSubDomains` set | Subdomains also forced to HTTPS (only after all subdomains are HTTPS-ready) | Security Headers | OWASP Cheat Sheet | OWASP HTTP Headers Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html | Yes |
| 4 | HSTS `preload` directive | Eligible for browser HSTS preload list | Security Headers | OWASP Cheat Sheet | OWASP HTTP Headers Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html | Yes |
| 5 | HSTS not sent only over HTTP | HSTS must be delivered over HTTPS to take effect | Security Headers | OWASP Cheat Sheet | OWASP HTTP Headers Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html | Yes |
| 6 | `Content-Security-Policy` present | CSP header restricts resource origins; mitigates XSS / injection | Security Headers | OSHP / WSTG-CONF-12 / CWE-79 | OWASP HTTP Headers Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html | Yes |
| 7 | `X-Frame-Options` set to `DENY`/`SAMEORIGIN` | Prevents clickjacking by blocking framing | Security Headers | OSHP / RFC 7034 | OWASP HTTP Headers Cheat Sheet | https://www.rfc-editor.org/rfc/rfc7034 | Yes |
| 8 | `X-Content-Type-Options: nosniff` | Prevents MIME sniffing / content-type confusion | Security Headers | OSHP | OWASP HTTP Headers Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html | Yes |
| 9 | `Referrer-Policy` set (e.g. `strict-origin-when-cross-origin`) | Limits Referer URL leakage; flag `unsafe-url` | Security Headers | OSHP | OWASP HTTP Headers Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html | Yes |
| 10 | `Permissions-Policy` present & restrictive | Disables unneeded powerful features (camera, geolocation, etc.) | Security Headers | OSHP (working draft) | OWASP Secure Headers Project | https://owasp.org/www-project-secure-headers/ | Yes |
| 11 | `Cross-Origin-Opener-Policy: same-origin` | Isolates browsing context; flag `unsafe-none` | Security Headers | OSHP | OWASP HTTP Headers Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html | Yes |
| 12 | `Cross-Origin-Embedder-Policy` set | Enforces cross-origin isolation with COOP | Security Headers | OSHP | OWASP Secure Headers Project | https://owasp.org/www-project-secure-headers/ | Yes |
| 13 | `Cross-Origin-Resource-Policy: same-site` | Limits which sites can load a resource | Security Headers | OSHP | OWASP HTTP Headers Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html | Yes |
| 14 | `Cache-Control: no-store` on sensitive responses | Prevents caching of sensitive data; flag missing on auth pages | Security Headers | OSHP | OWASP HTTP Headers Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html | Partial |
| 15 | `Clear-Site-Data` on logout | Clears browser state on logout / incident response | Security Headers | OSHP | OWASP Secure Headers Project | https://owasp.org/www-project-secure-headers/ | Manual |
| 16 | `X-Permitted-Cross-Domain-Policies` restrictive | Prevents Adobe cross-domain policy abuse | Security Headers | OSHP | OWASP Secure Headers Project | https://owasp.org/www-project-secure-headers/ | Yes |
| 17 | `X-DNS-Prefetch-Control` set | Controls DNS prefetching behavior | Security Headers | OSHP (active header list) | OWASP Secure Headers Project | https://owasp.org/www-project-secure-headers/ | Yes |
| 18 | `X-XSS-Protection: 0` (legacy) | OWASP recommends disabling deprecated XSS filter; flag `1; mode=block` | Security Headers (deprecated) | OWASP Cheat Sheet | OWASP HTTP Headers Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html | Yes |
| 19 | `Server` header minimized/removed | Reduces server software/version fingerprinting | Fingerprinting / WSTG-INFO-02 | OWASP Cheat Sheet / CWE-200 | OWASP HTTP Headers Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html | Yes |
| 20 | `X-Powered-By` removed | Hides framework/runtime details | Fingerprinting | OWASP Cheat Sheet | OWASP HTTP Headers Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html | Yes |
| 21 | `X-AspNet-Version` / `X-AspNetMvc-Version` removed | Reduces ASP.NET version disclosure | Fingerprinting | OWASP Cheat Sheet | OWASP HTTP Headers Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html | Yes |
| 22 | Security headers present on error pages & redirects | Headers must apply to 3xx/4xx/5xx responses, not just 200 | Security Headers | Mozilla Observatory | MDN HTTP Observatory | https://developer.mozilla.org/en-US/observatory/docs/tests_and_scoring | Partial |
| 23 | CSP: no `unsafe-inline` in `script-src`/`style-src` | Inline execution disabled (major XSS enabler) | CSP | W3C CSP3 / MDN | MDN CSP | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP | Yes |
| 24 | CSP: no `unsafe-eval` in `script-src` | Dynamic code eval (`eval()`) blocked | CSP | W3C CSP3 / MDN | MDN CSP | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP | Yes |
| 25 | CSP: no wildcard `*` in fetch directives | No overly broad source allowlists | CSP | W3C CSP3 | W3C CSP Level 3 | https://www.w3.org/TR/CSP3/ | Yes |
| 26 | CSP: `default-src` present | Fallback source list defined (not omitted) | CSP — fetch | W3C CSP3 / MDN | MDN CSP | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP | Yes |
| 27 | CSP: `script-src` uses nonce/hash for inline | Strict script policy with nonce or hash | CSP — fetch | W3C CSP3 / OWASP CSP Cheat Sheet | OWASP CSP Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html | Partial |
| 28 | CSP: no `data:`/`blob:` for script/style | Avoid high-risk schemes in script/style sources | CSP — fetch | W3C CSP3 / MDN | MDN CSP | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP | Yes |
| 29 | CSP: `style-src` restricted | No inline styles without nonce/hash; no broad CSS hosts | CSP — fetch | W3C CSP3 / MDN | MDN CSP | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP | Yes |
| 30 | CSP: `img-src` restricted | No wildcard/`data:` images where unneeded | CSP — fetch | W3C CSP3 / MDN | MDN CSP | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP | Yes |
| 31 | CSP: `connect-src` restricted | No wildcard fetch/XHR/WebSocket/EventSource endpoints | CSP — fetch | W3C CSP3 / MDN | MDN CSP | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP | Yes |
| 32 | CSP: `font-src` restricted | No wildcard/`data:` font sources | CSP — fetch | W3C CSP3 / MDN | MDN CSP | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP | Yes |
| 33 | CSP: `object-src 'none'` | Plugins/embedded objects blocked | CSP — fetch | W3C CSP3 / OWASP CSP Cheat Sheet | OWASP CSP Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html | Yes |
| 34 | CSP: `media-src` restricted | No wildcard audio/video sources | CSP — fetch | W3C CSP3 / MDN | MDN CSP | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP | Yes |
| 35 | CSP: `frame-src` restricted | No overly broad iframe sources | CSP — fetch | W3C CSP3 / MDN | MDN CSP | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP | Yes |
| 36 | CSP: `worker-src` restricted | Workers/service-workers not loadable from arbitrary origins | CSP — fetch | W3C CSP3 / MDN | MDN CSP | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP | Yes |
| 37 | CSP: `manifest-src` restricted | Web app manifest sources constrained | CSP — fetch | W3C CSP3 / MDN | MDN CSP | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP | Yes |
| 38 | CSP: prefer `frame-src`/`worker-src` over legacy `child-src` | Use precise modern directives | CSP — fetch | W3C CSP3 / MDN | MDN CSP | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP | Yes |
| 39 | CSP: `prefetch-src` restricted | Speculative fetch targets constrained | CSP — fetch | W3C CSP3 / MDN | MDN CSP | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP | Yes |
| 40 | CSP: `base-uri` present | Restricts `<base>` element; prevents base-tag URL rewrite | CSP — document | W3C CSP3 / MDN | MDN CSP | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP | Yes |
| 41 | CSP: `sandbox` where isolation needed | Confined execution; flag `allow-scripts`+`allow-same-origin` combo | CSP — document | W3C CSP3 | W3C CSP Level 3 | https://www.w3.org/TR/CSP3/ | Partial |
| 42 | CSP: `form-action` restricted | Forms can only submit to trusted origins | CSP — navigation | W3C CSP3 / MDN | MDN CSP | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP | Yes |
| 43 | CSP: `frame-ancestors` set | Anti-clickjacking; restricts who can frame the page | CSP — navigation | W3C CSP3 / MDN | MDN CSP | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP | Yes |
| 44 | CSP: `navigate-to` restricted | Limits navigation destinations (open-redirect style) | CSP — navigation | W3C CSP3 | W3C CSP Level 3 | https://www.w3.org/TR/CSP3/ | Yes |
| 45 | CSP: `report-uri`/`report-to` over HTTPS | Violation reports to TLS, trusted collector | CSP — reporting | W3C CSP3 / OWASP CSP Cheat Sheet | OWASP CSP Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html | Yes |
| 46 | CSP: `upgrade-insecure-requests` on HTTPS migration | Auto-upgrades HTTP subresources to HTTPS | CSP — other | W3C CSP3 / MDN | MDN CSP | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP | Yes |
| 47 | CSP: `block-all-mixed-content` (legacy) | Blocks mixed content on HTTPS pages | CSP — other | W3C CSP3 / MDN | MDN CSP | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP | Yes |
| 48 | CSP: `require-trusted-types-for 'script'` | Requires Trusted Types for DOM-XSS-prone sinks | CSP — other | MDN CSP | MDN CSP | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP | Yes |
| 49 | CSP: `trusted-types` policy governance | Restricts which Trusted Types policies may be created | CSP — other | MDN CSP | MDN CSP | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP | Partial |
| 50 | CSP: applied on all responses, not report-only only | Policy must be enforced, not just `Content-Security-Policy-Report-Only` | CSP | W3C CSP3 / OWASP CSP Cheat Sheet | OWASP CSP Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html | Yes |
| 51 | SSLv2 disabled | SSL 2.0 fundamentally broken; must be off | TLS — protocol | SSL Labs Rating Guide / Mozilla SSTLS | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 52 | SSLv3 disabled | POODLE; SSL 3.0 must be off | TLS — protocol | SSL Labs Rating Guide / Mozilla SSTLS | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 53 | TLS 1.0 disabled | Legacy; BEAST/CBC; disable on public sites | TLS — protocol | SSL Labs Rating Guide / Mozilla SSTLS | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 54 | TLS 1.1 disabled | Deprecated; recommend TLS 1.2/1.3 only | TLS — protocol | SSL Labs Rating Guide / Mozilla SSTLS | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 55 | TLS 1.2 supported | Baseline modern protocol; absence lowers grade | TLS — protocol | SSL Labs Rating Guide / Mozilla SSTLS | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 56 | TLS 1.3 supported | Lack of TLS 1.3 caps SSL Labs grade at A- | TLS — protocol | SSL Labs grading changes 2025 | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 57 | Strong cipher strength (≥128-bit, prefer ≥256) | No <128-bit/NULL ciphers; bit-strength scored | TLS — cipher | SSL Labs Rating Guide | SSL Labs Rating Guide | https://github.com/ssllabs/research/wiki/SSL-Server-Rating-Guide | Yes |
| 58 | Forward secrecy (ECDHE/DHE) | Ephemeral key exchange present & preferred | TLS — cipher | SSL Labs Rating Guide / Mozilla SSTLS | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 59 | RC4 ciphers disabled | RC4 biased/broken; must be off | TLS — cipher | SSL Labs Rating Guide / Mozilla SSTLS | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 60 | 3DES disabled (SWEET32) | Weak 112-bit / block-size attack | TLS — cipher | SSL Labs Rating Guide / Mozilla SSTLS | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 61 | NULL/EXPORT/anonymous ciphers disabled | No-encryption, export-grade, or no-auth suites off | TLS — cipher | SSL Labs Rating Guide | SSL Labs Rating Guide | https://github.com/ssllabs/research/wiki/SSL-Server-Rating-Guide | Yes |
| 62 | DH parameters ≥2048-bit (Logjam) | Weak finite-field DHE rejected | TLS — key exchange | SSL Labs Rating Guide / Mozilla SSTLS | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 63 | Strong key exchange (no export RSA / 512-bit DH) | Key-exchange strength scored (30% of grade) | TLS — key exchange | SSL Labs Rating Guide | SSL Labs Rating Guide | https://github.com/ssllabs/research/wiki/SSL-Server-Rating-Guide | Yes |
| 64 | Certificate key size ≥2048-bit RSA / strong ECDSA | Undersized keys → F grade | TLS — certificate | SSL Labs Rating Guide / Mozilla SSTLS | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 65 | Certificate signature alg SHA-256+ (no SHA1/MD5/MD2) | Weak signature alg → 0 score | TLS — certificate | SSL Labs Rating Guide / Mozilla SSTLS | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 66 | Certificate not expired / not-yet-valid | Validity window correct → otherwise 0 score | TLS — certificate | SSL Labs Rating Guide | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 67 | Certificate validity period within CA/B limits | Overly long lifetimes deprecated (≤398 days) | TLS — certificate | SSL Labs Rating Guide / Mozilla | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 68 | Certificate chain complete & ordered | Missing intermediates → trust failure / T grade | TLS — certificate | SSL Labs Rating Guide | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 69 | Certificate trusted (CA in root store) | Untrusted/self-signed → T grade / 0 score | TLS — certificate | SSL Labs Rating Guide / Mozilla CA | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 70 | Certificate CN/SAN matches hostname | Name mismatch → M grade / 0 score | TLS — certificate | SSL Labs Rating Guide | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 71 | Certificate not revoked (CRL/OCSP) | Revoked cert → 0 score | TLS — revocation | SSL Labs Rating Guide | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 72 | OCSP stapling enabled | Improves revocation visibility & privacy | TLS — revocation | SSL Labs Rating Guide / Mozilla SSTLS | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 73 | OCSP Must-Staple honored | If cert has Must-Staple, server must staple | TLS — revocation | SSL Labs Rating Guide | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 74 | Insecure renegotiation disabled | RFC 5746 secure renegotiation only | TLS — renegotiation | SSL Labs Rating Guide / Mozilla SSTLS | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 75 | TLS compression disabled (CRIME) | TLS-level compression off | TLS — vulnerability | SSL Labs Rating Guide / Mozilla SSTLS | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 76 | Not vulnerable to BEAST | TLS 1.2+/AEAD instead of TLS 1.0 CBC + RC4 | TLS — vulnerability | SSL Labs Rating Guide / Mozilla SSTLS | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 77 | Not vulnerable to POODLE | No SSLv3; CBC padding-oracle patched | TLS — vulnerability | SSL Labs Rating Guide | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 78 | Not vulnerable to Heartbleed | OpenSSL heartbeat bug → F grade | TLS — vulnerability | SSL Labs Rating Guide | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 79 | Not vulnerable to ROBOT | Bleichenbacher RSA padding-oracle test | TLS — vulnerability | SSL Labs Rating Guide | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 80 | Downgrade protection (TLS_FALLBACK_SCSV / TLS 1.3) | Resists protocol downgrade attacks | TLS — vulnerability | SSL Labs grading changes 2025 | SSL Labs Rating Guide | https://www.ssllabs.com/projects/rating-guide/index.html | Yes |
| 81 | HTTP→HTTPS redirect | Plain HTTP redirects to HTTPS (301/302/307) | Transport / Mozilla Observatory | SSL Labs / Mozilla Observatory | MDN HTTP Observatory | https://developer.mozilla.org/en-US/observatory/docs/tests_and_scoring | Yes |
| 82 | No mixed content (active) | HTTPS page loads no HTTP scripts/iframes/XHR/WS | Transport / Mixed Content | W3C Mixed Content | W3C Mixed Content | https://www.w3.org/TR/mixed-content/ | Partial |
| 83 | No mixed content (passive) | HTTPS page avoids HTTP images/media where possible | Transport / Mixed Content | W3C Mixed Content | W3C Mixed Content | https://www.w3.org/TR/mixed-content/ | Partial |
| 84 | Sensitive cookies have `Secure` | Cookies only sent over HTTPS | Cookies | RFC 6265bis §4.1.2.5 / WSTG-SESS-02 / CWE-614 | OWASP WSTG-SESS-02 | https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/02-Testing_for_Cookies_Attributes | Yes |
| 85 | Session/auth cookies have `HttpOnly` | Not readable via JavaScript (XSS theft) | Cookies | RFC 6265bis §4.1.2.6 / WSTG-SESS-02 / CWE-1004 | OWASP WSTG-SESS-02 | https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/02-Testing_for_Cookies_Attributes | Yes |
| 86 | Cookies have explicit `SameSite` | Strict/Lax/None set; mitigates CSRF | Cookies | RFC 6265bis §4.1.2.7 / WSTG-SESS-02 / CWE-352 | RFC 6265bis | https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22 | Yes |
| 87 | `SameSite=None` always has `Secure` | None requires Secure or browsers reject | Cookies | RFC 6265bis / MDN / CWE-614 | RFC 6265bis | https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22 | Yes |
| 88 | CSRF-sensitive cookies use Strict/Lax | State-changing endpoints protected | Cookies | RFC 6265bis §4.1.2.7 / WSTG-SESS-02 / CWE-352 | OWASP WSTG-SESS-02 | https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/02-Testing_for_Cookies_Attributes | Manual |
| 89 | `__Host-` prefix used correctly | Secure + HTTPS origin + no Domain + Path=/ | Cookies | RFC 6265bis §4.1.3.2 / WSTG-SESS-02 | RFC 6265bis | https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22 | Yes |
| 90 | `__Secure-` prefix used correctly | Secure attribute + HTTPS origin | Cookies | RFC 6265bis §4.1.3.1 / WSTG-SESS-02 | RFC 6265bis | https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22 | Yes |
| 91 | Cookie `Domain` not overly broad | Avoid parent-domain scoping when host-only suffices | Cookies | RFC 6265bis §5.3 / WSTG-SESS-02 / CWE-565 | OWASP WSTG-SESS-02 | https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/02-Testing_for_Cookies_Attributes | Partial |
| 92 | Cookie `Path` not overly broad | Avoid `Path=/` when narrower path suffices | Cookies | RFC 6265bis §5.3 / WSTG-SESS-02 / CWE-16 | OWASP WSTG-SESS-02 | https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/02-Testing_for_Cookies_Attributes | Partial |
| 93 | Auth cookie lifetime not excessive | Short `Max-Age`/`Expires` on session/auth cookies | Cookies | RFC 6265bis §4.1.2.1-2 / WSTG-SESS-02 / CWE-613 | OWASP WSTG-SESS-02 | https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/02-Testing_for_Cookies_Attributes | Partial |
| 94 | Cookie size ≤4096 bytes | Oversized cookies silently dropped by UA | Cookies | RFC 6265bis §5.3 / CWE-697 | RFC 6265bis | https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22 | Yes |
| 95 | Session cookies not unduly persistent | High-risk sessions should be session-only/short-lived | Cookies | RFC 6265bis / WSTG-SESS-02 / CWE-613 | OWASP WSTG-SESS-02 | https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/02-Testing_for_Cookies_Attributes | Manual |
| 96 | Server-side session invalidation on logout | Stolen cookie rejected after logout/pw change | Cookies / Session | WSTG Session Mgmt / CWE-613 | OWASP WSTG-SESS-02 | https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/02-Testing_for_Cookies_Attributes | Manual |
| 97 | CORS: ACAO does not reflect arbitrary origin | Server doesn't echo any `Origin` value | CORS | WHATWG Fetch / MDN / CWE-942 | MDN CORS | https://developer.mozilla.org/docs/Web/HTTP/CORS | Partial |
| 98 | CORS: no wildcard ACAO with credentials | `ACAO: *` forbidden when ACAC true | CORS | WHATWG Fetch / MDN / CWE-942 | MDN Access-Control-Allow-Credentials | https://developer.mozilla.org/docs/Web/HTTP/Headers/Access-Control-Allow-Credentials | Yes |
| 99 | CORS: `Access-Control-Allow-Credentials` not over-used | ACAC true only with strict origin allowlist | CORS | WHATWG Fetch / MDN / CWE-942 | MDN CORS | https://developer.mozilla.org/docs/Web/HTTP/CORS | Partial |
| 100 | CORS: `null` origin not allowed | Sandboxed/opaque origins not trusted | CORS | WHATWG Fetch / MDN / CWE-942 | MDN CORS | https://developer.mozilla.org/docs/Web/HTTP/CORS | Partial |
| 101 | CORS: `Access-Control-Allow-Methods` not over-permissive | No broad PUT/DELETE/PATCH exposure | CORS | WHATWG Fetch / MDN / CWE-942 | MDN Access-Control-Allow-Methods | https://developer.mozilla.org/docs/Web/HTTP/Headers/Access-Control-Allow-Methods | Partial |
| 102 | CORS: `Access-Control-Allow-Headers` not `*`/excessive | No arbitrary privileged headers allowed | CORS | WHATWG Fetch / MDN / CWE-942 | MDN Access-Control-Allow-Headers | https://developer.mozilla.org/docs/Web/HTTP/Headers/Access-Control-Allow-Headers | Partial |
| 103 | CORS: preflight (OPTIONS) handled correctly | ACAO/ACAM/ACAH/Max-Age coherent & not over-broad | CORS | WHATWG Fetch / MDN | WHATWG Fetch Standard | https://fetch.spec.whatwg.org/ | Partial |
| 104 | CORS: no insecure (http) origins trusted | TLS origins only for sensitive resources | CORS | WHATWG Fetch / OWASP WSTG / CWE-319 | MDN CORS | https://developer.mozilla.org/docs/Web/HTTP/CORS | Partial |
| 105 | CORS: no regex/substring origin bypass | Allowlist not fooled by `example.com.evil.com` | CORS | OWASP WSTG / CWE-20 / CWE-942 | MDN CORS | https://developer.mozilla.org/docs/Web/HTTP/CORS | Manual |
| 106 | CORS: credentialed access to sensitive APIs restricted | Broad ACAO + ACAC + PII = exfiltration risk | CORS | WHATWG Fetch / MDN / CWE-942 | MDN CORS | https://developer.mozilla.org/docs/Web/HTTP/CORS | Manual |
| 107 | WSTG-CONF-01 Network infrastructure config | Firewalls/proxies/segmentation; no exposed mgmt ports | Infrastructure | WSTG-CONF-01 / CWE-284 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/01-Test_Network_Infrastructure_Configuration | Manual |
| 108 | WSTG-CONF-02 Application platform config | No directory listing, verbose errors, default content, sample apps | Infrastructure | WSTG-CONF-02 / CWE-16 / CWE-209 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/02-Test_Application_Platform_Configuration | Partial |
| 109 | WSTG-CONF-03 File extensions handling | Dynamic files executed not served as source; sensitive ext not web-served | Infrastructure | WSTG-CONF-03 / CWE-538 / CWE-552 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/03-Test_File_Extensions_Handling_for_Sensitive_Information | Partial |
| 110 | WSTG-CONF-04 Old backup / unreferenced files | `.bak`/`.old`/`~`/`.swp` not web-accessible | Infrastructure / Exposure | WSTG-CONF-04 / CWE-538 / CWE-552 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/04-Review_Old_Backup_and_Unreferenced_Files_for_Sensitive_Information | Yes |
| 111 | WSTG-CONF-05 Admin interfaces | Admin panels protected (auth/IP restriction/non-guessable) | Infrastructure | WSTG-CONF-05 / CWE-284 / CWE-1392 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/05-Enumerate_Infrastructure_and_Application_Admin_Interfaces | Partial |
| 112 | WSTG-CONF-06 HTTP methods | Dangerous methods (PUT/DELETE/TRACE) disabled where unneeded | Infrastructure / HTTP methods | WSTG-CONF-06 / RFC 9110 / CWE-664 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/06-Test_HTTP_Methods | Yes |
| 113 | WSTG-CONF-06 TRACE/XST | TRACE disabled; no header reflection (Cross-Site Tracing) | HTTP methods | WSTG-CONF-06 / RFC 9110 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/06-Test_HTTP_Methods | Yes |
| 114 | WSTG-CONF-07 HSTS | HSTS present/correct (overlaps #1-5) | Transport | WSTG-CONF-07 / CWE-319 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/07-Test_HTTP_Strict_Transport_Security | Yes |
| 115 | WSTG-CONF-08 RIA cross-domain policy | `crossdomain.xml`/`clientaccesspolicy.xml` not wildcard | Infrastructure | WSTG-CONF-08 / CWE-264 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/08-Test_RIA_Cross_Domain_Policy | Yes |
| 116 | WSTG-CONF-09 File permissions | Least-privilege on web files; webroot not writable | Infrastructure | WSTG-CONF-09 / CWE-732 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/09-Test_File_Permission | Manual |
| 117 | WSTG-CONF-10 Subdomain takeover | No dangling DNS/CNAME to de-provisioned resources | Infrastructure / DNS | WSTG-CONF-10 / CWE-16 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/10-Test_for_Subdomain_Takeover | Partial |
| 118 | WSTG-CONF-11 Cloud storage | Buckets/containers not public-list/read/write unless intended | Infrastructure | WSTG-CONF-11 / CWE-200 / CWE-284 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/11-Test_Cloud_Storage | Partial |
| 119 | WSTG-CONF-12 Content Security Policy | CSP present & robust (overlaps #6, 23-50) | Security Headers | WSTG-CONF-12 / CWE-79 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/12-Test_for_Content_Security_Policy | Yes |
| 120 | WSTG-INFO-02 Web server fingerprint | Server software/version not disclosed in banners | Exposure / Fingerprinting | WSTG-INFO-02 / CWE-200 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/01-Information_Gathering/02-Fingerprint_Web_Server | Yes |
| 121 | WSTG-INFO-03 Webserver metafiles | `robots.txt`/`sitemap.xml` don't leak hidden paths | Exposure | WSTG-INFO-03 / CWE-538 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/01-Information_Gathering/03-Review_Webserver_Metafiles_for_Information_Leakage | Yes |
| 122 | WSTG-INFO-08 Framework fingerprint | Framework/CMS not trivially fingerprintable | Exposure / Fingerprinting | WSTG-INFO-08 / CWE-200 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/01-Information_Gathering/08-Fingerprint_Web_Application_Framework | Partial |
| 123 | `.env` file not web-accessible | Environment secrets/credentials not served | Exposure | WSTG-CONF-03/04, INFO-01 / CWE-538 / CWE-200 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/04-Review_Old_Backup_and_Unreferenced_Files_for_Sensitive_Information | Yes |
| 124 | `.git/` directory not web-accessible | Repo history/source not downloadable | Exposure | WSTG-CONF-03/04, INFO-06 / CWE-538 / CWE-200 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/03-Test_File_Extensions_Handling_for_Sensitive_Information | Yes |
| 125 | `.svn/` directory not web-accessible | Subversion metadata not exposed | Exposure | WSTG-CONF-03/04, INFO-06 / CWE-538 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/03-Test_File_Extensions_Handling_for_Sensitive_Information | Yes |
| 126 | Source code disclosure | Dynamic files not served as plaintext; no source archives | Exposure | WSTG-CONF-03/04 / CWE-552 / CWE-540 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/03-Test_File_Extensions_Handling_for_Sensitive_Information | Partial |
| 127 | Directory listing / autoindex disabled | No directory enumeration via index listing | Exposure | WSTG-CONF-02, INFO-06 / CWE-548 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/02-Test_Application_Platform_Configuration | Yes |
| 128 | Default credentials changed | No vendor default user/pass on admin interfaces | Infrastructure | WSTG-CONF-05 / CWE-1392 / CWE-798 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/05-Enumerate_Infrastructure_and_Application_Admin_Interfaces | Manual |
| 129 | Debug / verbose error pages disabled in prod | No stack traces / debug pages exposed | Exposure | WSTG-CONF-02, INFO-05 / CWE-209 / CWE-215 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/02-Test_Application_Platform_Configuration | Partial |
| 130 | `.DS_Store` not web-accessible | macOS metadata revealing structure not served | Exposure | WSTG-CONF-03/04, INFO-06 / CWE-538 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/01-Information_Gathering/06-Identify_Application_Entry_Points | Yes |
| 131 | Exposed config files (web.config / wp-config.php) | Server/app config files not served via HTTP | Exposure | WSTG-CONF-03/04 / CWE-552 / CWE-538 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/03-Test_File_Extensions_Handling_for_Sensitive_Information | Yes |
| 132 | `phpinfo()` / tech info pages disabled | No env/path/module disclosure pages in prod | Exposure | WSTG-CONF-02, INFO-05 / CWE-200 / CWE-215 | OWASP WSTG | https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/02-Test_Application_Platform_Configuration | Yes |
| 133 | Subresource Integrity (SRI) on third-party scripts/styles | `integrity` hash (SHA-256/384/512) on external `<script>`/`<link>` | Supply chain / SRI | W3C SRI / MDN | W3C Subresource Integrity | https://www.w3.org/TR/sri-2/ | Yes |
| 134 | SRI `crossorigin` attribute on cross-origin resources | `crossorigin="anonymous"` so integrity is enforced | Supply chain / SRI | W3C SRI / MDN | MDN Subresource Integrity | https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Subresource_Integrity | Yes |
| 135 | Clickjacking: XFO or `frame-ancestors` present | At least one framing control on HTML responses | Clickjacking | RFC 7034 / W3C CSP3 | RFC 7034 | https://www.rfc-editor.org/rfc/rfc7034 | Yes |
| 136 | Not relying solely on JS frame-busting | Header-based protection, not unreliable JS | Clickjacking | RFC 7034 / W3C CSP | RFC 7034 | https://www.rfc-editor.org/rfc/rfc7034 | Manual |
| 137 | `.well-known/security.txt` present & valid | Has `Contact:`, `Expires:`; served over HTTPS; no leaked secrets | Disclosure | RFC 9116 | RFC 9116 | https://www.rfc-editor.org/rfc/rfc9116 | Yes |
| 138 | DNS CAA records present | Restricts which CAs may issue certs (`issue`/`issuewild`/`iodef`) | DNS / PKI | RFC 8659 | RFC 8659 | https://www.rfc-editor.org/rfc/rfc8659 | Yes |
| 139 | Certificate Transparency / SCTs present | Cert includes SCTs; monitor CT logs for rogue certs | TLS / PKI | RFC 9162 | RFC 9162 | https://www.rfc-editor.org/rfc/rfc9162 | Partial |
| 140 | DNSSEC enabled | DNSKEY/RRSIG/NSEC + DS chain of trust | DNS | RFC 4033/4034/4035 | RFC 4033 | https://www.rfc-editor.org/rfc/rfc4033 | Yes |
| 141 | SPF record present & correct | `v=spf1 ... -all`; enumerates legit mail sources | Email DNS | RFC 7208 | RFC 7208 | https://www.rfc-editor.org/rfc/rfc7208 | Yes |
| 142 | DKIM record present | `selector._domainkey` TXT with valid public key | Email DNS | RFC 6376 | RFC 6376 | https://www.rfc-editor.org/rfc/rfc6376 | Yes |
| 143 | DMARC record present & enforcing | `_dmarc` TXT with `p=quarantine|reject`; rua/ruf monitored | Email DNS | RFC 7489 | RFC 7489 | https://www.rfc-editor.org/rfc/rfc7489 | Yes |
| 144 | HTTP request smuggling (CL.TE / TE.CL) | Front-end/CDN/origin agree on `Content-Length`/`Transfer-Encoding`; no request desync | Commonly-missed | CWE-444 / OWASP WSTG | CWE-444 | https://cwe.mitre.org/data/definitions/444.html | Partial |
| 145 | Host header injection / poisoning | `Host`/`X-Forwarded-Host` not trusted for redirects, reset links, cache keys | Commonly-missed | CWE-74 / OWASP WSTG | CWE-74 | https://cwe.mitre.org/data/definitions/74.html | Partial |
| 146 | HTTP response splitting / CRLF header injection | Reflected values reaching headers reject `\r\n` | Commonly-missed | CWE-113 / RFC 9110 | CWE-113 | https://cwe.mitre.org/data/definitions/113.html | Partial |
| 147 | Web cache poisoning via unkeyed headers | Headers affecting response (`X-Forwarded-*`, `Origin`, etc.) are in cache key | Commonly-missed | OWASP Web Cache Poisoning / RFC 9111 | OWASP Web Cache Poisoning | https://owasp.org/www-community/attacks/Cache_Poisoning | Partial |
| 148 | Open redirect | Redirect/return-URL params restricted to allowlist / same-origin | Commonly-missed | CWE-601 / OWASP WSTG | CWE-601 | https://cwe.mitre.org/data/definitions/601.html | Partial |
| 149 | CSP bypass via JSONP / whitelisted CDNs | No JSONP endpoints or arbitrary-JS CDN paths in `script-src` allowlist | Commonly-missed | W3C CSP / OWASP CSP Cheat Sheet | OWASP CSP Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html | Manual |
| 150 | CSP nonce uniqueness / unpredictability | Nonces per-response, cryptographically random, never reused/derivable | Commonly-missed | W3C CSP Level 3 / OWASP CSP Cheat Sheet | W3C CSP Level 3 | https://www.w3.org/TR/CSP3/ | Partial |
| 151 | Reporting-Endpoints / Report-To / NEL configured safely | Reporting headers point only to trusted collectors; no topology leak | Commonly-missed | W3C Reporting API / W3C NEL | W3C Reporting API | https://www.w3.org/TR/reporting-1/ | Yes |
| 152 | Cross-origin isolation (COOP+COEP) for SharedArrayBuffer | Both COOP & COEP correct where `SharedArrayBuffer` used; subresources compatible | Commonly-missed | MDN Cross-Origin Isolation / HTML COOP/COEP | MDN Cross-Origin Isolation | https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated | Partial |
| 153 | TLS cipher suite server-order preference | Server (not client) determines cipher selection; no weak-suite downgrade | Commonly-missed | RFC 8446 / RFC 5246 | RFC 8446 | https://www.rfc-editor.org/rfc/rfc8446 | Yes |
| 154 | TLS 0-RTT early data replay protection | If 0-RTT enabled, only idempotent requests; replay-sensitive endpoints reject early data | Commonly-missed | RFC 8470 / RFC 8446 | RFC 8470 | https://www.rfc-editor.org/rfc/rfc8470 | Partial |
| 155 | www vs non-www canonical redirect | Exactly one canonical host enforced; HTTPS-only; no redirect chains; consistent HSTS/cookies | Commonly-missed | RFC 6797 / OWASP Cheat Sheet | RFC 6797 | https://www.rfc-editor.org/rfc/rfc6797 | Yes |
| 156 | Wildcard / all-subdomain TLS coverage | Cert SAN coverage matches full subdomain estate; wildcard scope not over-broad | Commonly-missed | RFC 6125 / CA/B Baseline Requirements | RFC 6125 | https://www.rfc-editor.org/rfc/rfc6125 | Yes |
| 157 | IPv6 reachability & parity | IPv6 path has same redirects/WAF/TLS/headers/access controls as IPv4 | Commonly-missed | RFC 8200 / OWASP WSTG | RFC 8200 | https://www.rfc-editor.org/rfc/rfc8200 | Partial |
| 158 | HTTP/2 & HTTP/3 availability | H2/H3 enabled as intended; ALPN/QUIC negotiation preserves security controls | Commonly-missed | RFC 7540 / RFC 9114 / RFC 9000 | RFC 7540 / RFC 9114 | https://www.rfc-editor.org/rfc/rfc9114 | Yes |

## Mozilla Observatory note

Perplexity (raw/infra-03.json) confirmed that the Mozilla HTTP Observatory's authoritative,
maintained enumeration of every individual test and its exact numeric score modifier lives at
the single canonical page **https://developer.mozilla.org/en-US/observatory/docs/tests_and_scoring**.
It deflected from copying the live table (which Mozilla notes "may change as baselines shift").
The Observatory's test areas it confirmed — CSP (presence/unsafe-directive/report-only), HSTS
(presence/max-age/includeSubDomains/preload), cookies (Secure/HttpOnly/SameSite), HTTP→HTTPS
redirection, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Subresource Integrity, and
CORS (`Access-Control-Allow-Origin` permissiveness) — are all already covered as individual rows
above. The exact point modifiers per test should be read live from the canonical page above before
hard-coding scoring into LaunchAudit.

## Unverified / needs a source

- **Expect-CT header** — surfaced in raw/infra-08.json but explicitly described by the source as
  **deprecated and removed from major browsers** (Chromium deprecation note, not a standard). Not
  added as a recommended test; documented here only as a known-deprecated control. Certificate
  Transparency itself (row 139) remains valid via RFC 9162.

## [MODEL-SUGGESTED — confirm]

None added. Every row above traces to a source name + URL that appeared in a Perplexity answer or
its citations. No tests were inserted from model training knowledge alone.

## Completeness sweep (infra-09 — now captured)

The "commonly missed" completeness sweep (raw/infra-09.json) was initially blocked by a full-disk
(ENOSPC) condition, then successfully re-run once disk was freed. Its 15 sourced findings are folded
into the main table as rows 144-158 (HTTP request smuggling, host header injection, response splitting,
web cache poisoning, open redirect, CSP JSONP/CDN bypass, CSP nonce quality, Reporting-API/NEL,
COOP+COEP cross-origin isolation, cipher server-order preference, TLS 0-RTT replay, www/non-www
canonical redirect, wildcard/subdomain TLS coverage, IPv6 parity, HTTP/2-3 availability). No gap remains.

## Raw evidence

- `raw/infra-01.json` — sources pass (sonar-pro): canonical sources/standards for headers, TLS, cookies, CORS, WSTG. HTTP 200.
- `raw/infra-02.json` — OWASP Secure Headers Project + HTTP Headers Cheat Sheet, per-header enumeration. HTTP 200.
- `raw/infra-03.json` — Mozilla HTTP Observatory tests & scoring (canonical URL + covered areas). HTTP 200.
- `raw/infra-04.json` — W3C CSP Level 3 + MDN: full directive enumeration & weaknesses to flag. HTTP 200.
- `raw/infra-05.json` — Qualys SSL Labs Rating Guide + Mozilla Server Side TLS: protocol/cipher/cert/vuln tests. HTTP 200.
- `raw/infra-06.json` — RFC 6265bis + WSTG-SESS-02 + WHATWG Fetch: cookie attributes & CORS misconfig, with CWE refs. HTTP 200.
- `raw/infra-07.json` — OWASP WSTG CONF-01..12 + INFO-01..10 + sensitive-file exposure, with WSTG-IDs & CWEs. HTTP 200.
- `raw/infra-08.json` — SRI, clickjacking, mixed content, security.txt, subdomain takeover, CAA, CT, DNSSEC, SPF/DKIM/DMARC, HTTP methods/TRACE/XST. HTTP 200.
- `raw/infra-09.json` — completeness "commonly missed" sweep: request smuggling, host header injection, CRLF/response splitting, cache poisoning, open redirect, CSP bypass/nonce, Reporting-API/NEL, COOP+COEP, cipher order, 0-RTT replay, canonical redirect, subdomain TLS, IPv6 parity, HTTP/2-3. HTTP 200.
- `raw/00-sources.json` — pre-existing top-level sources file (not produced by this run).
