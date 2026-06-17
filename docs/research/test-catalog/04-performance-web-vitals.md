# Performance & Core Web Vitals — Test Catalog

> Provenance-first catalog (Truth-Protocol task). Every row in the main **Tests**
> table carries a Source + URL that appeared in a Perplexity `sonar-pro` answer or
> its citations, plus a standard reference (Lighthouse audit ID / Web Vitals metric)
> where one exists. Items Perplexity asserted without a clean canonical source, or
> that a research call could not return, are quarantined below the main table.
>
> **Research engine:** Perplexity API (`sonar-pro`), per `RESEARCH-PROTOCOL.md`.
> **Compiled from 7 saved raw calls** (`performance-01`..`performance-07`). No new
> API calls were made for this compilation. Two originally-planned calls did not run:
> a clean canonical enumeration of the Lighthouse **Best Practices** audits, and a
> dedicated JS/CSS opportunity pass. Their gaps are recorded honestly in the
> "Unverified / needs a source" section.

---

## Sources used

| Source | Org | Covers | URL |
|---|---|---|---|
| Lighthouse Performance category & audits | Google (Chrome DevTools) | Lab perf score; per-audit IDs (metrics, opportunities, diagnostics) | https://developer.chrome.com/docs/lighthouse/performance/ |
| Lighthouse overview | Google (Chrome) | What Lighthouse audits, how it runs | https://developer.chrome.com/docs/lighthouse/overview |
| Lighthouse performance scoring | Google (Chrome) | Metric weighting, score model | https://developer.chrome.com/docs/lighthouse/performance/performance-scoring |
| Optimizing Web Vitals using Lighthouse | Google (web.dev) | Image/LCP audits, audit-to-vital mapping | https://web.dev/articles/optimize-vitals-lighthouse |
| Audit performance | Google (web.dev) | Network/delivery audit set (redirects, TTFB, CDN) | https://web.dev/articles/performance-audit |
| Web Vitals | Google (web.dev) | Core Web Vitals & supporting vitals, measurement | https://web.dev/articles/vitals |
| Defining the Core Web Vitals metrics thresholds | Google (web.dev) | Good/NI/Poor thresholds, p75 method | https://web.dev/articles/defining-core-web-vitals-thresholds |
| Understanding Core Web Vitals and Google search | Google Search Central | CWV in ranking, field-data basis | https://developers.google.com/search/docs/appearance/core-web-vitals |
| Core Web Vitals report | Google Search Console | Field aggregation, p75 status (Good/NI/Poor) | https://support.google.com/webmasters/answer/9205520 |
| Chrome UX Report (CrUX) — Metrics | Google (Chrome) | Field metrics (LCP, INP, CLS, FCP, TTFB), p75 methodology | https://developer.chrome.com/docs/crux/methodology/metrics |
| RAIL performance model | Google (web.dev) | Response/Animation/Idle/Load budgets | https://web.dev/articles/rail |
| web.dev Performance learning path | Google (web.dev) | Loading, rendering, measurement curriculum | https://web.dev/learn/performance/ |
| Navigation Timing Level 2 | W3C Web Perf WG | Page-load milestone timings (TTFB basis) | https://www.w3.org/TR/navigation-timing-2/ |
| Resource Timing Level 2 | W3C Web Perf WG | Subresource load timings | https://www.w3.org/TR/resource-timing-2/ |
| Paint Timing | W3C Web Perf WG | first-paint / FCP entries | https://www.w3.org/TR/paint-timing/ |
| Long Tasks API | W3C Web Perf WG | >50ms main-thread tasks (TBT basis) | https://www.w3.org/TR/longtasks/ |
| Largest Contentful Paint API | W3C Web Perf WG | LCP entry definition | https://www.w3.org/TR/largest-contentful-paint/ |
| Layout Instability API | W3C Web Perf WG | LayoutShift entries (CLS basis) | https://www.w3.org/TR/layout-instability/ |
| Event Timing API | W3C Web Perf WG | Interaction timing (INP/FID basis) | https://www.w3.org/TR/event-timing/ |
| Resource Hints | W3C | preload/preconnect/prefetch/dns-prefetch | https://www.w3.org/TR/resource-hints/ |
| HTTP Semantics (RFC 9110) | IETF | Content-Encoding (gzip/br), headers | https://www.rfc-editor.org/rfc/rfc9110 |
| HTTP Caching (RFC 9111) | IETF | Cache-Control, validators, freshness | https://www.rfc-editor.org/rfc/rfc9111 |
| HTTP/1.1 Messaging (RFC 9112) | IETF | Persistent connections (keep-alive) | https://www.rfc-editor.org/rfc/rfc9112 |
| HTTP/2 (RFC 9113) | IETF | Multiplexing, header compression | https://www.rfc-editor.org/rfc/rfc9113 |
| HTTP/3 (RFC 9114) | IETF | QUIC transport, connection setup | https://www.rfc-editor.org/rfc/rfc9114 |
| HTML Living Standard | WHATWG | Resource-hint link types | https://html.spec.whatwg.org/ |

