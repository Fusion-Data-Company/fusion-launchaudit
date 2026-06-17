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
| HTML Living Standard | WHATWG | Resource-hint link types; `loading` attr; bfcache; Speculation Rules; modulepreload | https://html.spec.whatwg.org/ |
| GoogleChrome/lighthouse (repo) | Google | Canonical audit IDs (Performance + Best Practices config) | https://github.com/GoogleChrome/lighthouse |
| CSS Fonts Module Level 4 | W3C | `font-display`, `size-adjust`, metric overrides | https://www.w3.org/TR/css-fonts-4/ |
| HTTP 103 Early Hints (RFC 8297) | IETF | Early Hints with `Link: rel=preload` | https://www.rfc-editor.org/rfc/rfc8297 |
| Brotli Compressed Data Format (RFC 7932) | IETF | Brotli (`br`) content-encoding | https://www.rfc-editor.org/rfc/rfc7932 |
| Lighthouse CI budgets | Google | `budget.json` resourceSizes/Counts/timings | https://web.dev/articles/performance-budgets |
| web.dev — facade / fonts / lazy / bfcache / code-split / tree-shake / speculation rules | Google | Commonly-missed perf practices | https://web.dev/articles/optimize-long-tasks |

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

### I. Additional Lighthouse Performance diagnostics & opportunities (canonical IDs)

> IDs confirmed as real Lighthouse Performance-category audits via the GoogleChrome/lighthouse
> repo + Chrome docs (`performance-08`). Per Lighthouse scoring docs, these diagnostics/
> opportunities do NOT directly contribute to the Performance score (only the 6 metrics do),
> but they are the actionable launch checks.

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable? |
|---|---|---|---|---|---|---|---|
| 58 | Avoid an excessive DOM size | DOM tree not overly large/deep | Diagnostic | LH `dom-size` | Lighthouse repo; Chrome docs | https://developer.chrome.com/docs/lighthouse/performance/performance-scoring | Yes |
| 59 | Reduce impact of third-party code | Summarizes third-party JS cost on load | Diagnostic | LH `third-party-summary` | Lighthouse repo | https://developer.chrome.com/docs/lighthouse/performance/performance-scoring | Yes |
| 60 | Avoid chaining critical requests | Critical dependency chains delaying render | Diagnostic | LH `critical-request-chains` | Lighthouse repo | https://developer.chrome.com/docs/lighthouse/performance/performance-scoring | Yes |
| 61 | Avoid serving legacy JS to modern browsers | Detects legacy (transpiled) JS shipped to modern browsers | Opportunity | LH `legacy-javascript` | Lighthouse repo | https://developer.chrome.com/docs/lighthouse/performance/performance-scoring | Yes |
| 62 | Remove duplicate modules in JS bundles | Duplicated JS shipped multiple times | Opportunity | LH `duplicated-javascript` | Lighthouse repo | https://developer.chrome.com/docs/lighthouse/performance/performance-scoring | Yes |
| 63 | Avoid long main-thread tasks | Long main-thread tasks (>50ms) blocking responsiveness | Diagnostic | LH `long-tasks`; W3C Long Tasks | Lighthouse repo; W3C | https://developer.chrome.com/docs/lighthouse/performance/performance-scoring | Yes |
| 64 | Network round-trip times | Connection latency / RTT to origins | Diagnostic | LH `network-rtt` | Lighthouse repo | https://developer.chrome.com/docs/lighthouse/performance/performance-scoring | Yes |
| 65 | Server backend latencies | Server response latency (backend delay) | Diagnostic | LH `network-server-latency` | Lighthouse repo | https://developer.chrome.com/docs/lighthouse/performance/performance-scoring | Yes |
| 66 | User Timing marks and measures | Surfaces `performance.mark`/`measure` entries | Diagnostic | LH `user-timings` | Lighthouse repo | https://developer.chrome.com/docs/lighthouse/performance/performance-scoring | Yes |
| 67 | Resource summary | Fetched resources by type/size/count | Diagnostic | LH `resource-summary` | Lighthouse repo | https://developer.chrome.com/docs/lighthouse/performance/performance-scoring | Yes |
| 68 | Has a `<meta name=viewport>` | Proper mobile viewport meta configured | Diagnostic | LH `viewport` | Lighthouse repo | https://developer.chrome.com/docs/lighthouse/performance/performance-scoring | Yes |
| 69 | Preload LCP image (prioritize) | LCP image discovered & prioritized early | Opportunity | LH `prioritize-lcp-image` | Lighthouse repo | https://developer.chrome.com/docs/lighthouse/performance/performance-scoring | Yes |
| 70 | Avoid `unload` listeners | No `unload` listeners (harms bfcache/responsiveness) | Diagnostic | LH `no-unload-listeners` | Lighthouse repo | https://developer.chrome.com/docs/lighthouse/performance/performance-scoring | Yes |
| 71 | Avoid non-composited animations | Animations not compositor-friendly (cause jank) | Diagnostic | LH `non-composited-animations` | Lighthouse repo | https://developer.chrome.com/docs/lighthouse/performance/performance-scoring | Yes |
| 72 | Preload fonts | Critical web fonts preloaded (`<link rel=preload as=font>`) | Opportunity | LH `preload-fonts` | Lighthouse repo | https://developer.chrome.com/docs/lighthouse/performance/performance-scoring | Yes |
| 73 | Display images with correct aspect ratio | Images have explicit dimensions / correct aspect ratio (CLS) | Diagnostic | LH `image-aspect-ratio` | Lighthouse repo | https://developer.chrome.com/docs/lighthouse/performance/performance-scoring | Yes |
| 74 | Serve images with correct resolution | Images not excessively large for displayed size | Opportunity | LH `image-size-responsive` | Lighthouse repo | https://developer.chrome.com/docs/lighthouse/performance/performance-scoring | Yes |

