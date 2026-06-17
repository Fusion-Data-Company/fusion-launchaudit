# Reliability / Performance & Privacy / Compliance — Test Catalog

> Provenance-first catalog per `RESEARCH-PROTOCOL.md`. Every row carries a Source
> name + URL (surfaced by Perplexity `sonar-pro` for R1-R106 / P1-P102, or by direct
> **WebFetch** for the commonly-missed sweep R107-R116 / P103-P110) and a standard
> reference where one exists. Two clearly separated domains: **A. Reliability /
> Performance-Engineering** and **B. Privacy / Compliance**. Raw retrieval trail (incl.
> the WebFetch evidence list) and Gaps listed at the bottom.

---

# A. Reliability / Performance-Engineering

## Sources used (Reliability)

| Source | Org | Covers | URL |
|---|---|---|---|
| Standard Glossary of Terms Used in Software Testing (v3.x/v2.2) | ISTQB | Canonical definitions of performance test types (load, stress, soak/endurance, spike, scalability, volume) | https://glossary.istqb.org |
| Certified Tester – Performance Testing (CT-PT) Syllabus | ISTQB | Performance test types, measures, process | https://istqb.org/certifications/certified-tester-performance-testing-ct-pt/ |
| CTFL Specialist – Performance Testing Syllabus (PDF) | ISTQB / BCS | Performance types, measures, test process | https://www.bcs.org/media/6352/swt-performance-testing-syllabus.pdf |
| k6 Documentation | Grafana Labs | Load/stress/soak/spike/scalability + metrics (VUs, RPS, percentiles, error rate, thresholds) | https://k6.io/docs |
| Principles of Chaos Engineering | principlesofchaos.org | Steady-state, hypothesis, blast radius, real-world failure injection | https://principlesofchaos.org |
| Getting started with chaos engineering | Google Cloud | Steady-state baseline, fault injection (VM delete, DB stop, latency, route delete), blast radius | https://cloud.google.com/blog/products/devops-sre/getting-started-with-chaos-engineering |
| Release It! (2nd ed.) — M. Nygard | Pragmatic Bookshelf | Circuit breaker, timeout, bulkhead, failover, rate-limit, retry patterns | https://pragprog.com/titles/mnee2/release-it-second-edition/ |
| Hystrix (Latency & Fault Tolerance) | Netflix | Circuit breaker, bulkhead/isolation, fallback, timeout patterns | https://github.com/Netflix/Hystrix |
| Resilience4j Documentation | Resilience4j project | CircuitBreaker, Retry, RateLimiter, Bulkhead, TimeLimiter behavioral contracts | https://resilience4j.readme.io |
| Site Reliability Engineering (SRE book) | Google | SLI, SLO, SLA, error budget definitions | https://sre.google/books/ |
| The Site Reliability Workbook | Google | Practical SLO/SLI/error-budget, canary, testing-in-prod | https://sre.google/books/ |
| SRE: Service Level Objectives | Google | User-centric SLIs, latency percentiles, error budgets, burn-rate alerting | https://sre.google/workbook/service-level-objectives/ |