---

## Tests

Legend — **Automatable by LaunchAudit?** Yes = directly programmatically checkable
(run Lighthouse, parse JSON audit by ID, read response headers, query CrUX API).
Field = requires field/RUM data (CrUX API or `web-vitals` JS in production).
Partial = automatable signal exists but needs human judgment on the fix.

### A. Lab metric audits (Lighthouse Performance score inputs)

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable? |
|---|---|---|---|---|---|---|---|
| 1 | First Contentful Paint (FCP) | Time until first text/image painted | Metric | LH `first-contentful-paint`; W3C Paint Timing | Lighthouse Performance; web.dev | https://web.dev/articles/optimize-vitals-lighthouse | Yes |
| 2 | Largest Contentful Paint (LCP) | Time the largest in-viewport element renders | Metric | LH `largest-contentful-paint`; W3C LCP API | Lighthouse; web.dev | https://web.dev/articles/vitals | Yes |
| 3 | Speed Index (SI) | How quickly visible content is populated during load | Metric | LH `speed-index` | Lighthouse Performance | https://developer.chrome.com/docs/lighthouse/performance/ | Yes |
| 4 | Total Blocking Time (TBT) | Sum of main-thread blocking (tasks >50ms) between FCP and TTI | Metric | LH `total-blocking-time`; W3C Long Tasks | Lighthouse; web.dev | https://web.dev/articles/optimize-vitals-lighthouse | Yes |
| 5 | Cumulative Layout Shift (CLS) | Unexpected layout shift during load | Metric | LH `cumulative-layout-shift`; W3C Layout Instability | Lighthouse; web.dev | https://web.dev/articles/vitals | Yes |
| 6 | Time to Interactive (TTI) | Time until the page is reliably interactive | Metric | LH `interactive` | Lighthouse Performance | https://developer.chrome.com/docs/lighthouse/performance/ | Yes |