### J. Lighthouse Best Practices category audits (canonical, grouped)

> Confirmed against the GoogleChrome/lighthouse repo config (`performance-09`). Best
> Practices audits are equally weighted and pass/fail. Grouped per the report UI
> subcategories. (Note: `image-aspect-ratio`, `image-size-responsive`, `preload-fonts`
> are Performance audits, NOT Best Practices — catalogued in section I above.)

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable? |
|---|---|---|---|---|---|---|---|
| 75 | Uses HTTPS | Main document served over HTTPS | Trust & Safety | LH `is-on-https` | Lighthouse repo | https://github.com/GoogleChrome/lighthouse | Yes |
| 76 | HTTP→HTTPS redirect | `http://` redirects to `https://` | Trust & Safety | LH `redirects-http` | Lighthouse repo | https://github.com/GoogleChrome/lighthouse | Yes |
| 77 | No vulnerable libraries | No front-end libs with known vulnerabilities | Trust & Safety | LH `no-vulnerable-libraries` | Lighthouse repo | https://github.com/GoogleChrome/lighthouse | Yes |
| 78 | CSP effective against XSS | A meaningful Content-Security-Policy mitigates XSS | Trust & Safety | LH `csp-xss` | Lighthouse repo | https://github.com/GoogleChrome/lighthouse | Yes |
| 79 | Avoid third-party cookies | No reliance on (phasing-out) third-party cookies | Trust & Safety | LH `third-party-cookies` | Lighthouse repo | https://github.com/GoogleChrome/lighthouse | Yes |
| 80 | No browser errors in console | No JS runtime errors logged during load | General / Trust & Safety | LH `errors-in-console` | Lighthouse repo | https://github.com/GoogleChrome/lighthouse | Yes |
| 81 | No DevTools issues | No unresolved Chrome DevTools "Issues" for the page | General / Trust & Safety | LH `inspector-issues` | Lighthouse repo | https://github.com/GoogleChrome/lighthouse | Yes |
| 82 | Valid source maps | JS source maps referenced are valid & parse | General | LH `valid-source-maps` | Lighthouse repo | https://github.com/GoogleChrome/lighthouse | Yes |
| 83 | No geolocation request on load | No geolocation permission prompt on page load | User Experience | LH `geolocation-on-start` | Lighthouse repo | https://github.com/GoogleChrome/lighthouse | Yes |
| 84 | No notification request on load | No Notifications permission prompt on page load | User Experience | LH `notification-on-start` | Lighthouse repo | https://github.com/GoogleChrome/lighthouse | Yes |
| 85 | Password inputs allow paste | Password fields do not disable paste | User Experience | LH `password-inputs-can-be-pasted-into` | Lighthouse repo | https://github.com/GoogleChrome/lighthouse | Yes |
| 86 | Inputs do not block paste | Form inputs do not prevent pasting | User Experience | LH `paste-preventing-inputs` | Lighthouse repo | https://github.com/GoogleChrome/lighthouse | Yes |
| 87 | Has a valid doctype | Document declares `<!doctype html>` (avoid quirks mode) | General / Browser Compat | LH `doctype` | Lighthouse repo | https://github.com/GoogleChrome/lighthouse | Yes |
| 88 | Charset declared early | `<meta charset>` declared early in `<head>` | General / Browser Compat | LH `charset` | Lighthouse repo | https://github.com/GoogleChrome/lighthouse | Yes |
| 89 | No `unload` listeners (BP) | No `unload`/`beforeunload` listeners (page lifecycle/bfcache) | General / Browser Compat | LH `no-unload-listeners` | Lighthouse repo | https://github.com/GoogleChrome/lighthouse | Yes |
| 90 | Detected JS libraries | Reports which JS libraries are in use (feeds vuln check) | General | LH `js-libraries` | Lighthouse repo | https://github.com/GoogleChrome/lighthouse | Yes |
| 91 | Avoids deprecated APIs | No deprecated/soon-removed browser APIs used | Browser Compatibility | LH `deprecations` | Lighthouse repo | https://github.com/GoogleChrome/lighthouse | Yes |