## Tests (Reliability)

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable by LaunchAudit? |
|---|---|---|---|---|---|---|---|
| R1 | Performance (efficiency) testing | Overall performance efficiency of the component/system | Umbrella | ISTQB Glossary "performance testing" | ISTQB Glossary | https://glossary.istqb.org/en_US/term/performance-testing | Partial (synthetic harness) |
| R2 | Load testing | Behavior under expected & peak concurrent load/transactions | Load | ISTQB CT-PT / Glossary | ISTQB CT-PT Syllabus | https://istqb.org/certifications/certified-tester-performance-testing-ct-pt/ | Yes (k6/synthetic) |
| R3 | Stress testing | Behavior beyond peak load to failure; robustness, error handling, recovery | Stress | ISTQB CT-PT / Glossary | ISTQB CTFL-PT Syllabus | https://www.bcs.org/media/6352/swt-performance-testing-syllabus.pdf | Yes |
| R4 | Soak / endurance testing | Stability & resource use over long duration (leaks, degradation drift) | Soak/Endurance | ISTQB CT-PT | ISTQB CT-PT Syllabus | https://istqb.org/certifications/certified-tester-performance-testing-ct-pt/ | Yes |
| R5 | Spike testing | Behavior under sudden steep load increase then decrease | Spike | ISTQB CT-PT | ISTQB CTFL-PT Syllabus | https://www.bcs.org/media/6352/swt-performance-testing-syllabus.pdf | Yes |
| R6 | Scalability testing | Ability to scale up/out (users, data, nodes) while holding performance | Scalability | ISTQB CT-PT | ISTQB CT-PT Syllabus | https://istqb.org/certifications/certified-tester-performance-testing-ct-pt/ | Partial |
| R7 | Volume testing | Behavior under large data volumes (distinct from user load) | Volume | ISTQB CT-PT / Glossary | ISTQB CTFL-PT Syllabus | https://www.bcs.org/media/6352/swt-performance-testing-syllabus.pdf | Partial |
| R8 | Concurrency testing | Multiple simultaneous users/data access without contention faults | Concurrency | ISTQB CT-PT | ISTQB CT-PT Syllabus | https://istqb.org/certifications/certified-tester-performance-testing-ct-pt/ | Yes |
| R9 | Capacity testing | Max users/transactions sustainable while meeting objectives | Capacity | ISTQB CT-PT | ISTQB CTFL-PT Syllabus | https://www.bcs.org/media/6352/swt-performance-testing-syllabus.pdf | Yes |
| R10 | Static performance testing | Pre-execution review of perf requirements, DB schema, queries, stored procs | Static/pre-exec | ISTQB CT-PT material | ISTQB CT-PT Syllabus | https://istqb.org/certifications/certified-tester-performance-testing-ct-pt/ | Partial |
| R11 | Performance requirements review | Perf requirements complete, accurate, testable | Static/requirements | ISTQB CT-PT material | ISTQB CT-PT Syllabus | https://istqb.org/certifications/certified-tester-performance-testing-ct-pt/ | No |
| R12 | Performance risk review | Perf risks identified during planning/analysis | Static/risk | ISTQB CT-PT material | ISTQB CT-PT Syllabus | https://istqb.org/certifications/certified-tester-performance-testing-ct-pt/ | No |
| R13 | Response time measurement | Time to respond to a request | Metric | ISTQB perf measures | ISTQB CTFL-PT Syllabus | https://www.bcs.org/media/6352/swt-performance-testing-syllabus.pdf | Yes |
| R14 | Resource utilization | CPU/memory/related resource use under load | Metric | ISTQB perf measures | ISTQB CTFL-PT Syllabus | https://www.bcs.org/media/6352/swt-performance-testing-syllabus.pdf | Partial |
| R15 | Throughput / TPS / hits-per-sec | Work completed per unit time | Metric | ISTQB perf measures | ISTQB CTFL-PT Syllabus | https://www.bcs.org/media/6352/swt-performance-testing-syllabus.pdf | Yes |
| R16 | Percentile response times (p95/p99) | Tail latency under load | Metric/latency dist | k6 metric model | k6 Documentation | https://k6.io/docs | Yes |
| R17 | Error rate under load | Failed-request ratio while under load | Metric/reliability | k6 thresholds | k6 Documentation | https://k6.io/docs | Yes |
| R18 | Concurrent virtual users (VUs) | Behavior with N simultaneous simulated users | Load/concurrency | k6 VU model | k6 Documentation | https://k6.io/docs | Yes |
| R19 | Ramp-up / ramping profile | Behavior while load is gradually increased | Load/scenario | k6 scenarios | k6 Documentation | https://k6.io/docs | Yes |
| R20 | Smoke / baseline performance check | Basic perf characteristics validated after a change | Baseline | k6 test types | k6 Documentation | https://k6.io/docs | Yes |
| R21 | Sustained-load memory growth | Memory growth over long run (leak detection) | Soak/Endurance | k6 + soak goal | k6 Documentation | https://k6.io/docs | Partial |
| R22 | Autoscaling behavior | Scale out/in as load changes | Scalability/capacity | k6 + scalability goal | k6 Documentation | https://k6.io/docs | Partial |
| R23 | Breakpoint / failure threshold | Max load before unacceptable failure/crash | Stress/breakpoint | ISTQB stress def | ISTQB CT-PT Syllabus | https://istqb.org/certifications/certified-tester-performance-testing-ct-pt/ | Yes |
| R24 | Baseline vs benchmark comparison | Current perf vs established baseline (regression detection) | Benchmark/regression | k6 thresholds (practice) | k6 Documentation | https://k6.io/docs | Yes |
| R25 | Steady-state metric validation | Right steady-state SLIs identified & baseline measurable before chaos | Steady-state/observability | Principles of Chaos #1 | Principles of Chaos Engineering | https://principlesofchaos.org | Partial |
| R26 | Blast-radius containment dry-run | Scoping/abort controls limit experiment impact | Blast-radius/safety | Principles of Chaos; GCP guidance | Google Cloud Chaos | https://cloud.google.com/blog/products/devops-sre/getting-started-with-chaos-engineering | No |
| R27 | Critical dependency hard shutdown | App survives downstream service 5xx/refused without SLO collapse | Dependency failure | Principles of Chaos; GCP | Principles of Chaos Engineering | https://principlesofchaos.org | Partial |
| R28 | Dependency error-rate injection | Tolerate elevated 5xx from downstream without retry storm/cascade | Dependency failure | GCP chaos; SRE cascading failures | Google Cloud Chaos | https://cloud.google.com/blog/products/devops-sre/getting-started-with-chaos-engineering | Partial |
| R29 | Third-party credential/quota failure | Graceful handling of 401/403/429 from third-party APIs | External dependency | Principles of Chaos | Principles of Chaos Engineering | https://principlesofchaos.org | Partial |
| R30 | High-latency dependency injection | Timeouts respected; SLOs held when downstream slow | Latency injection | GCP chaos (latency) | Google Cloud Chaos | https://cloud.google.com/blog/products/devops-sre/getting-started-with-chaos-engineering | Partial |
| R31 | Frontdoor network latency injection | User-visible SLOs hold under higher RTT; CDN/LB behave | Latency/network | Principles of Chaos | Principles of Chaos Engineering | https://principlesofchaos.org | Partial |
| R32 | Single-instance termination (Chaos-Monkey) | Statelessness + auto-healing replaces instances within SLO | Instance failure | Principles of Chaos; GCP (delete VM) | Google Cloud Chaos | https://cloud.google.com/blog/products/devops-sre/getting-started-with-chaos-engineering | No |
| R33 | Single-zone failover test | Survive AZ loss: LB behavior, cross-zone replication, headroom | Zone failover | GCP chaos; AWS Well-Architected Reliability | Google Cloud Chaos | https://cloud.google.com/blog/products/devops-sre/getting-started-with-chaos-engineering | No |
| R34 | Regional failover / DR GameDay | Full stack fails over to another region within RTO/RPO | Region failover/DR | Google SRE DR | Site Reliability Engineering | https://sre.google/books/ | No |
| R35 | Client-side timeout enforcement | Bounded latencies; sane timeouts; fallback not infinite wait | Timeout testing | Release It! timeouts; SRE | Release It! | https://pragprog.com/titles/mnee2/release-it-second-edition/ | Partial |
| R36 | Timeout vs SLO sensitivity | Timeouts aligned with SLO latency budget | Timeout/SLO coupling | Google SRE SLO | SRE: Service Level Objectives | https://sre.google/workbook/service-level-objectives/ | No |
| R37 | Retry backoff & jitter under failure | Bounded retries w/ exponential backoff+jitter; no retry storm | Retry/backoff | Release It! retries; Resilience4j Retry | Resilience4j | https://resilience4j.readme.io | Partial |
| R38 | Idempotent operation retry test | Idempotent endpoints stay idempotent under retries (no dup side effects) | Idempotency/retry | Google SRE | Site Reliability Engineering | https://sre.google/books/ | Partial |
| R39 | Circuit-breaker threshold (trip/recover) | Breaker opens→half-open→closes correctly on error/latency thresholds | Circuit-breaker | Release It!; Hystrix; Resilience4j | Resilience4j | https://resilience4j.readme.io | Partial |
| R40 | Circuit-breaker graceful fallback | Degraded-but-acceptable behavior when breaker opens | Graceful degradation | Hystrix fallbacks; Release It! | Netflix Hystrix | https://github.com/Netflix/Hystrix | Partial |
| R41 | Ingress rate-limit enforcement | Per-IP/user/key throttling enforced; correct 429; no starvation | Rate-limit/throttling | Release It! rate-limit; Resilience4j RateLimiter | Resilience4j | https://resilience4j.readme.io | Yes |
| R42 | Downstream 429 handling | App backs off on 429 from dependency; no aggressive retry | Rate-limit/backpressure | Google SRE load shedding | Site Reliability Engineering | https://sre.google/books/ | Partial |
| R43 | Bulkhead resource isolation | One feature/tenant overuse can't starve others (separate pools/quotas) | Bulkhead/isolation | Release It!; Hystrix; Resilience4j Bulkhead | Resilience4j | https://resilience4j.readme.io | No |
| R44 | Noisy-neighbor tenant isolation | Misbehaving tenant isolated via per-tenant quotas/throttles | Bulkhead/multi-tenant | Google SRE | Site Reliability Engineering | https://sre.google/books/ | No |
| R45 | Non-critical feature degradation | Optional dependency failure hides widget vs failing whole page | Graceful degradation | Google SRE | Site Reliability Engineering | https://sre.google/books/ | Partial |
| R46 | Read-only mode under write-path failure | App switches to read-only when primary DB write path impaired | Graceful degradation | Google SRE | Site Reliability Engineering | https://sre.google/books/ | No |
| R47 | Database primary failover drill | Promote replica within RTO/RPO; app handles conn drop/role change | DB failover/HA | GCP chaos (stop DB); SRE | Google Cloud Chaos | https://cloud.google.com/blog/products/devops-sre/getting-started-with-chaos-engineering | No |
| R48 | Read-replica outage & staleness | Tolerate replica loss/staleness; reroute without overloading primary | DB availability | Google SRE | Site Reliability Engineering | https://sre.google/books/ | No |
| R49 | Transaction failure & compensation | Partial DB failure rolls back / compensates; no corruption/orphans | Data integrity | Google SRE | Site Reliability Engineering | https://sre.google/books/ | Partial |
| R50 | Cache cluster failure test | Cache unavailability tolerated; DB not overloaded; SLOs degrade controlled | Cache failure | Principles of Chaos; SRE | Principles of Chaos Engineering | https://principlesofchaos.org | Partial |
| R51 | Cache stampede / thundering herd | After flush/loss, no DB stampede (coalescing/locks/backoff) | Cache stampede | Google SRE | Site Reliability Engineering | https://sre.google/books/ | Partial |
| R52 | Internal DNS outage simulation | DNS SERVFAIL/NXDOMAIN/timeout handled; no indefinite block | DNS failure | Principles of Chaos; SRE | Principles of Chaos Engineering | https://principlesofchaos.org | Partial |
| R53 | External DNS misconfiguration | Wrong CNAME/expired records → controlled failure, no infinite retry | External DNS | Google SRE | Site Reliability Engineering | https://sre.google/books/ | Partial |
| R54 | Service-to-service network partition | Predictable behavior when subset can't reach a dependency (split-brain) | Network partition | Principles of Chaos; GCP (route delete) | Principles of Chaos Engineering | https://principlesofchaos.org | No |
| R55 | Cross-region network partition drill | Replication/leader election/routing handle regional partition cleanly | Network partition | Google SRE | Site Reliability Engineering | https://sre.google/books/ | No |
| R56 | CPU saturation experiment | CPU saturation surfaces via SLI; autoscale/load-shed; no undefined behavior | Resource exhaustion (CPU) | GCP chaos; Principles of Chaos | Google Cloud Chaos | https://cloud.google.com/blog/products/devops-sre/getting-started-with-chaos-engineering | Partial |
| R57 | Memory pressure / OOM kill | OOM observable; restart doesn't cascade; auto-recover or fail gracefully | Resource exhaustion (memory) | Principles of Chaos; SRE | Principles of Chaos Engineering | https://principlesofchaos.org | Partial |
| R58 | Disk-full / log-flooding | Out-of-disk detected/handled; no corruption; rotation/quota/alerts exist | Resource exhaustion (disk) | Principles of Chaos; SRE capacity | Principles of Chaos Engineering | https://principlesofchaos.org | Partial |
| R59 | SLO degradation observability | Chaos failures surface as SLO burn (SLI/SLO instrumented correctly) | SLI/SLO instrumentation | Google SRE; SLO guide | SRE: Service Level Objectives | https://sre.google/workbook/service-level-objectives/ | Partial |
| R60 | Error-budget burn-rate alert test | Multi-window/multi-burn-rate alerts fire when budget consumed | SLO alerting/burn-rate | Google SRE SLO/alerting | SRE: Service Level Objectives | https://sre.google/workbook/service-level-objectives/ | No |
| R61 | RTO verification GameDay | Full restore/failover within documented RTO after simulated outage | RTO/DR | Google SRE DR | The Site Reliability Workbook | https://sre.google/books/ | No |
| R62 | Full backup/restore drill | Backups valid, recent, restorable; restore meets RTO; data meets RPO | Backup/restore | Google SRE | The Site Reliability Workbook | https://sre.google/books/ | No |
| R63 | Partial data-loss recovery | Restore subset (customer/shard) + log replay without affecting others | Fine-grained restore/RPO | Google SRE | The Site Reliability Workbook | https://sre.google/books/ | No |
| R64 | Payment/order idempotency under retries | Business ops don't double-charge/duplicate under glitches+retries | Idempotency/business | Google SRE; Principles of Chaos | Site Reliability Engineering | https://sre.google/books/ | Partial |
| R65 | Message re-delivery / idempotent consumers | Consumers idempotent under at-least-once delivery (dups/out-of-order) | Idempotency/messaging | Google SRE | Site Reliability Engineering | https://sre.google/books/ | Partial |
| R66 | Peak-traffic + slow-dependency scenario | Combined load + degraded deps keeps core journeys within SLO | End-to-end chaos | Principles of Chaos; GCP | Google Cloud Chaos | https://cloud.google.com/blog/products/devops-sre/getting-started-with-chaos-engineering | Partial |
| R67 | Integrated DR & observability incident drill | Region/dep failure → alerts fire, runbooks, failover in RTO, good observability | End-to-end DR | Google SRE GameDays | The Site Reliability Workbook | https://sre.google/books/ | No |

### Reliability — Front-end & Infrastructure checks (live-URL automatable)