### B. Core Web Vitals & supporting vitals — threshold checks (lab + field)

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable? |
|---|---|---|---|---|---|---|---|
| 7 | LCP threshold | p75 LCP ≤ 2.5s good; >2.5–4.0s needs improvement; >4.0s poor | Core Web Vital (loading) | Web Vitals thresholds | web.dev | https://web.dev/articles/defining-core-web-vitals-thresholds | Yes (lab) / Field |
| 8 | INP threshold | p75 INP ≤ 200ms good; >200–500ms NI; >500ms poor | Core Web Vital (responsiveness) | Web Vitals thresholds; W3C Event Timing | web.dev | https://web.dev/articles/defining-core-web-vitals-thresholds | Field (lab proxy = TBT) |
| 9 | CLS threshold | p75 CLS ≤ 0.1 good; >0.1–0.25 NI; >0.25 poor | Core Web Vital (visual stability) | Web Vitals thresholds | web.dev | https://web.dev/articles/defining-core-web-vitals-thresholds | Yes (lab) / Field |
| 10 | FCP threshold | ≤ 1.8s good; >1.8–3.0s NI; >3.0s poor | Supporting vital | Web Vitals thresholds | web.dev | https://web.dev/articles/defining-core-web-vitals-thresholds | Yes |
| 11 | TTFB threshold | ≤ 0.8s good; >0.8–1.8s NI; >1.8s poor | Supporting vital | Web Vitals thresholds; W3C Navigation Timing | web.dev | https://web.dev/articles/defining-core-web-vitals-thresholds | Yes |
| 12 | TBT threshold (lab) | ≤ 200ms good; >200–600ms NI; >600ms poor | Lab vital | Web Vitals thresholds | web.dev | https://web.dev/articles/defining-core-web-vitals-thresholds | Yes |
| 13 | CWV pass at p75 | All of LCP/INP/CLS in "good" at 75th percentile (per device class) | Field assessment | CrUX p75 methodology | web.dev; CrUX; Search Console | https://web.dev/articles/vitals | Field |
| 14 | CWV field data via CrUX | Real-user LCP/INP/CLS/FCP/TTFB exist & meet good for the origin/URL | Field gate | CrUX dataset | CrUX Metrics | https://developer.chrome.com/docs/crux/methodology/metrics | Field |

### C. LCP element diagnostics (image-LCP path)

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable? |
|---|---|---|---|---|---|---|---|
| 15 | LCP element identification | Which element is the LCP (so it can be optimized) | LCP diagnostic | LH "Largest Contentful Paint element" | web.dev | https://web.dev/articles/optimize-vitals-lighthouse | Yes |
| 16 | LCP image not lazy-loaded | The LCP image is NOT `loading="lazy"` (which delays LCP) | LCP diagnostic | LH `lcp-lazy-loaded` | web.dev | https://web.dev/articles/optimize-vitals-lighthouse | Yes |
| 17 | Preload the LCP image | Critical LCP image is preloaded (`<link rel=preload as=image>`) so fetch starts early | LCP optimization | web.dev Optimize LCP | web.dev | https://web.dev/articles/optimize-vitals-lighthouse | Partial |
| 18 | LCP request discovery | The LCP image request starts as early as possible | LCP diagnostic (experimental) | LH Performance Insights "LCP request discovery" | web.dev / DebugBear summary | https://web.dev/articles/optimize-vitals-lighthouse | Partial |

### D. Image & media optimization (Lighthouse opportunities)

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable? |
|---|---|---|---|---|---|---|---|
| 19 | Modern image formats | Images served as WebP/AVIF where supported (vs JPEG/PNG) | Image opportunity | LH `modern-image-formats` (legacy UI: `uses-webp-images`) | web.dev | https://web.dev/articles/optimize-vitals-lighthouse | Yes |
| 20 | Efficiently encode images | Images compressed efficiently (quality vs bytes) | Image opportunity | LH `uses-optimized-images` | web.dev | https://web.dev/articles/optimize-vitals-lighthouse | Yes |
| 21 | Properly sized / responsive images | Intrinsic size matches rendered size; `srcset`/`sizes` used | Image opportunity | LH `uses-responsive-images` | web.dev | https://web.dev/articles/optimize-vitals-lighthouse | Yes |
| 22 | Defer offscreen images | Below-the-fold images are lazy-loaded | Image opportunity | LH `offscreen-images` | web.dev | https://web.dev/articles/optimize-vitals-lighthouse | Yes |
| 23 | Explicit image/video dimensions | `<img>`/`<video>` have width/height or aspect-ratio (prevents CLS) | CLS / image | LH `unsized-images` | web.dev | https://web.dev/articles/optimize-vitals-lighthouse | Yes |
| 24 | Use video for animated content | Large animated GIFs replaced with video/animated WebP/AVIF | Image opportunity | LH `efficient-animated-content` | web.dev | https://web.dev/articles/optimize-vitals-lighthouse | Yes |
| 25 | Video poster + preload + sizing | `<video>` has poster, sized to avoid CLS, appropriate `preload` | Media best practice | web.dev media/CLS guidance | web.dev | https://web.dev/articles/optimize-vitals-lighthouse | Partial |
| 26 | Image CDN delivery | Images served from CDN with format negotiation, resizing, caching | Image delivery | web.dev (no single audit ID) | web.dev | https://web.dev/articles/optimize-vitals-lighthouse | Partial |