### K. Completeness sweep — commonly-missed performance checks

> Areas frequently omitted from Lighthouse-only checklists, each with a canonical source
> (`performance-10`). These extend beyond what a single Lighthouse run surfaces.

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable? |
|---|---|---|---|---|---|---|---|
| 92 | TTFB breakdown | Decompose TTFB into DNS/TLS/redirect/backend (not just "slow server") | Network diagnostics | W3C Navigation Timing L2 | W3C; CrUX | https://www.w3.org/TR/navigation-timing-2/ | Yes (RUM) |
| 93 | `font-display` strategy | Critical fonts use swap/fallback/optional (avoid FOIT) | Font loading | CSS Fonts 4 `font-display` | W3C; web.dev | https://www.w3.org/TR/css-fonts-4/ | Yes |
| 94 | Font preload correctness | Above-the-fold fonts preloaded with `as=font` + `crossorigin` | Font loading | W3C Preload; web.dev | web.dev | https://web.dev/articles/preload-critical-assets | Partial |
| 95 | `size-adjust` / metric override | `@font-face` size-adjust aligns fallback↔webfont metrics (reduce CLS) | Font loading | CSS Fonts 4 `size-adjust` | W3C | https://www.w3.org/TR/css-fonts-4/ | Partial |
| 96 | Third-party facade pattern | Heavy embeds (video/maps/social) replaced with lightweight facades | Third-party | web.dev facade pattern | web.dev | https://web.dev/articles/third-party-facades | Partial |
| 97 | Field TBT / long tasks via RUM | Long-task / blocking data gathered in the field, mapped to INP | Responsiveness | web.dev Optimize long tasks; W3C Long Tasks | web.dev | https://web.dev/articles/optimize-long-tasks | Field |
| 98 | `modulepreload` for module graphs | ES module graphs preloaded via `rel=modulepreload` | Resource hint | WHATWG HTML `modulepreload` | WHATWG; web.dev | https://html.spec.whatwg.org/multipage/links.html | Partial |
| 99 | 103 Early Hints | Server/CDN sends 103 Early Hints with `Link: rel=preload` for critical assets | Resource hint | IETF RFC 8297 | IETF; web.dev | https://www.rfc-editor.org/rfc/rfc8297 | Partial |
| 100 | Preload actually used | Preloaded resources are matched/used (no DevTools preload warnings) | Resource hint | web.dev Preload critical assets | web.dev | https://web.dev/articles/preload-critical-assets | Partial |
| 101 | Production protocol is h2/h3 | The real CDN→browser path serves HTTP/2 or HTTP/3 | Transport | IETF RFC 9113 / 9114 | IETF; web.dev | https://www.rfc-editor.org/rfc/rfc9114 | Yes |
| 102 | LCP image not lazy-loaded | LCP element is eager-loaded, in initial HTML, with srcset/sizes | Image / LCP | WHATWG HTML `loading`; web.dev LCP | WHATWG; web.dev | https://web.dev/articles/lcp | Yes |
| 103 | CDN cache-hit ratio | High edge cache-hit ratio for static assets; correct `Cache-Control`/`Vary` | Caching | IETF RFC 9111; web.dev CDN | IETF; web.dev | https://www.rfc-editor.org/rfc/rfc9111 | Partial |
| 104 | Performance budgets in CI | `budget.json` enforces resourceSizes/resourceCounts/timings; fails CI | Budgets | Lighthouse CI budgets | Chrome docs; web.dev | https://web.dev/articles/performance-budgets | Yes |
| 105 | bfcache eligibility | Page eligible for back/forward cache (no unload handlers, etc.) | Page lifecycle | WHATWG HTML page lifecycle; web.dev bfcache | WHATWG; web.dev | https://web.dev/articles/bfcache | Partial |
| 106 | Speculation Rules prefetch/prerender | High-probability next navigations prefetched/prerendered via Speculation Rules | Navigation | WHATWG HTML Speculation Rules | WHATWG; web.dev | https://web.dev/articles/speculation-rules | Partial |
| 107 | Code-splitting in place | Route/feature-level JS splitting (no single oversized bundle) | JS delivery | web.dev Code splitting | web.dev | https://web.dev/articles/reduce-javascript-payloads-with-code-splitting | Partial |
| 108 | Tree-shaking verified | Unused exports eliminated; `sideEffects` configured | JS delivery | web.dev Tree shaking | web.dev | https://web.dev/articles/reduce-javascript-payloads-with-tree-shaking | Partial |
| 109 | Brotli compression | Text resources served `content-encoding: br` where supported (gzip fallback) | Compression | IETF RFC 7932 (Brotli); RFC 9110 | IETF; web.dev | https://www.rfc-editor.org/rfc/rfc7932 | Yes |
| 110 | JS hydration cost (SSR/CSR) | Hydration time measured separately; impact on INP/TBT evaluated | Rendering | web.dev interaction readiness | web.dev | https://web.dev/articles/optimize-long-tasks | Partial |
| 111 | Field vs lab CWV cross-check | CrUX field LCP/INP/CLS compared to Lighthouse lab; prioritize field regressions | Field gate | web.dev Vitals; CrUX methodology | web.dev; CrUX | https://web.dev/articles/vitals | Field |