Added sources for this block: **web.dev / Lighthouse** (Google — Core Web Vitals, performance audits) https://web.dev ; **MDN** (Mozilla — HTTP headers/caching/negotiation) https://developer.mozilla.org ; **IETF RFCs** (HTTP/2 RFC 7540, HTTP/3 RFC 9114, QUIC RFC 9000, HTTP semantics RFC 9110, caching RFC 9111, conditional RFC 9110, TLS RFC 8446) https://www.rfc-editor.org ; **Kubernetes/Google Cloud** (liveness/readiness probes) https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/ .

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable by LaunchAudit? |
|---|---|---|---|---|---|---|---|
| R68 | LCP threshold | Largest Contentful Paint ≤2.5s good / 2.5-4s NI / >4s poor | Core Web Vitals | web.dev CWV LCP | web.dev | https://web.dev/articles/lcp | Yes |
| R69 | INP threshold | Interaction to Next Paint ≤200ms good / 200-500 NI / >500 poor | Core Web Vitals | web.dev CWV INP | web.dev | https://web.dev/articles/inp | Yes |
| R70 | CLS threshold | Cumulative Layout Shift ≤0.1 good / 0.1-0.25 NI / >0.25 poor | Core Web Vitals | web.dev CWV CLS | web.dev | https://web.dev/articles/cls | Yes |
| R71 | First Contentful Paint (FCP) | FCP timing vs Lighthouse scoring ranges | Loading perf | Lighthouse FCP | web.dev | https://web.dev/articles/fcp | Yes |
| R72 | Time To First Byte (TTFB) | Server response time within budget | Backend latency | Lighthouse "Reduce server response time" | web.dev | https://web.dev/articles/ttfb | Yes |
| R73 | Lighthouse performance score | Aggregate perf score ≥ configured threshold | Aggregate perf | Lighthouse scoring | web.dev | https://web.dev/articles/performance-scoring | Yes |
| R74 | Eliminate render-blocking resources | No CSS/JS in critical path blocking first paint | Loading optimization | Lighthouse audit | web.dev | https://web.dev/articles/render-blocking-resources | Yes |
| R75 | Minify CSS | CSS minified (no extra whitespace/comments) | Asset optimization | Lighthouse "Minify CSS" | web.dev | https://web.dev/articles/unminified-css | Yes |
| R76 | Minify JavaScript | JS bundles minified | Asset optimization | Lighthouse "Minify JavaScript" | web.dev | https://web.dev/articles/unminified-javascript | Yes |
| R77 | Reduce unused CSS | Flag excessive unused CSS rules | Code elimination | Lighthouse audit | web.dev | https://web.dev/articles/unused-css-rules | Yes |
| R78 | Reduce unused JavaScript | Flag unused JS bytes; suggest code-split/treeshake | Code elimination | Lighthouse audit | web.dev | https://web.dev/articles/unused-javascript | Yes |
| R79 | Minimize main-thread work | JS exec/style/layout within budget | Runtime perf | Lighthouse audit | web.dev | https://web.dev/articles/mainthread-work-breakdown | Yes |
| R80 | Avoid long tasks | No main-thread tasks >50ms harming INP/TBT | Runtime responsiveness | Lighthouse audit | web.dev | https://web.dev/articles/long-tasks-devtools | Yes |
| R81 | Enable text compression | HTML/CSS/JS/JSON served gzip or brotli via Content-Encoding | Compression | Lighthouse "Enable text compression" | web.dev | https://web.dev/articles/uses-text-compression | Yes |
| R82 | Serve images in next-gen formats | WebP/AVIF used where supported | Media optimization | Lighthouse audit | web.dev | https://web.dev/articles/uses-webp-images | Yes |
| R83 | Properly size images | Images not larger than rendered size; srcset/sizes used | Media optimization | Lighthouse audit | web.dev | https://web.dev/articles/uses-responsive-images | Yes |
| R84 | Efficiently encode images | Images compressed without quality loss | Media optimization | Lighthouse audit | web.dev | https://web.dev/articles/uses-optimized-images | Yes |
| R85 | Defer offscreen images (lazy-load) | Below-the-fold images lazy-loaded | Loading strategy | Lighthouse audit | web.dev | https://web.dev/articles/offscreen-images | Yes |
| R86 | Preload key requests | Critical early resources preloaded | Resource prioritization | Lighthouse audit | web.dev | https://web.dev/articles/uses-rel-preload | Yes |
| R87 | Avoid enormous network payloads | Total bytes under budget (Lighthouse flags >~4MB) | Page weight | Lighthouse audit | web.dev | https://web.dev/articles/total-byte-weight | Yes |
| R88 | Performance budget compliance | Custom budgets (LCP/FCP/TBT/JS size/image bytes) enforced | Perf governance | Lighthouse Budgets | web.dev | https://web.dev/articles/performance-budgets-101 | Yes |
| R89 | Reduce third-party code impact | Third-party scripts deferred/async; cost surfaced | Third-party impact | Lighthouse audit | web.dev | https://web.dev/articles/optimizing-content-efficiency-loading-third-party-javascript | Yes |
| R90 | HTTP/2 availability | Origin/CDN serves over HTTP/2 (h2 ALPN) | Protocol support | IETF RFC 7540 | IETF | https://www.rfc-editor.org/rfc/rfc7540 | Yes |
| R91 | HTTP/3 (QUIC) availability | Server/CDN supports HTTP/3 (h3 ALPN) | Protocol support | IETF RFC 9114 / RFC 9000 | IETF | https://www.rfc-editor.org/rfc/rfc9114 | Yes |
| R92 | HTTP keep-alive / connection reuse | Persistent connections reduce TCP/TLS handshakes | Transport efficiency | RFC 9110/9112 | MDN | https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Connection | Yes |
| R93 | Modern TLS version | HTTPS uses TLS 1.2+ with strong ciphers | Transport security | IETF RFC 8446 (TLS 1.3) | IETF | https://www.rfc-editor.org/rfc/rfc8446 | Yes |
| R94 | Cache-Control policy | Correct Cache-Control directives for HTML/static assets | HTTP caching | RFC 9111 | MDN | https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control | Yes |
| R95 | ETag conditional caching | ETag present; server returns 304 on If-None-Match | HTTP caching | RFC 9110 | MDN | https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag | Yes |
| R96 | Last-Modified / If-Modified-Since | Last-Modified set; 304 handled correctly | HTTP caching | RFC 9110 | MDN | https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Last-Modified | Yes |
| R97 | CDN presence & edge caching | Served via CDN; static assets edge-cached with s-maxage | Content delivery | RFC 9111 (shared caches) | web.dev | https://web.dev/articles/content-delivery-networks | Yes |
| R98 | Correct Vary headers | Vary: Accept-Encoding/Accept-Language keeps caches correct | Caching correctness | RFC 9110 | MDN | https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Vary | Yes |
| R99 | Resource hints (preconnect/dns-prefetch) | preconnect/dns-prefetch for critical cross-origin resources | Network optimization | Lighthouse "Preconnect" | web.dev | https://web.dev/articles/uses-rel-preconnect | Yes |
| R100 | HTTP uptime / availability monitoring | Synthetic checks return 2xx/3xx; track SLO error budget | Reliability monitoring | Google SRE SLI/SLO | Google SRE | https://sre.google/books/ | Yes |
| R101 | Health-check endpoints | /healthz, /readyz return 200 when healthy | Health checks | K8s liveness/readiness | Kubernetes | https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/ | Yes |
| R102 | Graceful 5xx handling | 5xx serves friendly page, no stack trace, no caching transient errors | Failure handling | Google SRE; MDN status codes | MDN | https://developer.mozilla.org/en-US/docs/Web/HTTP/Status | Yes |
| R103 | Retry-After on 429/503 | 429/503 include Retry-After (date or seconds) | Overload protection | RFC 9110 Retry-After | MDN | https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After | Yes |
| R104 | Streaming for large responses | Chunked/streaming reduces TTFB; progressive render | Transfer optimization | RFC 9112 chunked | MDN | https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Transfer-Encoding | Partial |
| R105 | Service worker offline resilience | SW caches static assets / offline fallback without harming freshness | Offline/resilience | Service Worker spec; web.dev | web.dev | https://web.dev/articles/service-worker-lifecycle | Partial |
| R106 | Safe retry semantics (GET/HEAD) | Idempotent methods retryable without side effects | HTTP semantics | RFC 9110 safe methods | MDN | https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods | Yes |

### Reliability — "commonly-missed" sweep (cold-start, pooling, N+1, clock, SIGTERM, backpressure, DNS, TLS, cache-poison, brownout)

