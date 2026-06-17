# Reliability / Performance & Privacy / Compliance — Test Catalog

> Provenance-first catalog per `RESEARCH-PROTOCOL.md`. Every row carries a Source
> name + URL surfaced by Perplexity (`sonar-pro`) and a standard reference where one
> exists. Two clearly separated domains: **A. Reliability / Performance-Engineering**
> and **B. Privacy / Compliance**. Raw retrieval trail and Gaps listed at the bottom.

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

## Unverified / needs a source

(None — every row above carries a Perplexity-surfaced source + URL.)

## [MODEL-SUGGESTED — confirm]

(None added — no rows were inserted from training knowledge beyond what the four raw
Perplexity responses surfaced. Items not yet researched are listed under Gaps below.)

## Gaps (blocked by disk-full / ENOSPC during research — needs a future Perplexity pass)

The disk filled mid-research, so these planned enumeration/completeness passes could NOT
be run (per orchestrator instruction, no new API calls were made when disk was freed).
Each needs a dedicated `sonar-pro` pass before rows are added:

- **Frontend / infra reliability checks** — Core Web Vitals (LCP/INP/CLS thresholds),
  Lighthouse performance audits, TTFB, HTTP/2-3 support, gzip/brotli compression,
  Cache-Control/ETag, CDN presence, render-blocking resources, page-weight budgets,
  third-party script perf impact, asset minification, health-check endpoints,
  retry-after on 429/503, keep-alive, slow-query detection, DB connection pooling.
  (A call `reliability-05` targeting this against web.dev/Lighthouse/Google SRE was
  submitted but failed to save due to ENOSPC; the raw file does not exist.)
- **PCI DSS v4.0 SAQ A per-requirement line items** — individual requirement IDs from
  the official PCI SSC SAQ A document (only category-level rows captured so far).
- **WCAG 2.2 success-criterion-level rows** for general site accessibility (vs the
  privacy-UI-specific accessibility rows already captured).
- **US state privacy laws beyond California** (VCDPA, CPA, CTDPA, etc.) — not queried.
- **Completeness "what's commonly missed" sweep** for both domains — not run.

## Raw evidence

- `raw/reliability-01.json` — Reliability/perf-engineering sources pass (ISTQB glossary+CT-PT, k6/Grafana, Principles of Chaos, Release It!, Hystrix, Resilience4j, Google SRE/SLO). HTTP 200.
- `raw/reliability-02.json` — Privacy/compliance sources pass (GDPR, EDPB consent + Opinion 5/2019, ePrivacy 2002/58/EC, CCPA/CPRA + CPPA regs, PCI DSS v4.0 + SAQ A, WCAG 2.2 + ADA/DOJ, GPC, DNT). HTTP 200.
- `raw/reliability-03.json` — Performance/load enumeration (ISTQB types + k6 metrics/scenarios). HTTP 200.
- `raw/reliability-04.json` — Resilience/chaos enumeration (Principles of Chaos + Google Cloud chaos + SRE: ~35 experiments across dependency, latency, failover, timeout, retry, circuit-breaker, rate-limit, bulkhead, degradation, DB/cache/DNS/partition failure, resource exhaustion, SLO/burn-rate, RTO/backup, idempotency). HTTP 200.

> NOTE (Truth Protocol): `reliability-05.json` (frontend/infra reliability) was submitted
> to Perplexity but the response FAILED to save because the disk filled (ENOSPC); that raw
> file does not exist. All rows above are sourced from the four saved raw JSON files only.