### E. Network / delivery (Lighthouse audits + HTTP standards)

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable? |
|---|---|---|---|---|---|---|---|
| 27 | Enable text compression | HTML/CSS/JS/SVG served with gzip or brotli `Content-Encoding` | Delivery opportunity | LH `uses-text-compression`; RFC 9110 | web.dev; IETF | https://web.dev/articles/performance-audit | Yes |
| 28 | Efficient cache policy | Static assets use long-lived `Cache-Control` TTL | Caching opportunity | LH `uses-long-cache-ttl`; RFC 9111 | web.dev; IETF | https://web.dev/articles/performance-audit | Yes |
| 29 | Use HTTP/2 | Page resources served over HTTP/2 (not HTTP/1.1) where possible | Transport | LH `uses-http2`; RFC 9113 | web.dev; IETF | https://web.dev/articles/performance-audit | Yes |
| 30 | Prefer HTTP/3 where supported | HTTP/3 used for faster connection setup/multiplexing | Transport (manual) | RFC 9114 (no classic LH audit) | IETF | https://www.rfc-editor.org/rfc/rfc9114 | Partial |
| 31 | Persistent connections (keep-alive) | Connections reused; no repeated handshake cost | Transport (manual) | RFC 9112 / 9113 / 9114 (no classic LH audit) | IETF | https://www.rfc-editor.org/rfc/rfc9112 | Partial |
| 32 | Preconnect to required origins | `rel=preconnect` warms DNS/TCP/TLS for critical 3rd-party origins | Resource hint | LH `uses-rel-preconnect`; WHATWG HTML | web.dev; WHATWG | https://web.dev/articles/performance-audit | Yes |
| 33 | Preload key requests | `rel=preload` for late-discovered render-critical resources | Resource hint | LH `uses-rel-preload`; WHATWG HTML | web.dev; WHATWG | https://web.dev/articles/performance-audit | Yes |
| 34 | dns-prefetch usage | `rel=dns-prefetch` for low-cost speculative DNS | Resource hint (manual) | WHATWG HTML (no classic LH audit) | WHATWG | https://html.spec.whatwg.org/ | Partial |
| 35 | prefetch usage | `rel=prefetch` only for likely-next navigations, not current critical path | Resource hint (manual) | WHATWG HTML (no classic LH audit) | WHATWG | https://html.spec.whatwg.org/ | Partial |
| 36 | CDN usage | Static/geographically-distributed assets served from CDN | Delivery (manual) | web.dev audit performance (no single audit ID) | web.dev | https://web.dev/articles/performance-audit | Partial |
| 37 | Reduce server response time (TTFB) | Initial server response is fast (backend/edge/caching) | Delivery opportunity | LH `server-response-time` | web.dev | https://web.dev/articles/performance-audit | Yes |
| 38 | Minimize redirects | No/short redirect chains on initial navigation | Delivery opportunity | LH `redirects` | web.dev | https://web.dev/articles/performance-audit | Yes |

### F. Render-blocking, JS/CSS & main-thread (Lighthouse opportunities/diagnostics)