Method = **WebFetch** (real URLs fetched 2026-06-17; replaces the un-runnable Perplexity
`reliability-09` sweep). Each row cites a source page actually retrieved; section/best-practice
refs quoted where the source provides one. URLs listed under Raw evidence.

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable by LaunchAudit? |
|---|---|---|---|---|---|---|---|
| R107 | Cold-start / serverless startup latency | First-request (cold) latency bounded; min-instances / startup-CPU-boost / trimmed deps reduce cold starts; instances not killed needlessly | Cold start | Cloud Run "startup time has impact on the latency of your service"; min-instances + startup CPU boost | Google Cloud Run – General tips | https://docs.cloud.google.com/run/docs/tips/general | Partial (cold-vs-warm TTFB delta synthetic) |
| R108 | DB connection-pool exhaustion | App reuses a bounded pool; leaked/unreturned connections detected; stays under server connection limit; FD exhaustion doesn't break health checks | Resource exhaustion (connections) | Cloud SQL "fewer connections reduces overhead and helps you stay under the connection limit"; SRE Ch.22 "File descriptors" exhaustion → failed health checks | Google Cloud SQL – Manage connections; Google SRE Book Ch.22 | https://docs.cloud.google.com/sql/docs/postgres/manage-connections | No |
| R109 | N+1 query detection | No repeated per-row queries in a loop; related data fetched in one round-trip (eager loading / select_related / prefetch_related) | Query efficiency | Django "a query that is executed in a loop … could end up doing many database queries, when only one was needed" → `select_related()`/`prefetch_related()` | Django docs – Database access optimization | https://docs.djangoproject.com/en/stable/topics/db/optimization/ | Partial (repeated-query pattern in network log) |
| R110 | Clock drift / time synchronization | Hosts NTP-synced; timestamp ordering doesn't break under cross-host clock skew (drift bounded / monotonic source) | Time sync | Spanner TrueTime: lagging clock could assign an earlier timestamp to a later transaction → consistency violation; bounded clock uncertainty | Google Cloud Spanner – TrueTime & external consistency | https://docs.cloud.google.com/spanner/docs/true-time-external-consistency | No |
| R111 | SIGTERM graceful draining | On termination, process stops accepting new work, drains in-flight requests within the grace period, then exits before SIGKILL | Graceful shutdown | K8s Pod lifecycle: default 30s `terminationGracePeriodSeconds`, SIGTERM → grace period → SIGKILL; Cloud Run "avoid system exits that … increase cold starts" | Kubernetes – Pod lifecycle (termination); Google Cloud Run tips | https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/ | No |
| R112 | Queue backpressure / backlog control | Async queues don't grow unbounded; message-age tracked; inbound throttled (inversely) proportional to backlog; stale messages sidelined | Backpressure | AWS Builders' Library: queues are bimodal; track message age not just errors; "scaling an inbound throttle limit (inversely) proportionally to backlog size"; sideline stale messages | AWS Builders' Library – Avoiding insurmountable queue backlogs | https://aws.amazon.com/builders-library/avoiding-insurmountable-queue-backlogs/ | No |
| R113 | DNS TTL handling | Records carry sane TTL; resolvers/clients honor TTL before re-resolving; TTL low enough for failover, high enough to avoid lookup storms | DNS caching | MDN: TTL "indicates the amount of time in seconds during which the resource can be cached"; expired record must be re-queried from authoritative server | MDN – TTL (glossary) | https://developer.mozilla.org/en-US/docs/Glossary/TTL | Partial (DNS TTL inspection) |
| R114 | TLS certificate-expiry monitoring | Served cert is currently valid (now within notBefore..notAfter); expiry tracked and renewed before notAfter | Cert lifecycle | RFC 5280 §4.1.2.5 Validity (notBefore/notAfter); §6.1.3 path validation requires current time within validity period | IETF RFC 5280 | https://www.rfc-editor.org/rfc/rfc5280 | Yes (read cert notAfter, alert on days-to-expiry) |
| R115 | CDN / shared-cache poisoning resistance | Unkeyed inputs can't poison a shared cache; cache key + correct Vary prevent serving an attacker-influenced response to other users; unsafe methods invalidate cache | Cache poisoning | PortSwigger: unkeyed inputs influencing the response → poisoned shared cache served to all; RFC 9111 §4.1 Vary cache-key correctness, §4.4 invalidation on unsafe methods | PortSwigger Web Security Academy – Web cache poisoning; IETF RFC 9111 | https://portswigger.net/web-security/web-cache-poisoning | Partial (unkeyed-header reflection probe) |
| R116 | Brownout / load-shedding behavior | Near overload, server sheds low-criticality load (503) and/or degrades gracefully (cached/less-accurate responses) rather than collapsing; client-side adaptive throttling | Load shedding | SRE Ch.21 "serve degraded responses"; client-side adaptive throttling; criticality tiers; Ch.22 "Load Shedding and Graceful Degradation" returns 503 near overload; AWS REL05-BP01 graceful degradation | Google SRE Book Ch.21 (Handling Overload) & Ch.22 (Addressing Cascading Failures); AWS Well-Architected REL05-BP01 | https://sre.google/sre-book/handling-overload/ | Partial (degraded-response / 503-under-load synthetic) |

---

# B. Privacy / Compliance

## Sources used (Privacy/Compliance)

| Source | Org | Covers | URL |
|---|---|---|---|
| GDPR — Regulation (EU) 2016/679 | EU (Parliament & Council) | Lawful basis, transparency, data-subject rights, consent, minimization, storage limitation, security | https://eur-lex.europa.eu/eli/reg/2016/679/oj |
| GDPR.eu compliance guide | GDPR.eu | Practitioner guide to GDPR articles/recitals | https://gdpr.eu |
| EDPB Guidelines 05/2020 on consent | European Data Protection Board | Valid consent UX: granular, freely given, specific, informed, unambiguous, withdrawable | https://www.edpb.europa.eu |
| EDPB Opinion 5/2019 (ePrivacy–GDPR interplay) | European Data Protection Board | Which rules govern cookies vs later processing | https://www.edpb.europa.eu/sites/default/files/files/file1/201905_edpb_opinion_eprivacydir_gdpr_interplay_en_0.pdf |
| ePrivacy Directive 2002/58/EC (as amended by 2009/136/EC) | EU | Cookie/consent (Art 5(3)), confidentiality, unsolicited marketing (Art 13) | https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32002L0058 |
| CCPA / CPRA (Cal. Civ. Code §§1798.100–1798.199) | State of California | Notice at collection, consumer rights, opt-out of sale/share, non-discrimination | https://leginfo.legislature.ca.gov |
| CCPA Regulations (CPRA) | California Privacy Protection Agency | Request flows, GPC recognition, dark-pattern avoidance | https://cppa.ca.gov/regulations/ |
| PCI DSS v4.0 | PCI Security Standards Council | Cardholder data protection, secure software, logging/monitoring, segmentation | https://www.pcisecuritystandards.org |
| PCI DSS SAQ A (v4.0) | PCI Security Standards Council | Scope for fully outsourced e-commerce (redirect/iFrame/hosted) | https://www.pcisecuritystandards.org |
| WCAG 2.2 | W3C / WAI | Perceivable/Operable/Understandable/Robust success criteria (A/AA/AAA) | https://www.w3.org/TR/WCAG22/ |
| ADA + DOJ web accessibility guidance | US DOJ / Congress | WCAG as de-facto legal benchmark for web accessibility (ADA Title II/III) | https://www.ada.gov/resources/web-guidance/ |
| Global Privacy Control (GPC) spec | GPC project | GPC signal detection (HTTP header / navigator property) | https://globalprivacycontrol.org/ |
| Tracking Preference Expression (DNT) Note | W3C | Do-Not-Track signal (legacy) | https://www.w3.org/TR/tracking-dnt/ |