---

## Unverified / needs a source

The originally-open gaps (Best Practices enumeration; JS/CSS opportunity IDs) have since
been CLOSED with canonical-sourced calls — see sections I, J, K above (`performance-08`,
`-09`, `-10`). Remaining caveats:

- **`lcp-lazy-loaded` exact slug.** The web.dev call (`performance-06`) cited this audit
  ("Largest Contentful Paint image was lazily loaded"); the canonical-ID call
  (`performance-08`) could NOT confirm the exact slug from the repo text it had. The
  *check* is real and sourced (catalog #16 / #102); the precise audit-ID string should be
  re-confirmed against the GoogleChrome/lighthouse config before relying on it
  programmatically.
- **Exact current titles for some `performance-02` IDs.** The first Performance-audit
  enumeration (`performance-02`) was blog-sourced and MISLABELED some titles (e.g. it
  titled `efficient-animated-content` as "Avoid large layout shifts" and `duplicated-javascript`
  as the legacy-JS audit). The IDs themselves are corroborated by the canonical call
  (`performance-08`); only the human-readable titles from `performance-02` should be
  distrusted. Titles used in this catalog were taken from the web.dev / canonical calls.

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
- `performance-08.json` — Canonical confirmation of Lighthouse Performance diagnostic/opportunity audit IDs (GoogleChrome/lighthouse repo + Chrome docs).
- `performance-09.json` — Lighthouse Best Practices category audits, exact IDs, grouped by subcategory, with mis-categorization corrections (GoogleChrome/lighthouse repo).
- `performance-10.json` — Completeness sweep of commonly-missed perf checks (fonts/font-display/size-adjust, third-party facades, modulepreload, 103 Early Hints, HTTP/3, bfcache, Speculation Rules, budgets, Brotli, hydration) with canonical sources (W3C CSS Fonts 4, IETF RFC 8297/7932/9111, WHATWG HTML, web.dev).