> IDs in this section are confirmed by the web.dev-sourced calls (`performance-01`,
> `-04`, `-06`, `-07`). Additional JS/CSS audit IDs that only the blog-sourced
> `performance-02` call mentioned (and could not be cross-confirmed against a canonical
> source) are listed in "Unverified" rather than asserted here.

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable? |
|---|---|---|---|---|---|---|---|
| 39 | Eliminate render-blocking resources | CSS/JS delaying first render are deferred/removed | Opportunity | LH `render-blocking-resources` | web.dev | https://web.dev/articles/vitals | Yes |
| 40 | Minify CSS | CSS is minified | Opportunity | LH `unminified-css` | web.dev (sources pass) | https://web.dev/articles/vitals | Yes |
| 41 | Minify JavaScript | JS is minified | Opportunity | LH `unminified-javascript` | web.dev (sources pass) | https://web.dev/articles/vitals | Yes |
| 42 | Remove unused CSS | Loaded-but-unused CSS rules reduced | Opportunity | LH `unused-css-rules` | web.dev (sources pass) | https://web.dev/articles/vitals | Yes |
| 43 | Reduce unused JavaScript | Loaded-but-unused JS reduced | Opportunity | LH `unused-javascript` | web.dev (sources pass) | https://web.dev/articles/vitals | Yes |
| 44 | Minimize main-thread work | Heavy main-thread work during load reduced | Opportunity | LH `mainthread-work-breakdown` | web.dev (sources pass) | https://web.dev/articles/vitals | Yes |
| 45 | Reduce JS execution time | Parse/compile/execute time during startup reduced | Opportunity | LH `bootup-time` | web.dev (sources pass) | https://web.dev/articles/vitals | Yes |
| 46 | Avoid enormous network payloads | Total transferred bytes kept reasonable | Opportunity | LH `total-byte-weight` | web.dev (sources pass) | https://web.dev/articles/vitals | Yes |
| 47 | Ensure text stays visible during webfont load | `font-display` strategy prevents invisible text | Opportunity | LH `font-display` | web.dev (sources pass) | https://web.dev/articles/vitals | Yes |

### G. RAIL performance budgets (web.dev RAIL model)

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable? |
|---|---|---|---|---|---|---|---|
| 48 | RAIL — Response | Respond to user input in < 100ms | Interaction budget | RAIL model | web.dev | https://web.dev/articles/rail | Partial |
| 49 | RAIL — Animation | Each animation frame's work ≤ 10ms (≈60fps) | Animation budget | RAIL model | web.dev | https://web.dev/articles/rail | Partial |
| 50 | RAIL — Idle | Non-urgent work scheduled in < 50ms chunks | Idle budget | RAIL model | web.dev | https://web.dev/articles/rail | Partial |
| 51 | RAIL — Load | Interactive in < 5s on typical mobile connection | Load budget | RAIL model | web.dev | https://web.dev/articles/rail | Partial |

### H. Underlying browser perf APIs (measurement coverage these enable)

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable? |
|---|---|---|---|---|---|---|---|
| 52 | Navigation Timing milestones | redirect/DNS/TCP/request/response/DOMContentLoaded/load timings captured | Measurement | W3C Navigation Timing L2 | W3C | https://www.w3.org/TR/navigation-timing-2/ | Yes (RUM) |
| 53 | Resource Timing per-subresource | Per-resource (script/CSS/img/font/fetch) timings captured | Measurement | W3C Resource Timing L2 | W3C | https://www.w3.org/TR/resource-timing-2/ | Yes (RUM) |
| 54 | Paint Timing (first-paint/FCP) | first-paint and FCP entries available | Measurement | W3C Paint Timing | W3C | https://www.w3.org/TR/paint-timing/ | Yes (RUM) |
| 55 | Long Tasks (>50ms) | Main-thread tasks over 50ms observed (TBT/INP basis) | Measurement | W3C Long Tasks | W3C | https://www.w3.org/TR/longtasks/ | Yes (RUM) |
| 56 | Layout Instability entries | LayoutShift entries observed (CLS basis) | Measurement | W3C Layout Instability | W3C | https://www.w3.org/TR/layout-instability/ | Yes (RUM) |
| 57 | Event Timing entries | Interaction timing observed (INP/FID basis) | Measurement | W3C Event Timing | W3C | https://www.w3.org/TR/event-timing/ | Field |