## Tests (Privacy/Compliance)

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable by LaunchAudit? |
|---|---|---|---|---|---|---|---|
| P1 | Lawful basis present & documented | A valid lawful basis exists for each processing purpose | GDPR lawful basis | GDPR Art. 5–6 | GDPR (EU) 2016/679 | https://eur-lex.europa.eu/eli/reg/2016/679/oj | No |
| P2 | Transparent privacy notice content | Notice content/layering/timing per transparency rules | GDPR transparency | GDPR Art. 12–14 | GDPR (EU) 2016/679 | https://eur-lex.europa.eu/eli/reg/2016/679/oj | Partial (presence) |
| P3 | Privacy policy reachable & linked | Privacy policy present and linked from pages collecting PII | GDPR transparency | GDPR Art. 13–14 | GDPR.eu | https://gdpr.eu | Yes |
| P4 | Data-subject access (right of access) | UI/process to fulfill access requests (Art. 15) | DSR | GDPR Art. 15 | GDPR (EU) 2016/679 | https://eur-lex.europa.eu/eli/reg/2016/679/oj | Partial |
| P5 | Rectification / erasure / restriction | Rights to correct, delete, restrict implemented | DSR | GDPR Art. 16–18 | GDPR (EU) 2016/679 | https://eur-lex.europa.eu/eli/reg/2016/679/oj | Partial |
| P6 | Data portability | Export of subject data in portable form | DSR | GDPR Art. 20 | GDPR (EU) 2016/679 | https://eur-lex.europa.eu/eli/reg/2016/679/oj | Partial |
| P7 | Right to object / automated-decision rights | Objection + safeguards on automated decisions/profiling | DSR | GDPR Art. 21–22 | GDPR (EU) 2016/679 | https://eur-lex.europa.eu/eli/reg/2016/679/oj | No |
| P8 | Valid consent — affirmative act | Consent via clear affirmative act; no pre-ticked boxes/inactivity | Consent | GDPR Art. 7 + Recital 32 | GDPR (EU) 2016/679 | https://eur-lex.europa.eu/eli/reg/2016/679/oj | Partial |
| P9 | Consent granular & specific | Separate consent per purpose; freely given; not bundled | Consent UX | EDPB Guidelines 05/2020 | EDPB | https://www.edpb.europa.eu | Partial |
| P10 | Consent withdrawal as easy as giving | Withdraw mechanism as easy as the grant | Consent UX | EDPB Guidelines 05/2020 | EDPB | https://www.edpb.europa.eu | Partial |
| P11 | No forced consent / cookie wall | Access not conditioned on unnecessary consent | Consent UX | EDPB Guidelines 05/2020 | EDPB | https://www.edpb.europa.eu | Partial |
| P12 | No non-essential cookies before consent | Only strictly-necessary cookies set before consent given | Cookies | ePrivacy Art. 5(3) | ePrivacy Directive 2002/58/EC | https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32002L0058 | Yes |
| P13 | Cookie consent is informed | Clear/comprehensive info provided before storing/reading | Cookies | ePrivacy Art. 5(3) | ePrivacy Directive 2002/58/EC | https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32002L0058 | Partial |
| P14 | Reject as prominent as accept | User can refuse cookies as easily as accept | Cookies UX | ePrivacy Art. 5(3); EDPB consent | EDPB | https://www.edpb.europa.eu | Yes (banner inspection) |
| P15 | Cookie inventory / categorization | All cookies declared and categorized (necessary/analytics/marketing) | Cookies | ePrivacy Art. 5(3) | ePrivacy Directive 2002/58/EC | https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32002L0058 | Yes |
| P16 | Cookie rule scoping (ePrivacy vs GDPR) | Cookie storage under ePrivacy; later PII processing under GDPR | Cookies/scoping | EDPB Opinion 5/2019 | EDPB Opinion 5/2019 | https://www.edpb.europa.eu/sites/default/files/files/file1/201905_edpb_opinion_eprivacydir_gdpr_interplay_en_0.pdf | No |
| P17 | Marketing opt-in / consent evidence | Opt-in & evidence for marketing email/SMS tied to registration | Direct marketing | ePrivacy Art. 13 | ePrivacy Directive 2002/58/EC | https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32002L0058 | Partial |
| P18 | Confidentiality of communications | No unauthorized interception/storage of comms content/metadata | Comms confidentiality | ePrivacy Art. 5–9 | ePrivacy Directive 2002/58/EC | https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32002L0058 | No |
| P19 | Notice at collection (CCPA) | Categories collected, purposes, sold/shared, retention, rights disclosed | CCPA notice | CCPA §§1798.100–.110/.130 | CCPA/CPRA | https://leginfo.legislature.ca.gov | Partial |
| P20 | "Do Not Sell or Share My Personal Information" | Required opt-out link/flow present & functional | CCPA opt-out | CCPA/CPRA §1798.135 | CCPA/CPRA | https://leginfo.legislature.ca.gov | Yes |
| P21 | "Limit the Use of My Sensitive PI" | Sensitive-PI limitation link/flow present where required | CCPA opt-out | CPRA sensitive PI | CCPA/CPRA | https://leginfo.legislature.ca.gov | Yes |
| P22 | Consumer right-to-know / delete / correct | Request flows, verification, response timing implemented | CCPA rights | CCPA/CPRA | CCPA/CPRA | https://leginfo.legislature.ca.gov | Partial |
| P23 | Non-discrimination for rights exercise | No price/service penalty for exercising rights | CCPA non-discrim | CCPA §1798.125 | CCPA/CPRA | https://leginfo.legislature.ca.gov | No |
| P24 | GPC signal honored | Site reads GPC (HTTP header/navigator) → opt-out of sale/share state | GPC/opt-out | CPRA regs GPC recognition; GPC spec | CCPA Regulations | https://cppa.ca.gov/regulations/ | Yes |
| P25 | Third-party trackers respect opt-out | Trackers honor GPC/opt-out state | GPC/opt-out | CPRA regulations | CCPA Regulations | https://cppa.ca.gov/regulations/ | Partial |
| P26 | No dark patterns in opt-out flow | Opt-out UI free of dark patterns | CCPA UX | CPRA regulations | CCPA Regulations | https://cppa.ca.gov/regulations/ | Partial |
| P27 | GPC detection (technical) | Sec-GPC header / navigator.globalPrivacyControl observed & acted on | GPC technical | GPC spec | Global Privacy Control | https://globalprivacycontrol.org/ | Yes |
| P28 | DNT signal handling (legacy) | Whether site honors Do-Not-Track header as privacy posture | DNT (legacy) | W3C DNT Note | W3C Tracking Preference Expression | https://www.w3.org/TR/tracking-dnt/ | Yes |
| P29 | No PAN/sensitive auth data stored | Cardholder data not stored outside approved scope | PCI data protection | PCI DSS v4.0 Req. 3 | PCI DSS v4.0 | https://www.pcisecuritystandards.org | Partial |
| P30 | Secure transmission of card data | Cardholder data encrypted in transit | PCI transport | PCI DSS v4.0 Req. 4 | PCI DSS v4.0 | https://www.pcisecuritystandards.org | Yes (TLS check) |
| P31 | Secure software & vuln management | Secure coding, change mgmt, security testing of payment components | PCI secure dev | PCI DSS v4.0 Req. 6 | PCI DSS v4.0 | https://www.pcisecuritystandards.org | Partial |
| P32 | Payment logging & monitoring | Access logged, anomalies detected, controls tested | PCI logging | PCI DSS v4.0 Req. 10–11 | PCI DSS v4.0 | https://www.pcisecuritystandards.org | Partial |
| P33 | Logs exclude full PAN / SAD | Logs do not store full PAN or sensitive auth data | PCI logging | PCI DSS v4.0 Req. 3/10 | PCI DSS v4.0 | https://www.pcisecuritystandards.org | Partial |
| P34 | SAQ A scope confirmation | Site does not receive/process PAN; uses redirect/iFrame/hosted page | PCI scoping | PCI SAQ A v4.0 | PCI DSS SAQ A | https://www.pcisecuritystandards.org | Partial |
| P35 | No JS intercepting cardholder data | No page JS captures card data (keeps outsourced model out of scope) | PCI scoping | PCI SAQ A v4.0 | PCI DSS SAQ A | https://www.pcisecuritystandards.org | Partial |
| P36 | Consent UI keyboard accessible | Cookie banner/consent modal operable by keyboard | Accessibility | WCAG 2.2 (Operable) | WCAG 2.2 | https://www.w3.org/TR/WCAG22/ | Yes |
| P37 | Consent UI screen-reader friendly | Banners/forms exposed to assistive tech | Accessibility | WCAG 2.2 (Robust) | WCAG 2.2 | https://www.w3.org/TR/WCAG22/ | Partial |
| P38 | Not color-only in consent/rights UI | Info not conveyed by color alone | Accessibility | WCAG 2.2 1.4.1 | WCAG 2.2 | https://www.w3.org/TR/WCAG22/ | Partial |
| P39 | Privacy/rights forms WCAG 2.2 AA | DSAR/preference-center/consent flows meet Level AA | Accessibility (legal) | WCAG 2.2 AA via ADA | ADA / DOJ guidance | https://www.ada.gov/resources/web-guidance/ | Partial |
| P40 | Storage limitation / retention schedule | PII (incl. logs/analytics/backups) kept no longer than necessary; auto-delete | Retention | GDPR Art. 5(1)(e) | GDPR (EU) 2016/679 | https://eur-lex.europa.eu/eli/reg/2016/679/oj | Partial |
| P41 | Data minimization | Only necessary personal data collected; defaults minimal | Minimization | GDPR Art. 5(1)(c) | GDPR (EU) 2016/679 | https://eur-lex.europa.eu/eli/reg/2016/679/oj | Partial |
| P42 | Data-protection by design/default | Privacy settings not pre-maxed; minimal data on by default | Privacy by design | GDPR Art. 25; EDPB guidelines | EDPB | https://www.edpb.europa.eu | No |
| P43 | No PII leakage in URLs/referrers | URLs/referrers/analytics don't leak personal data to third parties | PII leakage | GDPR Art. 5(1)(f), 32 | GDPR (EU) 2016/679 | https://eur-lex.europa.eu/eli/reg/2016/679/oj | Yes |
| P44 | No PII in error messages/logs | Error pages/logs don't expose personal data in clear text | PII leakage | GDPR Art. 5(1)(f), 32 | GDPR (EU) 2016/679 | https://eur-lex.europa.eu/eli/reg/2016/679/oj | Partial |
| P45 | Security of processing (TOMs) | Appropriate technical/organizational measures protect PII | Security | GDPR Art. 32 | GDPR (EU) 2016/679 | https://eur-lex.europa.eu/eli/reg/2016/679/oj | Partial |
| P46 | Records of processing / DPIA presence | RoPA + DPIA for high-risk processing documented | Accountability | GDPR Art. 30, 35–36 | GDPR (EU) 2016/679 | https://eur-lex.europa.eu/eli/reg/2016/679/oj | No |

### PCI DSS v4.0 / v4.0.1 SAQ A — per-requirement line items

Source: **PCI DSS v4.0 SAQ A** (PCI SSC) https://listings.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-A.pdf and the **PCI SSC v4.0.1 SAQ A update announcement** https://blog.pcisecuritystandards.org/important-updates-announced-for-merchants-validating-to-self-assessment-questionnaire-a . Applies to fully-outsourced card-not-present e-commerce merchants (redirect / iFrame / hosted payment page).

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable by LaunchAudit? |
|---|---|---|---|---|---|---|---|
| P47 | SAQ A eligibility met | Only CNP txns; all account-data functions outsourced to validated TPSP; no electronic CHD stored | Scope/eligibility | PCI SAQ A v4.0 eligibility | PCI DSS SAQ A | https://listings.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-A.pdf | Partial |
| P48 | Change vendor defaults | Default passwords/parameters changed on in-scope web server (redirect/iframe host) | System config | PCI DSS Req. 2.1 | PCI DSS SAQ A | https://listings.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-A.pdf | No |
| P49 | Secure system configuration | In-scope systems hardened to industry standards; only necessary services enabled | Hardening | PCI DSS Req. 2.2.x | PCI DSS SAQ A | https://listings.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-A.pdf | No |
| P50 | No SAD stored after authorization | No full track / CVV / PIN stored (incl. paper) | Data protection | PCI DSS Req. 3.2 | PCI DSS SAQ A | https://listings.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-A.pdf | No |
| P51 | PAN masked on display | PAN truncated/masked on any merchant-controlled paper reports/receipts | Data protection | PCI DSS Req. 3.3 | PCI DSS SAQ A | https://listings.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-A.pdf | No |
| P52 | Secure storage of paper PAN | Paper CHD physically protected; retention/destruction processes exist | Data lifecycle | PCI DSS Req. 3.4.x | PCI DSS SAQ A | https://listings.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-A.pdf | No |
| P53 | Strong crypto for CHD transmission | Strong crypto/TLS for any merchant-controlled CHD transmission (often N/A but must confirm) | Secure transmission | PCI DSS Req. 4.2.1 | PCI DSS SAQ A | https://listings.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-A.pdf | Yes (TLS check) |
| P54 | Timely security patching | In-scope web servers patched; critical patches within one month | Patch mgmt | PCI DSS Req. 6.2 | PCI DSS SAQ A | https://listings.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-A.pdf | No |
| P55 | Secure SDLC / change control | Custom in-scope web app code developed securely w/ change control | Secure dev | PCI DSS Req. 6.3.x | PCI DSS SAQ A | https://listings.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-A.pdf | No |
| P56 | Payment-page script security | Payment-page scripts inventoried, authorized, integrity-protected (v4.0 SAQ A; removed in v4.0.1) | E-commerce script integrity | PCI DSS Req. 6.4.3 (v4.0) | PCI DSS SAQ A | https://blog.pcisecuritystandards.org/important-updates-announced-for-merchants-validating-to-self-assessment-questionnaire-a | Partial |
| P57 | Payment-page tamper detection | Change-and-tamper detection on payment page HTTP headers/content (v4.0 SAQ A; removed in v4.0.1) | E-commerce monitoring | PCI DSS Req. 11.6.1 (v4.0) | PCI DSS SAQ A | https://blog.pcisecuritystandards.org/important-updates-announced-for-merchants-validating-to-self-assessment-questionnaire-a | Partial |
| P58 | Script-attack-resilience eligibility (v4.0.1) | Embedded-iframe merchants confirm site not susceptible to payment-page script attacks (or TPSP confirms) | E-commerce eligibility | PCI SAQ A v4.0.1 new criterion | PCI DSS SAQ A | https://blog.pcisecuritystandards.org/important-updates-announced-for-merchants-validating-to-self-assessment-questionnaire-a | Partial |
| P59 | Unique user IDs | All users of in-scope systems have unique IDs; no shared interactive logins | Identity | PCI DSS Req. 8.2.x | PCI DSS SAQ A | https://listings.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-A.pdf | No |
| P60 | Strong authentication credentials | Passwords meet complexity/length/lockout requirements | Auth strength | PCI DSS Req. 8.3.x | PCI DSS SAQ A | https://listings.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-A.pdf | No |
| P61 | Physical security of paper CHD | Paper CHD in secure/locked storage; secure transport & destruction | Physical security | PCI DSS Req. 9.5–9.8 | PCI DSS SAQ A | https://listings.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-A.pdf | No |
| P62 | External vulnerability scanning (ASV) | In-scope external web servers ASV-scanned quarterly & after changes | Vuln mgmt | PCI DSS Req. 11.2.x | PCI DSS SAQ A | https://listings.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-A.pdf | Partial |
| P63 | Information security policy | Documented infosec policy, in use, known to relevant personnel | Governance | PCI DSS Req. 12.1 | PCI DSS SAQ A | https://listings.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-A.pdf | No |
| P64 | TPSP management | List of TPSPs, written agreements w/ PCI responsibilities, compliance monitoring | Third-party mgmt | PCI DSS Req. 12.8 | PCI DSS SAQ A | https://listings.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-A.pdf | No |
| P65 | Incident response plan | Documented IR plan covering CHD compromise, roles, reporting to brands/acquirers | Incident response | PCI DSS Req. 12.10 | PCI DSS SAQ A | https://listings.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-A.pdf | No |

