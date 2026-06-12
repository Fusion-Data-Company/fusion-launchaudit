# LaunchAudit — Web-App Quality Check Catalog

**Concrete, automatable pre-launch checks for accessibility, performance, SEO/structured data, runtime correctness, and responsive layout.**
Every check below is runnable in a real Chromium browser via Playwright against a live URL. Where a repo signal sharpens or de-flakes the verdict, it is noted in the test method.

- **Audience:** the LaunchAudit runner (`runner/execute-core.ts`, `runner/executor.ts`) and card authors.
- **Execution model:** checks use the same primitives the executor already exposes — `page.goto`, `page.evaluate`, injected **axe-core**, the `console`/`response` listeners wired in `executeOne`, `set_viewport`, and raw `http` steps. Anything not already in the `ExecStep` union is flagged in the "Playwright" column as a small new primitive (`evaluate`-backed) so it stays inside the existing design.
- **Date compiled:** 2026-06-12. Thresholds reflect current (2026) guidance.

## How to read this catalog

Each check is: **ID | category | what it verifies | how to test in Playwright | pass criteria | severity**.

- **Severity** ladder: `blocker` (do not launch), `critical` (launch-risk, fix this week), `major` (visible quality gap), `minor` (polish), `info` (advisory / field-data caveat).
- **Lab vs field:** Core Web Vitals are *field* (real-user) metrics. A single Playwright run produces a **lab** estimate. The catalog marks where a lab pass cannot guarantee a field pass — report these as advisory unless CrUX/RUM data is wired in. ([web.dev — Web Vitals](https://web.dev/articles/vitals))
- **Automation ceiling:** axe-core finds ~57% of WCAG issues automatically; presence-only checks (e.g. alt text exists) cannot judge *quality* (is the alt meaningful). Those are flagged `info`/`major`, never `blocker`. ([Deque — axe-core](https://github.com/dequelabs/axe-core))

### Shared harness primitives (assumed available to cards)

| Primitive | Implementation note |
|---|---|
| `runAxe(page, {runOnly})` | Inject `axe-core` (`node_modules/axe-core/axe.min.js`) via `page.addScriptTag`, then `page.evaluate(() => axe.run(document, opts))`. Returns `violations[]`. |
| `page.evaluate(fn)` | Already used in executor (`expect_no_horizontal_overflow`). DOM/CSSOM assertions run here. |
| `consoleErrors[]` / `failedRequests[]` | Already collected per-page in `executeOne` via `page.on("console")` / `page.on("response")`. Extend the response listener to also capture `>= 400` and `requestfailed`. |
| `http` step | Already in `ExecStep` — used for robots.txt / sitemap.xml / canonical HEAD / asset status. |
| PerformanceObserver injection | `page.evaluate` + `PerformanceObserver` (`largest-contentful-paint`, `layout-shift`, `longtask`) and `web-vitals` lib for INP-proxy. |

---

## 1. Accessibility (WCAG 2.2 AA — automatable subset)

Mapped to **axe-core** rule families. axe-core ships rules tagged `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`. Run with `runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] }` and split results into the checks below so each maps to a named criterion. ([axe-core rule descriptions](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md), [Deque — axe-core 4.5 WCAG 2.2](https://www.deque.com/blog/axe-core-4-5-first-wcag-2-2-support-and-more/))

| ID | Category | What it verifies | How to test in Playwright | Pass criteria | Severity |
|---|---|---|---|---|---|
| A11Y-CONTRAST | accessibility | Text/background contrast meets WCAG 2 AA (4.5:1 normal, 3:1 large text ≥18.66px bold / ≥24px). axe `color-contrast` (SC 1.4.3). | `runAxe(page,{runOnly:['color-contrast']})` after `goto` + fonts loaded (`document.fonts.ready`). | Zero `color-contrast` violations. Report each node's computed fg/bg + ratio as evidence. | critical |
| A11Y-IMG-ALT | accessibility | Every `<img>`/`role=img`/`<area>`/input-image has a text alternative (or is correctly `alt=""` decorative). axe `image-alt`, `input-image-alt`, `area-alt` (SC 1.1.1). | `runAxe` restricted to image-alt family. Presence only — cannot judge meaningfulness. | Zero violations. Flag count of `alt=""` for human spot-check (`info`). | critical |
| A11Y-FORM-LABEL | accessibility | Form controls have a programmatic name (`<label for>`, `aria-label`, `aria-labelledby`, or wrapping label). axe `label`, `select-name`, `aria-input-field-name` (SC 4.1.2 / 1.3.1). | `runAxe` restricted to label/name family. | Zero violations. | critical |
| A11Y-FOCUS-VISIBLE | accessibility | Interactive elements show a visible focus indicator (SC 2.4.7). Not fully covered by axe — needs a focus-walk. | Tab through focusables: `page.evaluate` to collect `:focus` element, compare `getComputedStyle` `outline`/`box-shadow`/`border` before vs after focus for a non-zero visual delta. Flag any focusable with **no** visible change. | Every keyboard-focusable control has a detectable focus style. | major |
| A11Y-LANDMARK-MAIN | accessibility | Page has exactly one `main` landmark and content sits inside landmarks. axe `landmark-one-main`, `region` (SC 1.3.1 best-practice). | `runAxe` restricted to landmark/region rules. | One `main`; no significant content outside a landmark. | major |
| A11Y-HEADING-ORDER | accessibility | Headings are well-formed and not skipped (h1→h2→h3, no jump to h4). axe `heading-order` (best-practice) + `empty-heading`, `page-has-heading-one`. | `runAxe` restricted to heading rules; additionally `page.evaluate` to read heading levels in DOM order and assert no level is skipped by >1. | Single h1, no skipped levels, no empty headings. | major |
| A11Y-KEYBOARD-TRAP | accessibility | Keyboard focus is never trapped; focus can cycle past every component (SC 2.1.2). | Programmatic Tab loop (`page.keyboard.press('Tab')` up to N×focusables); record `document.activeElement` each step. Trap = focus stuck on one node or cycling a sub-set without reaching the end. | Focus advances through all focusables and returns to body/first; no stuck node. | blocker |
| A11Y-ARIA-VALID | accessibility | No invalid/misused ARIA: valid roles, required attrs present, no bad attr values, no `aria-hidden` on focusable. axe `aria-roles`, `aria-required-attr`, `aria-valid-attr`, `aria-valid-attr-value`, `aria-hidden-focus`, `aria-allowed-attr` (SC 4.1.2). | `runAxe` restricted to the `aria-*` family. | Zero ARIA-family violations. | critical |
| A11Y-DOC-LANG | accessibility | `<html lang>` present and a valid BCP-47 code. axe `html-has-lang`, `html-lang-valid` (SC 3.1.1). | `runAxe` restricted to lang rules (or `page.evaluate(()=>document.documentElement.lang)`). | `lang` present and valid. | major |
| A11Y-DOC-TITLE | accessibility | Document has a non-empty `<title>`. axe `document-title` (SC 2.4.2). | `runAxe` `document-title` or `page.title()`. | Non-empty, unique-per-route title. | major |
| A11Y-LINK-BTN-NAME | accessibility | Links and buttons have discernible text (not empty icon-only). axe `link-name` (SC 2.4.4/4.1.2), `button-name` (SC 4.1.2). | `runAxe` restricted to link-name/button-name. | Zero violations. | critical |
| A11Y-SKIP-LINK | accessibility | A bypass mechanism (skip-link / landmarks / headings) exists. axe `bypass` (SC 2.4.1). | `runAxe` `bypass`. | Pass (skip link or sufficient landmarks/headings present). | minor |
| A11Y-LIST-STRUCT | accessibility | Lists are structurally valid (`<li>` only inside `<ul>/<ol>`, `dl` well-formed). axe `list`, `listitem`, `definition-list`, `dlitem` (SC 1.3.1). | `runAxe` restricted to list rules. | Zero violations. | minor |
| A11Y-DUP-ID | accessibility | No duplicate `id` used by ARIA/labels (breaks name computation). axe `duplicate-id-aria` (SC 4.1.2). | `runAxe` `duplicate-id-aria`. | Zero violations. | major |
| A11Y-FRAME-TITLE | accessibility | Every `<iframe>` has an accessible name. axe `frame-title` (SC 4.1.2). | `runAxe` `frame-title`. | Zero violations (or no iframes present). | minor |
| A11Y-VIEWPORT-ZOOM | accessibility | Viewport meta does not disable zoom (`user-scalable=no` / `maximum-scale` < 2). axe `meta-viewport` (SC 1.4.4). | `runAxe` `meta-viewport` or parse the `<meta name=viewport>` content in `page.evaluate`. | Zoom not disabled; `maximum-scale` ≥ 2 or absent. | major |
| A11Y-TABINDEX | accessibility | No positive `tabindex` (> 0) breaking natural focus order. axe `tabindex` (best-practice). | `runAxe` `tabindex`. | Zero positive tabindex. | minor |
| A11Y-AUTOCOMPLETE | accessibility | Inputs collecting user info expose valid `autocomplete` tokens. axe `autocomplete-valid` (SC 1.3.5, WCAG 2.1). | `runAxe` `autocomplete-valid`. | Zero violations (or N/A). | minor |

> **Sources:** [axe-core rule descriptions](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md) · [W3C WAI — axe-core ACT implementation](https://www.w3.org/WAI/standards-guidelines/act/implementations/axe-core/) · [W3C — Understanding SC 2.4.7 Focus Visible / 2.1.2 No Keyboard Trap (WCAG 2.2)](https://www.w3.org/WAI/WCAG22/Understanding/) · [Deque — axe-core finds ~57% automatically](https://github.com/dequelabs/axe-core)

---

## 2. Performance (Core Web Vitals + Lighthouse lab signals)

**2026 "good" thresholds (75th percentile, field):** LCP ≤ **2.5 s**, INP ≤ **200 ms**, CLS ≤ **0.1**. "Needs improvement" / "poor" cutoffs: LCP 2.5–4.0 s / >4.0 s; INP 200–500 ms / >500 ms; CLS 0.1–0.25 / >0.25. ([web.dev — Web Vitals](https://web.dev/articles/vitals), [web.dev — Defining CWV thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds))

> **Caveat (mark every CWV check `info` if no field data):** A Playwright run is a single lab sample on the runner's network/CPU. It is directionally useful pre-launch but is NOT the 75th-percentile field score Google ranks on. Report lab numbers as estimates; only assert a hard fail when the lab value blows past the *poor* cutoff. ([web.dev — Web Vitals](https://web.dev/articles/vitals))

| ID | Category | What it verifies | How to test in Playwright | Pass criteria | Severity |
|---|---|---|---|---|---|
| PERF-LCP | performance | Largest Contentful Paint timing (loading). | Inject `PerformanceObserver({type:'largest-contentful-paint', buffered:true})`; take the last entry's `renderTime||loadTime` after `goto` settles. | Lab LCP ≤ 2.5 s = good; 2.5–4.0 s = `major`; > 4.0 s = `critical`. | critical |
| PERF-INP | performance | Interaction to Next Paint (responsiveness). | Hard to field-measure headless. Use the `web-vitals` lib's `onINP`, drive a few representative interactions (`click`/`type`) then read the value; OR use **TBT as the lab proxy** (see PERF-TBT). | Lab INP ≤ 200 ms good; report 200–500 ms `major`, > 500 ms `critical`. Treat as estimate. | major |
| PERF-CLS | performance | Cumulative Layout Shift (visual stability) across load + interaction. | `PerformanceObserver({type:'layout-shift', buffered:true})`; sum `value` for entries where `!hadRecentInput`. Scroll the page to trigger lazy content, then read total. | CLS ≤ 0.1 good; 0.1–0.25 `major`; > 0.25 `critical`. | critical |
| PERF-TBT | performance | Total Blocking Time — main-thread blocking between FCP and TTI; the lab stand-in for INP. | `PerformanceObserver({type:'longtask'})`; sum `(duration − 50)` for long tasks after FCP. | TBT ≤ 200 ms good (lab); 200–600 ms `major`; > 600 ms `critical`. | major |
| PERF-FCP | performance | First Contentful Paint (first paint of real content). | `performance.getEntriesByName('first-contentful-paint')` via Paint Timing API. | FCP ≤ 1.8 s good; 1.8–3.0 s `minor`; > 3.0 s `major`. | minor |
| PERF-TTFB | performance | Time To First Byte (server/network responsiveness). | `performance.getEntriesByType('navigation')[0].responseStart`. | TTFB ≤ 800 ms good; 800–1800 ms `minor`; > 1800 ms `major`. | minor |
| PERF-RENDER-BLOCKING | performance | Render-blocking CSS/JS in `<head>` delaying first paint (Lighthouse `render-blocking-resources` → "Render blocking requests" insight). | `page.evaluate`: enumerate `<head>` `<script>` without `async`/`defer`/`type=module` and synchronous `<link rel=stylesheet>` without `media`/preload. Cross-check Resource Timing for blocking before FCP. | No unexpected render-blocking resources; flag each with est. savings. | major |
| PERF-IMG-RESPONSIVE | performance | Images are sized for their displayed dimensions / use modern formats (`uses-responsive-images`, `modern-image-formats`). | `page.evaluate`: for each `<img>` compare `naturalWidth/Height` vs rendered `clientWidth/Height × devicePixelRatio`. Flag images > ~2× oversized or non-WebP/AVIF raster ≥ a size threshold. | No images materially oversized; modern format where raster is large. | major |
| PERF-IMG-UNSIZED | performance | `<img>`/`<video>` lack intrinsic `width`/`height` or aspect-ratio → CLS risk (Lighthouse `unsized-images`, folded into `cls-culprits`). | `page.evaluate`: list replaced elements with no `width`+`height` attrs and no CSS `aspect-ratio`. | All media reserve space (attrs or aspect-ratio). | major |
| PERF-FONT-DISPLAY | performance | Web fonts use `font-display: swap/optional` so text isn't invisible during load (Lighthouse `font-display`). | `page.evaluate(()=>[...document.fonts].map(f=>f.display))` and/or parse `@font-face` rules in `document.styleSheets` for `font-display`. | No font blocks text render (`swap`/`optional`, or preloaded). | minor |
| PERF-PRELOAD-LCP | performance | LCP image/resource is discoverable early (preloaded or in initial HTML, not lazy-loaded). | Identify LCP element from PERF-LCP entry; check it is not `loading=lazy` and is referenced in initial document / `<link rel=preload>`. | LCP resource is eagerly loaded. | major |
| PERF-COMPRESSION | performance | Text assets served with gzip/brotli and reasonable cache headers (`uses-text-compression`). | `http` HEAD/GET on main JS/CSS bundles; assert `content-encoding: br|gzip` and a `cache-control` max-age on hashed assets. | Text assets compressed; static assets cacheable. | minor |
| PERF-DOC-WEIGHT | performance | Total transferred bytes / request count not excessive on first load. | Sum sizes from `browser.network_requests` (extend response listener to record `transferSize`). | Within budget (e.g. flag > ~2.5 MB transferred or > ~80 requests on a marketing route). | minor |

> **Sources:** [web.dev — Web Vitals](https://web.dev/articles/vitals) · [web.dev — Defining CWV thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds) · [Chrome — Eliminate render-blocking resources](https://developer.chrome.com/docs/lighthouse/performance/render-blocking-resources) · [Chrome — Moving Lighthouse to insight audits](https://developer.chrome.com/blog/moving-lighthouse-to-insights) · [Chrome — What's new in Lighthouse 13](https://developer.chrome.com/blog/lighthouse-13-0)

---

## 3. SEO + Structured Data

Core on-page SEO tags + Open Graph + JSON-LD validity + crawl plumbing. ([Google Search Central — Structured data intro](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data), [ogp.me](https://ogp.me/))

| ID | Category | What it verifies | How to test in Playwright | Pass criteria | Severity |
|---|---|---|---|---|---|
| SEO-TITLE | seo | `<title>` present, non-empty, reasonable length (~10–60 chars), unique per route. | `page.title()`; length check; compare across crawled routes for duplicates. | Non-empty, ≤ ~60 chars, unique. | major |
| SEO-META-DESC | seo | `<meta name="description">` present and ~50–160 chars. | `page.evaluate` read meta description content + length. | Present, 50–160 chars. | major |
| SEO-CANONICAL | seo | `<link rel="canonical">` present, absolute, self-referential or intentional, and the target returns 200. | `page.evaluate` read canonical href; then `http` GET the href, assert 200 (not 3xx/4xx) and same-origin unless cross-domain canonical is intended. | Canonical present, absolute, resolves 200. | major |
| SEO-ROBOTS-META | seo | Page is not accidentally `noindex`/`nofollow` in `<meta name=robots>` or `X-Robots-Tag`. | `page.evaluate` read robots meta; `http` GET to read `x-robots-tag` header. | No `noindex` on pages meant to be indexed. | blocker |
| SEO-ROBOTS-TXT | seo | `/robots.txt` exists, is fetchable (200), and doesn't `Disallow: /` site-wide by accident. | `http` GET `${origin}/robots.txt`; assert 200; parse for a blanket `Disallow: /` under `User-agent: *`. | Exists, 200, no accidental full-site block. | major |
| SEO-SITEMAP | seo | `/sitemap.xml` exists (200) and is referenced from robots.txt; well-formed XML. | `http` GET `${origin}/sitemap.xml`; assert 200 + parses as XML with `<urlset>`/`<sitemapindex>`. Check robots.txt `Sitemap:` line. | Reachable, valid XML, linked from robots.txt. | major |
| SEO-H1 | seo | Exactly one `<h1>`, non-empty, descriptive. | `page.evaluate(()=>[...document.querySelectorAll('h1')])` count + text. | One non-empty h1. (Overlaps A11Y-HEADING-ORDER.) | major |
| SEO-OG-CORE | seo | Required Open Graph tags present: `og:title`, `og:type`, `og:image`, `og:url`. | `page.evaluate` read `meta[property^="og:"]`. | All four core OG tags present and non-empty. | major |
| SEO-OG-IMAGE-VALID | seo | `og:image` resolves to a real image (200, image content-type), ideally ≥ 1200×630. | `http` GET the `og:image` URL; assert 200 + `content-type: image/*`. | Image resolves 200 with image MIME. | minor |
| SEO-TWITTER-CARD | seo | Twitter Card tags present for rich previews (`twitter:card`, `twitter:title`/`image`). | `page.evaluate` read `meta[name^="twitter:"]`. | `twitter:card` present (or OG fallback acceptable). | minor |
| SEO-JSONLD-PARSE | seo | Every `<script type="application/ld+json">` block is valid JSON. | `page.evaluate` collect ld+json script texts; `JSON.parse` each in the runner (try/catch). | All JSON-LD blocks parse without error. | major |
| SEO-JSONLD-SCHEMA | seo | JSON-LD has `@context` = schema.org and a recognized `@type`, with that type's required props (e.g. `LocalBusiness` → `name`+`address`; `Product` → `name`; `Article` → `headline`,`image`,`datePublished`). | After parse, assert `@context` includes `schema.org`, `@type` present, and required keys for the detected type exist (table of required props per type lives in runner config). | Context + type + required props present. | major |
| SEO-LINKS-BROKEN | seo | No broken internal links / no 4xx-5xx on same-origin `<a href>`. | `page.evaluate` collect same-origin hrefs; dedupe; `http` HEAD (fallback GET) each; flag any ≥ 400. | Zero internal links returning ≥ 400. | major |
| SEO-IMG-BROKEN | seo | No broken images (natural size 0 / asset 404). | `page.evaluate`: list `<img>` where `complete && naturalWidth===0`; corroborate with failed-request log. | Zero broken images. (Overlaps RUN-IMG-BROKEN.) | major |
| SEO-VIEWPORT-META | seo | A `<meta name="viewport">` exists for mobile rendering/mobile-first indexing. | `page.evaluate` presence check. | Present with `width=device-width`. (Overlaps RESP-VIEWPORT.) | major |
| SEO-LANG-HREFLANG | seo | If multi-locale, `hreflang` alternates are present and reciprocal. | `page.evaluate` read `link[rel=alternate][hreflang]`; cross-check reciprocity across crawled locales. | Valid reciprocal hreflang (or N/A single-locale). | minor |

> **Sources:** [Google Search Central — Intro to structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) · [Google Search Central — General structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) · [The Open Graph protocol (ogp.me)](https://ogp.me/) · [schema.org](https://schema.org/)

---

## 4. Correctness / Runtime

Catches the bug classes that ship silently: console errors, failed requests, 404 assets, mixed content, broken images, hydration errors. The executor already captures console errors and ≥500 responses in `executeOne`; these checks extend that listener and add `page.evaluate` assertions.

| ID | Category | What it verifies | How to test in Playwright | Pass criteria | Severity |
|---|---|---|---|---|---|
| RUN-CONSOLE-ERRORS | correctness | No uncaught JS errors / `console.error` on load + core interactions. | Use existing `page.on("console")` collector (type `error`) **plus** `page.on("pageerror")` for uncaught exceptions. Assert empty after the card's steps. | Zero console errors and zero `pageerror`. | critical |
| RUN-NETWORK-FAILED | correctness | No failed network requests (≥ 400 status or `requestfailed`). | Extend `page.on("response")` to record status ≥ 400 (not just ≥ 500); add `page.on("requestfailed")`. Assert empty. | Zero requests ≥ 400 and zero failed requests. | critical |
| RUN-ASSET-404 | correctness | No 404 on first-party static assets (JS/CSS/fonts/images). | From the failed-request log, filter same-origin asset types; flag any 404/410. | Zero first-party asset 404s. | critical |
| RUN-MIXED-CONTENT | correctness | On an HTTPS page, no resources requested over `http://` (active mixed content is blocked; passive is insecure). | `page.on("request")`: flag any request URL starting `http://` while page origin is `https://`. Also scan `consoleErrors` for "Mixed Content" strings. | Zero `http://` subresources on an HTTPS page. | blocker |
| RUN-IMG-BROKEN | correctness | No visually broken images (decoded to 0×0 / asset missing). | `page.evaluate(()=>[...document.images].filter(i=>i.complete && i.naturalWidth===0).map(i=>i.currentSrc))`. | Empty list. | major |
| RUN-HYDRATION | correctness | No SSR/CSR hydration mismatch (React/Next/Vue/Svelte). | Scan `consoleErrors` for framework hydration signatures: "Hydration failed", "did not match", "Text content does not match server-rendered HTML", "Hydration completed but contains mismatches", "minified React error #418/#423/#425". Repo signal: detect SSR framework (Next/Remix/Astro/Nuxt) in `package.json` to know whether to expect hydration at all. | No hydration-mismatch console messages. | critical |
| RUN-CSP-VIOLATION | correctness | No Content-Security-Policy violations breaking resources at runtime. | `page.on("console")` already catches CSP report messages; also listen for `securitypolicyviolation` via injected handler. Flag any. | Zero CSP violations (or CSP intentionally report-only). | major |
| RUN-UNHANDLED-REJECTION | correctness | No unhandled promise rejections. | Inject `window.addEventListener('unhandledrejection', …)` before navigation; collect reasons. | Zero unhandled rejections. | major |
| RUN-SECURE-HEADERS | correctness | Baseline security headers present on the document response (HSTS on HTTPS, `X-Content-Type-Options: nosniff`, a CSP or frame-ancestors). | `http` GET the page URL; assert presence of `strict-transport-security`, `x-content-type-options`, and either `content-security-policy` or `x-frame-options`. | Required headers present (HSTS only required on HTTPS). | major |
| RUN-NO-SOURCEMAP-LEAK | correctness | Production build doesn't ship `.map` source maps or expose `//# sourceMappingURL` to public JS (info-leak / bloat). | From network log, flag served `*.js.map`; or `http` GET a bundle and grep tail for `sourceMappingURL`. Repo signal: check build config for `productionBrowserSourceMaps`/`sourcemap`. | No public source maps on prod. | minor |
| RUN-NO-STACKTRACE | correctness | Pages/JSON endpoints don't leak stack traces or framework error overlays in prod. | Reuse the executor's `expectBodyExcludes` on `http` responses for fragments like `at Object.<anonymous>`, `Error:`, `webpack-internal`, Next.js error-overlay markers. | No stack traces / dev overlays in responses. | major |

> **Sources:** [web.dev — Fixing mixed content](https://web.dev/articles/fixing-mixed-content) · [Next.js — React hydration error](https://nextjs.org/docs/messages/react-hydration-error) · [MDN — Mixed content](https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content)

---

## 5. Responsive

Tested at the three breakpoints the brief calls out: **390** (mobile), **768** (tablet), **1280** (desktop). Use the existing `set_viewport` step, re-run layout assertions per width.

| ID | Category | What it verifies | How to test in Playwright | Pass criteria | Severity |
|---|---|---|---|---|---|
| RESP-OVERFLOW-390 | responsive | No horizontal overflow / sideways scroll at 390px (mobile). | `set_viewport {390, 844}`, settle, then existing `expect_no_horizontal_overflow`: `scrollWidth > clientWidth`. Also `page.evaluate` to list offending elements (`el.scrollWidth/getBoundingClientRect().right` past viewport). | `documentElement.scrollWidth ≤ clientWidth + 1px` tolerance. | critical |
| RESP-OVERFLOW-768 | responsive | No horizontal overflow at 768px (tablet). | `set_viewport {768, 1024}` + same overflow check. | No horizontal overflow. | major |
| RESP-OVERFLOW-1280 | responsive | No horizontal overflow at 1280px (desktop). | `set_viewport {1280, 800}` + same overflow check. | No horizontal overflow. | major |
| RESP-VIEWPORT | responsive | `<meta name="viewport" content="width=device-width, initial-scale=1">` present (required for correct mobile rendering). | `page.evaluate` read viewport meta content. | Present with `width=device-width`. | blocker |
| RESP-TAP-TARGETS | responsive | Interactive targets meet WCAG 2.2 SC 2.5.8 Target Size (Minimum): ≥ **24×24** CSS px, or ≥ 24px spacing from neighbors. (Lighthouse's `tap-targets` uses a stricter 48×48 usability bar — report both; fail at 24, warn at <48.) | At 390px: `page.evaluate` over links/buttons/inputs; read `getBoundingClientRect()`. Fail any target < 24×24 that lacks ≥24px spacing; warn 24–47px. Exempt inline-text links and equivalents per SC 2.5.8 exceptions. | No target < 24×24 (AA). Targets 24–47px = `minor` warn. | major |
| RESP-TEXT-READABLE | responsive | Body text isn't sub-legible on mobile (≈ < 12px) and doesn't rely on disabled zoom. | At 390px `page.evaluate` sample computed `font-size` of paragraph/body text nodes. Combine with A11Y-VIEWPORT-ZOOM. | Body copy ≥ ~12px and zoom enabled. | minor |
| RESP-NO-FIXED-WIDTH | responsive | No element forces a viewport-exceeding fixed width (common 390px overflow cause). | At 390px `page.evaluate`: flag elements whose `getBoundingClientRect().width > viewportWidth` and computed `width` is a fixed px ≥ viewport. | No fixed-width element wider than the viewport. | major |
| RESP-IMG-FLUID | responsive | Images scale within their container (`max-width:100%` behavior), not overflowing at 390px. | At 390px `page.evaluate`: flag `<img>` whose `getBoundingClientRect().right` exceeds viewport width. | No image overflows the viewport. | minor |

> **Sources:** [W3C — Understanding SC 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) · [Lighthouse — tap-targets 48px discussion](https://github.com/GoogleChrome/lighthouse/discussions/14864) · [web.dev — Web Vitals (mobile/desktop segmentation)](https://web.dev/articles/vitals)

---

## Runner integration notes

1. **Severity → gate.** `blocker` fails the launch verdict; `critical` fails the category score; `major`/`minor`/`info` deduct points but don't block. This matches the card model in `runner/cards/`.
2. **Reuse existing collectors.** `RUN-CONSOLE-ERRORS`, `RUN-NETWORK-FAILED`, `RESP-OVERFLOW-*` already have executor primitives (`expect_console_clean`, `expect_network_clean`, `expect_no_horizontal_overflow`). The rest need: (a) axe-core injection helper, (b) a `evaluate`-backed assertion step, (c) extending `page.on("response")` to capture ≥400 and adding `pageerror`/`requestfailed`/`request` listeners.
3. **axe-core is one dependency.** Add `axe-core` to devDependencies; inject `axe.min.js` per page; one `axe.run` powers ~13 of the accessibility checks — split its `violations[]` by `id` into the named checks above so each maps to a WCAG criterion in the report.
4. **Lab-vs-field honesty (Truth Protocol).** Every CWV check (PERF-LCP/INP/CLS/TBT/FCP/TTFB) must label its number "lab estimate, single run" in the report and NOT claim a field/CrUX pass. Only escalate to `critical` past the *poor* cutoff. ([web.dev — Web Vitals](https://web.dev/articles/vitals))
5. **Presence ≠ quality.** Alt-text, heading, and meta checks verify presence/structure, not human-meaningfulness — keep them out of `blocker` and surface counts for spot-check. ([Deque — axe-core](https://github.com/dequelabs/axe-core))
6. **Repo signals (where useful).** SSR-framework detection (`package.json`) gates `RUN-HYDRATION`; build config gates `RUN-NO-SOURCEMAP-LEAK`; required-JSON-LD-type table is runner config; sitemap/robots can be cross-checked against `public/` if the repo is mounted (`--repo`, already supported by `runner/repo-scanner.ts`).

## Source index

**Accessibility**
- axe-core rule descriptions — https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md
- W3C WAI — axe-core ACT implementation — https://www.w3.org/WAI/standards-guidelines/act/implementations/axe-core/
- Deque — axe-core 4.5 First WCAG 2.2 Support — https://www.deque.com/blog/axe-core-4-5-first-wcag-2-2-support-and-more/
- W3C — Understanding WCAG 2.2 (SC 1.4.3, 2.4.7, 2.1.2, 2.5.8, etc.) — https://www.w3.org/WAI/WCAG22/Understanding/
- W3C — Understanding SC 2.5.8 Target Size (Minimum) — https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

**Performance**
- web.dev — Web Vitals — https://web.dev/articles/vitals
- web.dev — Defining the Core Web Vitals thresholds — https://web.dev/articles/defining-core-web-vitals-thresholds
- Chrome — Eliminate render-blocking resources — https://developer.chrome.com/docs/lighthouse/performance/render-blocking-resources
- Chrome — Lighthouse moving to insight audits — https://developer.chrome.com/blog/moving-lighthouse-to-insights
- Chrome — What's new in Lighthouse 13 — https://developer.chrome.com/blog/lighthouse-13-0

**SEO + structured data**
- Google Search Central — Intro to structured data — https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
- Google Search Central — General structured data guidelines — https://developers.google.com/search/docs/appearance/structured-data/sd-policies
- Google Search Central — Core Web Vitals & search — https://developers.google.com/search/docs/appearance/core-web-vitals
- The Open Graph protocol — https://ogp.me/
- schema.org — https://schema.org/

**Correctness / runtime**
- web.dev — Fixing mixed content — https://web.dev/articles/fixing-mixed-content
- Next.js — React hydration error — https://nextjs.org/docs/messages/react-hydration-error
- MDN — Mixed content — https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content