---

## Unverified / needs a source

These were surfaced by Perplexity but lacked a clean canonical source in the returned
citations, or the research call was blocked before a properly-sourced answer was
obtained. Do NOT promote to the main table without a confirming canonical source
(Lighthouse audit reference / GitHub config / web.dev).

- **Lighthouse Best Practices category audits (full enumeration).** The dedicated call
  (`performance-03`) correctly REFUSED to enumerate because the returned citations did
  not include the official Lighthouse audit catalog — only general docs + the scoring
  note (GoogleChrome/lighthouse `docs/scoring.md`). Confirmed-from-that-call facts only:
  Best Practices audits are *equally weighted* and *pass/fail*. The individual audit
  IDs (commonly cited elsewhere as `uses-http2`, `no-document-write`, `geolocation-on-start`,
  `notification-on-start`, `errors-in-console`, `image-aspect-ratio`, `deprecations`,
  `js-libraries`, `csp-xss`, `uses-passive-event-listeners`, etc.) are NOT yet sourced
  in this catalog. **Re-run** against `https://github.com/GoogleChrome/lighthouse` audit
  config / `https://developer.chrome.com/docs/lighthouse/` when an API call is approved.
- **JS/CSS opportunity pass (planned `performance-08`).** Did not run. Several IDs in
  section F above are confirmed via the web.dev sources pass, but these additional
  commonly-cited audit IDs still need a dedicated sourced call before cataloguing:
  `dom-size` (Avoid an excessive DOM size), `legacy-javascript` (Avoid serving legacy JS
  to modern browsers), `duplicated-javascript`, `long-tasks` (Avoid long main-thread
  tasks), `third-party-summary` (Reduce impact of third-party code), `critical-request-chains`
  (Avoid chaining critical requests), `network-rtt`, `network-server-latency`,
  `user-timings`, `resource-summary`, `viewport`. The blog-sourced `performance-02` call
  listed most of these but also MISLABELED some (e.g. it titled `efficient-animated-content`
  as "Avoid large layout shifts" and `duplicated-javascript` as the legacy-JS audit), so
  its titles are not trustworthy — the IDs must be re-confirmed against the canonical
  Lighthouse config before use.

## [MODEL-SUGGESTED — confirm]

Nothing was added from model training knowledge. All rows above trace to a Perplexity
call's answer or its citations. (Section intentionally empty to satisfy the provenance law.)

## Raw evidence

Raw Perplexity JSON saved under `docs/research/test-catalog/raw/`:

- `performance-01.json` — Sources/standards pass (Lighthouse, web.dev Vitals, CrUX, RAIL, W3C perf APIs, HTTP RFCs, resource hints).
- `performance-02.json` — Lighthouse Performance audit enumeration (blog-sourced; some IDs mislabeled — used cautiously, see Unverified).
- `performance-03.json` — Lighthouse Best Practices enumeration (REFUSED for lack of canonical source; only pass/fail + equal-weight confirmed).
- `performance-04.json` — Core Web Vitals + supporting vitals: definitions, exact thresholds, lab/field, optimize-LCP/INP/CLS/FCP/TTFB/TBT diagnostics (web.dev).
- `performance-05.json` — CrUX field metrics + p75 methodology; RAIL four phases + numeric budgets.
- `performance-06.json` — Image/media optimization audits with exact audit IDs (web.dev Optimize-Vitals).
- `performance-07.json` — Network/delivery audits with exact audit IDs + HTTP standards mapping (web.dev + IETF RFCs).