### US state privacy laws beyond California (VCDPA / CPA / CTDPA / UCPA)

Sources: **Virginia VCDPA** (Va. Code Title 59.1 Ch. 52.1) https://law.lis.virginia.gov/vacode/title59.1/chapter52.1/ ; **Colorado CPA** (C.R.S. §§6-1-1301 et seq.) https://leg.colorado.gov ; **Connecticut CTDPA** (Conn. Gen. Stat. Ch. 743dd) https://www.cga.ct.gov/current/pub/chap_743dd.htm ; **Utah UCPA** (Utah Code Title 13 Ch. 61) https://le.utah.gov/xcode/Title13/Chapter61/13-61.html .

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable by LaunchAudit? |
|---|---|---|---|---|---|---|---|
| P66 | Privacy notice publicly available (state) | Reasonably accessible, clear, meaningful privacy notice w/o login | Notice | VCDPA §59.1-578; CPA §6-1-1308; CTDPA §42-521; UCPA §13-61-302 | VA/CO/CT/UT statutes | https://law.lis.virginia.gov/vacode/59.1-578/ | Yes |
| P67 | Notice lists categories of data processed | Notice enumerates categories of personal data | Notice content | VCDPA §59.1-578.A.1; CPA §6-1-1308(1)(a); CTDPA §42-521(a)(1); UCPA §13-61-302(1)(a) | VA/CO/CT/UT statutes | https://law.lis.virginia.gov/vacode/59.1-578/ | Partial |
| P68 | Notice states processing purposes | Notice explains purposes of processing | Notice content | VCDPA §59.1-578.A.2; CPA §6-1-1308(1)(b); CTDPA §42-521(a)(2); UCPA §13-61-302(1)(b) | VA/CO/CT/UT statutes | https://law.lis.virginia.gov/vacode/59.1-578/ | Partial |
| P69 | Notice describes rights & how to exercise | Lists consumer rights + at least one submission method (+appeal for VA/CO/CT) | Rights disclosure | VCDPA §59.1-578.A.3; CPA §6-1-1308(1)(c); CTDPA §42-521(a)(3); UCPA §13-61-302(1)(c) | VA/CO/CT/UT statutes | https://law.lis.virginia.gov/vacode/59.1-578/ | Partial |
| P70 | Notice lists data shared & third-party categories | Discloses categories of data shared and categories of third parties | Notice content | VCDPA §59.1-578.A.4-5; CPA §6-1-1308(1)(d); CTDPA §42-521(a)(4-5); UCPA §13-61-302(1)(d-e) | VA/CO/CT/UT statutes | https://law.lis.virginia.gov/vacode/59.1-578/ | Partial |
| P71 | Notice discloses sale/targeted-ad/profiling + opt-out | Discloses sale/targeted advertising/profiling and how to opt out | Opt-out disclosure | VCDPA §59.1-577/578; CPA §6-1-1306/1308; CTDPA §42-518/521; UCPA §13-61-302(2) | VA/CO/CT/UT statutes | https://www.cga.ct.gov/current/pub/chap_743dd.htm | Partial |
| P72 | Web-accessible rights request mechanism | Conspicuous secure means to submit access/delete/correct requests | Rights mechanism | VCDPA §59.1-577.B; CPA §6-1-1306(1)(b); CTDPA §42-518(b); UCPA §13-61-203 | VA/CO/CT/UT statutes | https://law.lis.virginia.gov/vacode/59.1-577/ | Yes |
| P73 | Appeal mechanism for denied requests | Method to appeal denied requests disclosed (VA/CO/CT; not Utah) | Appeals | VCDPA §59.1-577.E; CPA §6-1-1306(3)(a); CTDPA §42-518(e) | VA/CO/CT statutes | https://law.lis.virginia.gov/vacode/59.1-577/ | Partial |
| P74 | Opt-out mechanism for targeted ad/sale/profiling | Clear conspicuous opt-out method ("Your Privacy Choices"/"Do Not Sell") works | Opt-out | VCDPA §59.1-577.A.4-6; CPA §6-1-1306(1)(a)(III); CTDPA §42-518(a)(5); UCPA §13-61-203(2) | VA/CO/CT/UT statutes | https://www.cga.ct.gov/current/pub/chap_743dd.htm | Yes |
| P75 | Universal Opt-Out Mechanism honored (CO, CT) | Site detects & honors UOOM/GPC for CO & CT users (REQUIRED CO/CT; NOT VA/UT) | UOOM | CPA §6-1-1313; CTDPA §42-522(b) | CO/CT statutes | https://www.cga.ct.gov/current/pub/chap_743dd.htm#sec_42-522 | Yes |
| P76 | Opt-IN consent for sensitive data (VA/CO/CT) | Explicit affirmative opt-in before sensitive-data processing; no pre-tick | Sensitive data | VCDPA §59.1-578.A.6; CPA §6-1-1308(7); CTDPA §42-520(b)(4) | VA/CO/CT statutes | https://law.lis.virginia.gov/vacode/59.1-578/ | Partial |
| P77 | Notice + opt-OUT for sensitive data (Utah) | Clear notice + opportunity to opt out of sensitive-data processing (UCPA opt-out model) | Sensitive data | UCPA §13-61-302(3) | Utah UCPA | https://le.utah.gov/xcode/Title13/Chapter61/13-61-S302.html | Partial |
| P78 | Non-discrimination statement | Notice states no discrimination for exercising rights (loyalty-program carve-out) | Non-discrimination | VCDPA §59.1-578.D; CPA §6-1-1308(4-5); CTDPA §42-521(c); UCPA §13-61-301(2) | VA/CO/CT/UT statutes | https://law.lis.virginia.gov/vacode/59.1-578/ | Partial |
| P79 | Teen (13-16/17) opt-in for targeted ad/sale | Opt-in consent for teen targeted advertising/sale where required (CO/CT/VA) | Children/teens | CTDPA §42-520(b)(5); CPA §6-1-1308(7)(b); VCDPA §59.1-577 | VA/CO/CT statutes | https://www.cga.ct.gov/current/pub/chap_743dd.htm | Partial |

### Cookie-consent banner specifics (EDPB / ePrivacy / CJEU / DPA guidance)

Sources: **EDPB Guidelines 05/2020 on consent** https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf ; **EDPB Cookie Banner Taskforce report (2023)** https://www.edpb.europa.eu/system/files/2023-01/edpb_20230118_report_cookie_banner_taskforce_en.pdf ; **ePrivacy Directive Art. 5(3)** https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32002L0058 ; **CJEU Planet49 C-673/17** https://curia.europa.eu/juris/liste.jsf?num=C-673/17 ; **GDPR Art. 7** https://eur-lex.europa.eu/eli/reg/2016/679/oj .

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable by LaunchAudit? |
|---|---|---|---|---|---|---|---|
| P80 | No non-essential cookies before consent | Clean profile: no non-essential cookies/identifiers set pre-consent; appear after Accept | Prior consent | ePrivacy Art. 5(3); EDPB 05/2020 §79-81 | EDPB 05/2020 | https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf | Yes |
| P81 | No third-party tags/pixels before consent | No requests to known third-party tracker domains pre-consent | Prior consent | ePrivacy Art. 5(3); EDPB 05/2020 §17-25 | EDPB 05/2020 | https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf | Yes |
| P82 | First-layer "Reject all" present | Reject/Refuse all visible on first layer, same view as Accept all | Choice symmetry | EDPB Cookie Banner Taskforce | EDPB Taskforce report | https://www.edpb.europa.eu/system/files/2023-01/edpb_20230118_report_cookie_banner_taskforce_en.pdf | Yes |
| P83 | Reject as easy/prominent as accept | Reject all same layer, similar size/contrast, ≤ same clicks as Accept | Dark patterns | EDPB Taskforce §3.1.4; EDPB 05/2020 §19-21 | EDPB Taskforce report | https://www.edpb.europa.eu/system/files/2023-01/edpb_20230118_report_cookie_banner_taskforce_en.pdf | Yes |
| P84 | No pre-ticked consent boxes (Planet49) | Non-essential toggles/checkboxes off by default; no `checked` attr | Affirmative action | CJEU Planet49 C-673/17; GDPR Recital 32; EDPB 05/2020 §86 | CJEU Planet49 | https://curia.europa.eu/juris/liste.jsf?num=C-673/17 | Yes |
| P85 | Granular per-purpose toggles | Separate toggles per purpose (analytics/marketing/personalization) | Specific consent | EDPB 05/2020 §25-34 | EDPB 05/2020 | https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf | Yes |
| P86 | No bundling of distinct purposes | Non-essential purposes not irreversibly bundled into one toggle | Anti-bundling | EDPB 05/2020 §26-30 | EDPB 05/2020 | https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf | Partial |
| P87 | No consent via scrolling/continued browsing | Cookies don't activate on scroll/keypress/navigation w/o explicit control | Affirmative action | EDPB 05/2020 §86 | EDPB 05/2020 | https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf | Yes |
| P88 | No cookie wall blocking access | Core content not gated solely behind consent to non-essential cookies | Conditionality | EDPB 05/2020 §39-41 | EDPB 05/2020 | https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf | Yes |
| P89 | Persistent withdrawal control | Persistent "Cookie settings"/"Manage cookies" link on all pages re-opens consent UI | Withdrawal | GDPR Art. 7(3); EDPB 05/2020 §73-75 | GDPR / EDPB 05/2020 | https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf | Yes |
| P90 | Withdrawal disables tracking | After withdrawal, non-essential cookies deleted/ineffective; no new tracking | Withdrawal effectiveness | EDPB 05/2020 §74-75 | EDPB 05/2020 | https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf | Yes |
| P91 | Consent expiry / re-prompt | Consent not indefinite; re-prompt after reasonable expiry (CNIL ~6mo ref) | Consent validity | CNIL cookie recommendations; EDPB 05/2020 §4 | EDPB 05/2020 / CNIL | https://www.cnil.fr/en/cookies-and-other-trackers | Partial |
| P92 | No visual nudging (color/size) | Accept not made far more salient than Reject (contrast/size thresholds) | Dark patterns | EDPB Taskforce §3.1.4; EDPB 05/2020 §18-21 | EDPB Taskforce report | https://www.edpb.europa.eu/system/files/2023-01/edpb_20230118_report_cookie_banner_taskforce_en.pdf | Yes |
| P93 | No misleading "consent mandatory" wording | Text doesn't imply service unusable without accepting non-essential cookies | Dark patterns | EDPB 05/2020 §39-41 | EDPB 05/2020 | https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf | Partial |
| P94 | Close ("X") not treated as consent | Clicking X/Close does not set consent=true or fire non-essential cookies | Dark patterns | EDPB Taskforce; EDPB 05/2020 §85-86 | EDPB Taskforce report | https://www.edpb.europa.eu/system/files/2023-01/edpb_20230118_report_cookie_banner_taskforce_en.pdf | Yes |
| P95 | Clear info before consent (first layer) | First layer states cookie use, purposes, third parties, link to policy | Informed consent | ePrivacy Art. 5(3); EDPB 05/2020 §3.2 | EDPB 05/2020 | https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf | Yes |
| P96 | Easy access to detailed cookie policy | Visible "Cookie policy"/"Learn more" link to full cookie/purpose/retention list | Layered info | EDPB 05/2020; ePrivacy Art. 5(3) | EDPB 05/2020 | https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf | Yes |
| P97 | Persistent consent record stored | Consent status+date/version stored (cookie/localStorage); demonstrable | Accountability | GDPR Art. 7(1); EDPB 05/2020 §3.5 | EDPB 05/2020 | https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf | Yes |
| P98 | Consent record matches granular choices | Stored consent string (TCF/JSON) matches toggles; cookies consistent | Purpose limitation | GDPR Art. 5(1)(b),(2); EDPB 05/2020 §3.5 | EDPB 05/2020 | https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf | Yes |
| P99 | Prior reject choice respected | Stored "reject all" not silently flipped to accept on later visits | Fairness | GDPR Art. 5; EDPB 05/2020 §3.3, 3.5 | EDPB 05/2020 | https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf | Yes |
| P100 | Consent requires explicit interaction | Non-essential cookies only after explicit click/tap/keyboard activation | Unambiguous action | GDPR Art. 4(11), Recital 32; EDPB 05/2020 §86 | EDPB 05/2020 | https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf | Yes |
| P101 | No banner bypass via iframes/subdomains | Scripts in iframes/subdomains don't set non-essential cookies pre-consent | Technical enforcement | ePrivacy Art. 5(3); EDPB 05/2020 §17-25 | EDPB 05/2020 | https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf | Yes |
| P102 | No geo-weakening for EU users | EU IP/locale gets opt-in model (no non-essential cookies by default) | Territorial scope | GDPR Art. 3; EDPB 05/2020 scope | EDPB 05/2020 | https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf | Yes |

### Privacy — "commonly-missed" sweep (DSR SLA, TCF string, COPPA, breach timing, log retention, IP anonymization, pixel consent, session-replay masking)

Method = **WebFetch** (real URLs fetched 2026-06-17; replaces the un-runnable Perplexity
`reliability-09` sweep). Each row cites a source page actually retrieved, with the statute
article/section quoted where one exists. URLs listed under Raw evidence.

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable by LaunchAudit? |
|---|---|---|---|---|---|---|---|
| P103 | Data-subject-request SLA timer | DSR (access/erasure/etc.) answered "without undue delay and in any event within one month"; extendable by two further months for complex/numerous requests with notice | DSR timing | GDPR Art. 12(3) — one-month response, +2-month extension | GDPR Art. 12 (gdpr-info) | https://gdpr-info.eu/art-12-gdpr/ | No (process/SLA, not a live-URL check) |
| P104 | IAB TCF consent-string validity | If a TCF CMP is present, a valid TC String is produced/stored and vendor/purpose signals are well-formed per the Global Vendor List format | Consent signaling | IAB Europe TCF — "Transparency and Consent (TC) String with Global Vendor List Format"; standardises informing users, choices, and respecting consent | IAB Europe – Transparency & Consent Framework | https://iabeurope.eu/transparency-consent-framework/ | Partial (detect CMP + parse `__tcfapi` TC String) |
| P105 | COPPA — children's data (under 13) | Service directed to children obtains verifiable parental consent before collecting personal info from a child under 13; posts notice of what's collected/used/disclosed | Children's privacy | 15 U.S.C. §6502 — unlawful to collect from a child without verifiable parental consent + notice; "child" = under 13 | US Code 15 §6502 (Cornell LII) | https://www.law.cornell.edu/uscode/text/15/6502 | No |
| P106 | Breach-notification readiness (timing) | Process exists to notify the supervisory authority ≤72h of awareness (Art 33) and affected data subjects without undue delay where high risk (Art 34) | Breach notification | GDPR Art. 33 (≤72h to authority) + Art. 34 (high-risk → notify subjects; exceptions: encryption, mitigation, disproportionate effort) | GDPR Art. 33 & 34 (gdpr-info) | https://gdpr-info.eu/art-33-gdpr/ | No |
| P107 | Server-log / PII retention limit | Personal data in server logs/analytics/backups kept no longer than necessary; retention schedule + auto-deletion; backups also bounded | Storage limitation | GDPR Art. 5(1)(e) — kept "for no longer than is necessary"; even backup copies fall under storage limitation | GDPR Art. 5 (gdpr-info) | https://gdpr-info.eu/art-5-gdpr/ | No |
| P108 | Analytics IP anonymization | Analytics either masks/truncates IP before storage or does not log IP at all (so the full IP never persists) | IP anonymization | Google Analytics: UA truncates last octet (IPv4)/last 80 bits (IPv6) "before any storage or processing"; GA4 does not log/store IP | Google Analytics Help – IP masking/anonymization | https://support.google.com/analytics/answer/2763052 | Partial (detect analytics tag + anonymize flag/GA4) |
| P109 | Tracking-pixel / non-cookie tracker consent | Tracking pixels/web beacons/scripts that store or read info on the device are gated behind consent like cookies (technology-neutral), not fired pre-consent | Prior consent (non-cookie) | ePrivacy Art. 5(3) consent for storing/accessing info on terminal equipment (tech-neutral); EDPB Opinion 5/2019 & Cookie Banner Taskforce treat trackers beyond cookies alike. gdpr.eu: consent before any non-strictly-necessary tracking | gdpr.eu – Cookies (+ ePrivacy Art 5(3) / EDPB, already cited above) | https://gdpr.eu/cookies/ | Partial (pre-consent third-party pixel/beacon request detection) |
| P110 | Session-replay PII masking | Session-replay/heatmap tools mask form inputs and sensitive content client-side; masked content never sent to the vendor; password/input fields masked in all modes | Session replay masking | MS Clarity: masks sensitive content by default, "never captures anything that is masked or sent over the wire"; input boxes masked in all modes; Strict/Balanced/Relaxed modes | Microsoft Clarity docs – Masking content | https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-masking | Partial (detect replay script + check masking config) |

## Unverified / needs a source

(None — every row above carries a Perplexity-surfaced or WebFetch-verified source + URL.)

## [MODEL-SUGGESTED — confirm]

(None added — no rows were inserted from training knowledge beyond what the four raw
Perplexity responses surfaced. Items not yet researched are listed under Gaps below.)

## Gaps (remaining — needs a future Perplexity pass)

The gap-fill passes (reliability-05 through reliability-08) closed the four largest gaps
(frontend/infra reliability R68-R106; PCI SAQ A line items P47-P65; US state privacy
P66-P79; cookie-consent specifics P80-P102). The "commonly-missed" sweep was then closed
via **WebFetch** (method substitute for the un-runnable Perplexity `reliability-09`),
adding R107-R116 (reliability) and P103-P110 (privacy) — see those blocks above. Remaining
open items:

- ~~**Completeness "what's commonly missed" sweep**~~ — CLOSED 2026-06-17 via WebFetch
  (Perplexity was out of credits, so real source URLs were fetched directly instead).
  Reliability: cold-start (R107), connection-pool exhaustion (R108), N+1 detection (R109),
  clock drift (R110), SIGTERM graceful draining (R111), queue backpressure (R112), DNS TTL
  (R113), TLS cert-expiry (R114), CDN cache-poisoning (R115), brownout/load-shedding (R116).
  Privacy: DSR SLA timer (P103), IAB TCF consent string (P104), COPPA (P105), breach-
  notification timing (P106), server-log PII retention (P107), analytics IP anonymization
  (P108), tracking-pixel consent (P109), session-replay PII masking (P110).
- **Still un-sourced from this sweep:** *log-volume cost blowups* (reliability) and
  *cross-border SCC disclosure* (privacy) — not added; no authoritative URL was fetched for
  either, so they remain flagged rather than invented.
- **WCAG 2.2 success-criterion-level rows** for general site accessibility (vs the
  privacy-UI-specific accessibility rows already captured P36-P39) — still not enumerated.

## Raw evidence

- `raw/reliability-01.json` — Reliability/perf-engineering sources pass (ISTQB glossary+CT-PT, k6/Grafana, Principles of Chaos, Release It!, Hystrix, Resilience4j, Google SRE/SLO). HTTP 200.
- `raw/reliability-02.json` — Privacy/compliance sources pass (GDPR, EDPB consent + Opinion 5/2019, ePrivacy 2002/58/EC, CCPA/CPRA + CPPA regs, PCI DSS v4.0 + SAQ A, WCAG 2.2 + ADA/DOJ, GPC, DNT). HTTP 200.
- `raw/reliability-03.json` — Performance/load enumeration (ISTQB types + k6 metrics/scenarios). HTTP 200.
- `raw/reliability-04.json` — Resilience/chaos enumeration (Principles of Chaos + Google Cloud chaos + SRE: ~35 experiments). HTTP 200.
- `raw/reliability-05.json` — Front-end & infrastructure reliability enumeration (web.dev/Lighthouse Core Web Vitals + audits, MDN/IETF HTTP-2/3/caching/compression, Kubernetes health checks, Google SRE uptime). HTTP 200. → rows R68-R106.
- `raw/reliability-06.json` — PCI DSS v4.0 / v4.0.1 SAQ A per-requirement line items (PCI SSC SAQ A PDF + v4.0.1 announcement; incl. 6.4.3/11.6.1/12.3.1 removal and new script-attack eligibility). HTTP 200. → rows P47-P65.
- `raw/reliability-07.json` — US state privacy laws beyond California (Virginia VCDPA, Colorado CPA, Connecticut CTDPA, Utah UCPA; statute citations; UOOM required CO/CT only; sensitive-data opt-in VA/CO/CT vs opt-out UT). HTTP 200. → rows P66-P79.
- `raw/reliability-08.json` — Cookie-consent banner specifics (EDPB Guidelines 05/2020, EDPB Cookie Banner Taskforce 2023, ePrivacy Art 5(3), CJEU Planet49, GDPR Art 7; 24 testable banner checks). HTTP 200. → rows P80-P102.

### Commonly-missed sweep — WebFetch evidence (2026-06-17)

Method = **WebFetch** (no `raw/*.json`; the Perplexity `reliability-09` call was unavailable
— HTTP 401 `insufficient_quota`). Each URL below was fetched live and quoted in the rows it
backs. Memory-Palace auto-capture stored each fetched page under
`~/.claude/projects/-Users-robertyeager/memory/` (webfetch-*.md, pending_review).

Reliability (→ R107-R116):
- Google Cloud Run – General tips (cold start, min-instances, startup CPU boost, SIGTERM) — https://docs.cloud.google.com/run/docs/tips/general — HTTP 200 (after 301 from cloud.google.com). → R107, R111.
- Google Cloud SQL – Manage connections (pool exhaustion, connection limit, leaked connections) — https://docs.cloud.google.com/sql/docs/postgres/manage-connections — HTTP 200 (after 301). → R108.
- Google SRE Book Ch.22 – Addressing Cascading Failures (file-descriptor exhaustion, queue mgmt, load shedding, retry amplification) — https://sre.google/sre-book/addressing-cascading-failures/ — HTTP 200. → R108, R112, R116.
- Django docs – Database access optimization (N+1, select_related/prefetch_related, queries in loops) — https://docs.djangoproject.com/en/stable/topics/db/optimization/ — HTTP 200. → R109.
- Google Cloud Spanner – TrueTime & external consistency (clock drift, timestamp ordering, bounded uncertainty) — https://docs.cloud.google.com/spanner/docs/true-time-external-consistency — HTTP 200. → R110.
- Kubernetes – Pod lifecycle / termination (SIGTERM, 30s grace period, SIGKILL) — https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/ — HTTP 200 (termination-flow detail partially truncated; grace-period + signal sequence captured). → R111.
- AWS Builders' Library – Avoiding insurmountable queue backlogs (bimodal queues, message-age metric, inbound throttle ∝ backlog, sidelining) — https://aws.amazon.com/builders-library/avoiding-insurmountable-queue-backlogs/ — HTTP 200. → R112.
- AWS Builders' Library – Timeouts, retries, and backoff with jitter (retry amplification 243x, jitter, token bucket) — https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/ — HTTP 200. → supports R112/R116 (retry-storm context).
- MDN – TTL glossary (DNS/HTTP cache TTL seconds, re-query on expiry) — https://developer.mozilla.org/en-US/docs/Glossary/TTL — HTTP 200. → R113.
- IETF RFC 5280 (§4.1.2.5 Validity notBefore/notAfter; §6.1.3 path validation within validity) — https://www.rfc-editor.org/rfc/rfc5280 — HTTP 200. → R114.
- IETF RFC 9111 (§4.1 Vary cache-key; §4.4 invalidation on unsafe methods; freshness) — https://www.rfc-editor.org/rfc/rfc9111 — HTTP 200. → R115.
- PortSwigger Web Security Academy – Web cache poisoning (unkeyed inputs, cache key, Vary, defenses) — https://portswigger.net/web-security/web-cache-poisoning — HTTP 200. → R115.
- Google SRE Book Ch.21 – Handling Overload (degraded responses, client-side adaptive throttling, criticality tiers) — https://sre.google/sre-book/handling-overload/ — HTTP 200. → R116.
- AWS Well-Architected Reliability – REL05-BP01 graceful degradation (soft dependencies, circuit breaker, queue buffering) — https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_mitigate_interaction_failure_graceful_degradation.html — HTTP 200. → R116.

Privacy (→ P103-P110):
- GDPR Art. 12 (gdpr-info) — DSR one-month / +2-month response — https://gdpr-info.eu/art-12-gdpr/ — HTTP 200. → P103.
- IAB Europe – Transparency & Consent Framework (TC String / Global Vendor List) — https://iabeurope.eu/transparency-consent-framework/ — HTTP 200. → P104.
- US Code 15 §6502 (Cornell LII) — COPPA verifiable parental consent + notice, child = under 13 — https://www.law.cornell.edu/uscode/text/15/6502 — HTTP 200. → P105.
- GDPR Art. 33 (gdpr-info) — ≤72h breach notification to authority — https://gdpr-info.eu/art-33-gdpr/ — HTTP 200. → P106.
- GDPR Art. 34 (gdpr-info) — breach notification to data subjects (high risk) + exceptions — https://gdpr-info.eu/art-34-gdpr/ — HTTP 200. → P106.
- GDPR Art. 5 (gdpr-info) — Art 5(1)(e) storage limitation incl. backups — https://gdpr-info.eu/art-5-gdpr/ — HTTP 200. → P107.
- Google Analytics Help – IP masking/anonymization (UA truncation before storage; GA4 no IP logged) — https://support.google.com/analytics/answer/2763052 — HTTP 200. → P108.
- gdpr.eu – Cookies (consent before non-strictly-necessary tracking) — https://gdpr.eu/cookies/ — HTTP 200. Note: page is cookie-specific; technology-neutral basis for pixels/beacons rests on ePrivacy Art 5(3) + EDPB Opinion 5/2019 (already cited in the Privacy sources table). → P109.
- Microsoft Clarity docs – Masking content (masks by default, never sent over the wire, input boxes masked in all modes, Strict/Balanced/Relaxed) — https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-masking — HTTP 200. → P110.

Fetches attempted but unusable (NOT used as sources): ftc.gov COPPA pages (HTTP 403 ×2 → COPPA sourced from 15 U.S.C. §6502 at Cornell instead); ecfr.gov 16 CFR Part 312 (302 → unblock captcha); ico.org.uk PECR cookies guidance (HTTP 403); eur-lex.europa.eu GDPR consolidated text and ePrivacy 32002L0058 (returned blank — JS-rendered → GDPR sourced from gdpr-info per-article pages; ePrivacy Art 5(3) basis retained from the existing Privacy sources table); web.dev TTFB (fetched but does not cover cold starts → cold start sourced from Cloud Run instead).

> NOTE (Truth Protocol): The completeness "commonly missed" sweep originally planned as
> Perplexity `reliability-09` could NOT be run that way — Perplexity returned HTTP 401
> `insufficient_quota`. It was instead completed on 2026-06-17 via **WebFetch** against the
> real URLs listed directly above; no `reliability-09.json` exists. Rows R1-R106 and P1-P102
> remain sourced from the eight saved raw JSON files (01-08); rows R107-R116 and P103-P110
> are sourced from the live WebFetch evidence above. Nothing was added from training
> knowledge; items without a fetchable authoritative source (log-volume cost blowups,
> cross-border SCC disclosure) were left flagged in Gaps, not invented.
