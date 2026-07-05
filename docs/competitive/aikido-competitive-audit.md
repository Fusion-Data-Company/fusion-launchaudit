# Competitive Audit — Aikido Security (aikido.dev) vs. 80/20 Launch Audit

_Researched 2026-06-22 from Aikido's own site/docs + third-party reviews (sources at bottom). Every capability below is cited; nothing is assumed._

## TL;DR — the strategic verdict

Aikido is **not the same product** as 80/20 Launch Audit. Aikido is a paid, cloud‑hosted
**ASPM** (Application Security Posture Management) platform — "code to cloud," nine
security scanners in one SaaS, ~$300+/mo. 80/20 is a **free, local, in‑your‑agent
launch‑readiness auditor** whose wedge is **authorization depth (real DAST with sessions)
+ launch breadth (a11y, SEO, Core Web Vitals, content integrity, voice‑agent config).**

So the play is **not** to become Aikido (that loses our wedge). The play is:

1. **Adopt the two table‑stakes security checks every dev now expects and Aikido leads with — SCA (dependency CVEs) and secrets scanning.** Both are repo‑side, both wrap free OSS engines, both fit our existing repo‑scan pattern. Without these we look thin next to Aikido on a feature checklist.
2. **Defend and loudly market the wedge Aikido has nothing for** — launch‑readiness (a11y/SEO/CWV/content/voice), deep multi‑role authorization DAST, free + local + no‑SaaS, and the Truth Protocol (our honest answer to their "reachability").
3. **Explicitly do NOT chase** CSPM, container image scanning, cloud runtime firewall, or a full SAST platform — different product, infinite scope, and not what a vibecoder shipping a web app needs pre‑launch.

---

## 1. What Aikido actually is

**Positioning:** "Unified Security Platform from Code to Runtime." All‑in‑one ASPM that
bundles **nine scanners** into one SaaS so teams don't stitch together point tools.

**The nine scanners:**

| # | Scanner | What it does |
|---|---|---|
| 1 | **SCA** (Software Composition Analysis) | Known‑vuln/CVE monitoring of dependencies; SBOM generation |
| 2 | **SAST** (Static Application Security Testing) | Source‑code vuln patterns — SQLi, XSS, buffer overflow, etc. |
| 3 | **DAST / Surface Monitoring** | Drives the running app/APIs; SQLi/XSS/CSRF, auth issues, server/API misconfig; **dangling‑DNS / dead‑subdomain** detection; daily, gentle, non‑destructive |
| 4 | **Container scanning** | Vulns in container images (system packages) |
| 5 | **IaC scanning** | Terraform, CloudFormation, Kubernetes misconfigs |
| 6 | **CSPM** | Cloud security posture / misconfigs / attack paths |
| 7 | **Secrets detection** | Leaked API keys, passwords, certs, tokens across repo + git history |
| 8 | **License compliance** | Dependency license risk |
| 9 | **Surface‑area / malware monitoring** | External attack surface; malicious packages |

**How it runs:** clones repos into ephemeral throwaway containers, scans (~1–5 min),
destroys the container. IDE plugin scans on every file open/save. DAST runs **daily** and
only alerts on **new** findings.

**Engines under the hood (this is the important part — they're mostly free OSS):**

- **SAST** → a fork of **Semgrep CE** (the vendor‑neutral "Opengrep" effort Aikido co‑maintains).
- **SCA + containers** → **Trivy**, with **Syft** for SBOMs.
- **Secrets** → **"BetterLeaks,"** built by the creator of **Gitleaks**.
- So Aikido's moat is **orchestration + UX + triage**, not proprietary scan tech. We can wrap the same free engines.

**Two real differentiators (and our existing answers):**

- **Reachability analysis / "AI AutoTriage"** — claims **95% fewer false‑positive alerts** by checking whether a vulnerable function is actually called. → **Our parallel: the Truth Protocol** (watchdog re‑verification + honest `product_bug | needs_verification | …` classification). Same promise — "don't cry wolf" — different mechanism. We should frame ours this way.
- **AI AutoFix** — generates remediation **pull requests** into your SCM, manual or daily auto. → **Our parallel: repair packets / fix prompts + the audit‑and‑fix loop** (`claude-code/` skill). We hand the fix to the agent the dev already drives instead of opening PRs from a SaaS.

**Pricing/ratings (context):** ~3–5× cheaper than Snyk for full coverage; 4.9/5 Gartner
Peer Insights (43 reviews). It's winning on "all‑in‑one + cheap + low‑noise."

---

## 2. Honest map — Aikido vs. 80/20 today

**Where 80/20 already competes or wins:**

- **Authorization depth** — we drive the app with real sessions and test admin/RBAC, **IDOR/object‑authz**, **BFLA/mutation‑authz**, **mass‑assignment**, anon **write‑authz**. Aikido's DAST is deliberately "gentle / API‑surface." Our authz wedge is real and deeper for the pre‑launch question.
- **Security headers / TLS‑HSTS / CORS / cookie attributes / injection** — already built (`security.ts`, `tls-hsts.ts`, `cors.ts`, `cookie-security.ts`, `injection.ts`).
- **Launch‑readiness breadth Aikido does NOT do at all** — accessibility (axe WCAG), SEO/structured data, Core Web Vitals, content‑integrity (fake/placeholder/`undefined` on the page), conversion funnel, **ElevenLabs voice‑agent config**. This is our blue ocean; Aikido is pure security.
- **Free, local, in‑your‑agent, no SaaS, no data leaves the machine** — vs. a $300+/mo hosted platform that clones your repo to their cloud.

**Where Aikido leads and we have a gap (the build list):**

| Aikido capability | 80/20 today | Gap severity |
|---|---|---|
| **SCA — dependency CVEs + SBOM** | none (we scan the repo but don't check deps vs. CVEs) | **CRITICAL — table stakes** |
| **Secrets in repo + git history** | only runtime `/.env` exposure check | **HIGH** |
| **License compliance** | none | medium |
| **Outdated/abandoned deps** | none | medium |
| **Dangling DNS / dead‑subdomain** | none | medium |
| **SAST code patterns** | none (we're DAST, not a code scanner) | medium (scope‑aware) |
| **IaC / CI config misconfig** | none | low‑medium |
| Container scanning / CSPM / cloud firewall | none | **out of scope — do not chase** |

---

## 3. Prioritized implementation list (what to build, with the free engine + our pattern)

Each item follows the established detector pattern (CLAUDE.md): new `src/lib/generators/<x>.ts`
→ (executor action if needed) → `runner/classify.ts` branch → wire into `card-generator.ts`
→ `*.test.ts`. All of these are **repo‑aware, no new SaaS, no paid API.**

### P1 — Table stakes (build first; this is what makes us look complete next to Aikido)

1. **SCA: dependency CVE scanner + SBOM** — `generators/sca.ts`, category `dependency_cve`.
   - Read the lockfile already available from `repo-scanner.ts` (`package-lock.json` / `pnpm-lock.yaml` / `yarn.lock`), resolve `name@version`, and batch‑query **OSV.dev** (`https://api.osv.dev/v1/querybatch` — free, no key, the same DB Trivy uses) for known vulns. Emit one finding per affected package with the CVE/GHSA id + fixed version as evidence. Generate a CycloneDX SBOM as an artifact.
   - **Honesty:** direct deps with a known CVE and an available fix = `product_bug` (high confidence, CVE id is hard evidence). Transitive‑only or no‑fix‑available = `needs_verification` (mirrors Aikido's reachability caveat without overclaiming).
   - _Why first:_ it's the #1 thing Aikido (and Snyk) lead with, every dev expects it, and we already have the lockfile in hand.

2. **Secrets scan — tracked files + git history** — `generators/secrets-scan.ts`, category `secret_exposure`.
   - If `gitleaks` is on PATH, shell out to it (it's the engine Aikido's secrets product is built on); otherwise fall back to a curated high‑signal regex set (AWS akia, GitHub `ghp_`/`github_pat_`, Stripe `sk_live_`, Google API, private‑key PEM blocks, generic high‑entropy `*_API_KEY=` in tracked files). Also flag a **committed `.env`** and a **missing `.gitignore` entry** for `.env*`.
   - **Honesty:** a live‑looking key in a tracked file = `product_bug`; an entropy‑only hit = `needs_verification`. (We already preach "no secrets in tracked files" — this enforces it on the user's repo.)

### P2 — High‑value, on‑wedge

3. **License compliance** — extend `sca.ts` (or `generators/licenses.ts`), category `license_risk`. From the resolved dependency tree, flag copyleft (GPL/AGPL/SSPL) and **unknown/missing** licenses for a project that ships as a product. `needs_verification` (legal judgment), with the offending package + license as evidence.

4. **Outdated / abandoned / deprecated dependencies** — `generators/dep-freshness.ts`, category `dependency_stale`. Compare locked versions to the npm registry `latest` + the `deprecated` flag; flag majors behind or explicitly deprecated packages. Advisory (`needs_verification`).

5. **Dangling DNS / dead external resource** (DAST) — extend the crawler/`security` set, category `supply_chain`. For the deployed target, resolve external `<script src>` / `<link>` origins and referenced subdomains; flag dead/NXDOMAIN/parked hosts (the dangling‑subdomain takeover + dead‑dependency‑CDN risk Aikido surfaces). Browser/HTTP, no repo needed.

### P3 — Breadth (optional, scope‑aware — don't let it eat the wedge)

6. **Light SAST pass** — `generators/sast-lite.ts`, category `code_pattern`. Either wrap **Opengrep/Semgrep** if installed (free, same engine Aikido forks) with a small curated ruleset, or ship a tight regex ruleset for our stack: `dangerouslySetInnerHTML` without sanitize, `eval(`/`new Function(` on request data, string‑concatenated SQL, `child_process.exec(`+ user input, `Math.random()` used for tokens/secrets. Keep it **`needs_verification`** by default — static patterns over‑flag, and over‑claiming would violate the Truth Protocol.

7. **IaC / CI‑config misconfig (lite)** — `generators/config-misconfig.ts`, category `iac_misconfig`. For the actual stack: `Dockerfile` (runs as root, `:latest` base), GitHub Actions (over‑broad `permissions:`, `pull_request_target` + checkout of PR head = the classic supply‑chain footgun), `vercel.json`/`next.config` (secrets in client config, missing headers — partly covered already).

8. **Malware / typosquat / install‑script** flag — extend `sca.ts`. Flag dependencies with `postinstall` scripts and recently‑published low‑download look‑alikes of popular packages (dependency‑confusion / typosquat). Niche; `needs_verification`.

---

## 4. Counter‑positioning — defend the wedge (don't just copy)

- **Lead the README/landing with what Aikido can't do:** "Aikido tells you if your *code* is secure. 80/20 tells you if your *app is ready to launch* — security **and** the 80% AI skips: access control on the unhappy paths, accessibility, SEO, Core Web Vitals, fake‑data, and voice‑agent config — free, in the agent you already pay for, nothing leaves your machine."
- **Frame the Truth Protocol as our reachability/anti‑noise story** — Aikido markets "95% fewer false positives via reachability." We market "every pass is independently re‑verified; every finding is classified for honesty — the score is the truth, not a hopeful guess." Same buyer pain, and ours needs no cloud.
- **Frame repair packets as our AutoFix** — they open PRs from a SaaS; we hand a paste‑ready fix to the coding agent the dev is already driving.
- **Do NOT build:** CSPM, container image scanning, cloud runtime firewall (their "Zen"), or a full proprietary SAST platform. That's a different company. Adopt SCA + secrets, keep the launch wedge, win on free + local + breadth.

## 5. One‑line roadmap delta

Add **SCA (OSV) + secrets (gitleaks)** now → we match the table‑stakes checkbox Aikido
wins on, for $0, on our existing repo‑scan rails — then keep out‑building them on the
launch‑readiness wedge they don't even play in.

---

## Sources

- [Aikido — Unified Security Platform (home)](https://www.aikido.dev/)
- [Aikido — Platform](https://www.aikido.dev/platform)
- [Aikido — SAST & DAST use case](https://www.aikido.dev/use-cases/sast-dast)
- [Aikido — Static Code Analysis (SAST)](https://www.aikido.dev/code/static-code-analysis-sast)
- [Aikido — Surface Monitoring / DAST](https://www.aikido.dev/attack/surface-monitoring-dast)
- [Aikido — Open Source](https://www.aikido.dev/open-source)
- [Aikido — AutoFix overview](https://help.aikido.dev/aikido-autofix/overview-aikido-autofix)
- [Aikido — Real‑time IDE scanning](https://help.aikido.dev/ai-and-dev-tools/ide-plugins-overview/features/real-time-code-scanning-in-ide)
- [Aikido vs Snyk — appsecsanta](https://appsecsanta.com/aspm-tools/aikido-vs-snyk)
- [Endor Labs — Aikido alternatives (engines under the hood)](https://www.endorlabs.com/learn/aikido-alternatives)
- [Syft vs Trivy — appsecsanta](https://appsecsanta.com/sca-tools/syft-vs-trivy)
- [The CTO Club — Aikido review 2026](https://thectoclub.com/tools/aikido-security-review/)

---

# Part II — The rest of the field: top 5 platforms (deep audits)

_Selected best-in-class platforms across every dimension 80/20 could adopt from — SCA, SAST, secrets, DAST, code-quality — excluding Aikido (Part I) and TestSprite (already collected). Researched 2026-06-22 by a parallel research team; every claim is cited inline._

## 6. Consolidated build roadmap — what to take from all six

_Merged + de-duplicated across all six audits. Every item is a **free** engine/API, fits the established detector pattern (`generators/<x>.ts` → executor `ExecStep`, add to `NO_BROWSER_ACTIONS` if pure HTTP/CLI → `classify.ts` branch → wire into `card-generator.ts` → `*.test.ts`), and keeps the Truth Protocol._

**Verified during this pass:** OSV.dev `POST /v1/querybatch` works with **no API key** and returns real advisories — `lodash@4.17.4` → **10** GHSA/CVE ids. `runner/repo-scanner.ts` already parses `package.json` deps + detects the lockfile/manager. **SCA is unblocked today.**

**✅ SHIPPED (autonomous build pass — all `npm test`-green, Truth-Protocol-honest):**
- **P0.1 SCA** — `generators/dependencies.ts` (`dependency_cve`): npm-lock parse → OSV.dev batch → finding per affected pkg, direct/transitive split. **+ reachability-lite** (`collectImportedNames`: grep app source for actual imports → imported = `product_bug`, transitive/unused = `needs_verification`). **+ license compliance** (`readDirectLicenses` → `dependency_license`: copyleft/unknown flagged `needs_verification`, no network).
- **P0.2 Secrets** — `generators/secrets-scan.ts` (`secret_exposure`): gitleaks-pattern repo scan, entropy gate, redaction, committed-`.env`/missing-`.gitignore` flags.
- **P1.5 Header depth** — `security.ts`: **CSP** present + no `unsafe-inline`/`unsafe-eval`, **COOP** recommended → `needs_verification` (defense-in-depth, not over-claimed). New `expectHeaderRecommended` / `expectHeaderExcludesTokens` http assertions.
- **P1.5 Info disclosure** — `generators/info-disclosure.ts` (`info_disclosure`): regex over the *served body* for AWS/Google/Slack/Stripe keys + private-key blocks (→ `product_bug`) and JWT / internal IP / S3 URL (→ `needs_verification`). New `expectBodyExcludesRegex` assertion.
- **P2.6 Launch Gate** — `render-report.ts` `launchGate()`: literal PASS/FAIL over the security/authz wedge above the 0–100 score (builder report banner + client one-pager + CLI JSON). Fails only on *confirmed* security/authz bugs (never on `needs_verification`).
- **Live tracking** — runner opens the hub + creates the campaign at scan START, streams phase progress (`/api/runner/progress`), UI polls + renders a live banner; the new categories render in the dashboard (`categoryLabels` + a "Supply chain & secrets" coverage group).

Still open (gated on an external tool — graceful-skip wraps): P1.3 ZAP baseline, P1.4 Semgrep/Opengrep SAST, P2.8 Checkov IaC, P2.10 Trivy container.

### P0 — build now (every security competitor leads with these; both are free + repo-side)

1. **SCA — dependency CVE scan + reachability-lite + licenses** (`generators/dependencies.ts`, category `dependency_cve`).
   - Parse the lockfile (exact `name@version`) → batch **OSV.dev** (`/v1/querybatch`, no key) → one finding per affected package w/ GHSA/CVE id + fixed version as evidence. Emit a CycloneDX SBOM artifact.
   - **Reachability-lite** (Snyk/Semgrep's headline): after a hit, grep the repo for an actual `import`/`require` of the package → "present **and imported**" vs "transitive/unused." Imported + fix-available → `product_bug`; unused/transitive → `needs_verification` (honest; mirrors their reachable/unreachable framing without claiming a real call graph).
   - **License compliance** (Snyk/Semgrep): SPDX license per package from the npm registry (free) → flag copyleft (GPL/AGPL/SSPL) + unknown → `needs_verification`.
   - **Prioritization** (Snyk's risk score → open equivalents): enrich each CVE with free **EPSS** (`api.first.org/data/v1/epss`) + **CISA KEV** → sort/label in `render-report.ts`.

2. **Secrets — repo + git history + validity** (`generators/secrets-scan.ts`, category `secret_exposure`).
   - Core pattern set = **gitleaks** `gitleaks.toml` (MIT; AWS `AKIA`, GitHub `ghp_/github_pat_`, Stripe `sk_live_`, Slack `xox*`, Google API, PEM keys, JWTs). Walk tracked files **and** `git log -p` history.
   - **Two-stage filter** (GitGuardian's model): a generic high-entropy hit is gated behind a known prefix + Shannon entropy (~3.5–4.5 bits/char) → `needs_verification`; a known-format key → `product_bug`.
   - **Exclusion list verbatim from GitGuardian** in the repo scanner: skip binaries + `node_modules/`, `vendors?/`, `.sops*`; de-prioritize `html/css/md/lock` — prevents false positives on `fixtures/shop-fixed`.
   - **Validity check** (GitGuardian's differentiator) for a curated read-only set — GitHub (`GET /user`), Stripe (`GET /v1/account`), Slack (`auth.test`), OpenAI, SendGrid: a **live** key → `product_bug` (critical); unreachable → `needs_verification`. New no-browser `ExecStep checkSecretValidity`.
   - Flag a **committed `.env`** + **missing `.gitignore`** entry.

### P1 — high value

3. **Wrap OWASP ZAP baseline scan** (free, Docker, passive-only, CI-safe) as an optional `runBaselineScan` `ExecStep` (gate on `docker`; skip gracefully if absent). Ingest JSON → imports ZAP's ~165-rule passive catalog (each alert carries CWE + OWASP-Top-10/WSTG tags → real provenance). High/Medium → candidate `product_bug`; Low/Info → `needs_verification`. Passive-only dodges the SPA-shell trap.
4. **Optional Semgrep/Opengrep SAST pass** (free OSS engine + free rule packs) as a no-browser `ExecStep`: `semgrep scan --config p/owasp-top-ten --config p/secrets --config p/javascript --sarif` → parse SARIF. Ship a small bundled custom ruleset for our wedge (routes w/o RBAC middleware, missing server-side authz guards, `dangerouslySetInnerHTML`, exposed admin handlers). Use **Opengrep** (LGPL fork) for free cross-function taint. Licensing: run community/Trail-of-Bits/GitLab rules; fetch Semgrep's own packs via `--config p/...` at runtime rather than vendoring them.
5. **Deepen the header/cookie/info-disclosure packs** with ZAP's granular sub-rules — re-implement natively (no browser): **CSP depth** (wildcard/`unsafe-inline`/`unsafe-eval`/report-only-only), **HSTS variants**, **CORP/COEP/COOP**, cookie `SameSite=None`/invalid/loosely-scoped, and **secret/PII-in-response** regexes (CC, email, IBAN, hash, S3 URL, private IP). Extend `security.ts` + `content-integrity.ts`.

### P2 — framing + breadth

6. **"Launch Gate" PASS/FAIL verdict** (Sonar's signature quality-gate) over the 0–100 score in `render-report.ts`: e.g. _zero `product_bug`s in security/authz + readiness ≥ N_ → a literal PASS/FAIL above the number.
7. **"Clean as you code" changed-files-only mode** (Sonar) — score the diff since a baseline so re-runs on big legacy apps aren't all-red.
8. **IaC / CI-config misconfig** via **Checkov** (free) — Dockerfile, GitHub Actions (`pull_request_target` + PR-head checkout, over-broad `permissions:`), Terraform/K8s. `generators/iac.ts`.
9. **Vulnerable-JS-library / Retire.js** (ZAP) — client-side SCA on loaded scripts.
10. **Container scan** via **Trivy/Grype** (free, same OSV/GHSA data) if a `Dockerfile` is present, with Snyk's "suggest a slimmer base image" move.

### Keep NOT building (defend the wedge)
CSPM, cloud runtime firewall, full proprietary SAST/taint platform, registry posture. The killer positioning line: **OWASP ZAP's own docs state automated scanners _cannot_ find broken access control / logical authz** — that is exactly our admin-RBAC / IDOR / BFLA / write-authz wedge. Everyone markets "reachability / fewer false positives" → that's our **Truth Protocol**, already built. And free + local + in-your-agent beats every $300–$15k/yr SaaS here for a vibecoder shipping a web app.

---

## 7. Per-competitor deep audits

### Snyk
- **What it is** — the "developer-first" application security platform (cloud + CLI + IDE) spanning SAST, SCA, container, IaC, and DAST; 2025 Gartner AST Magic Quadrant **Leader**.
- **Capabilities** — Snyk Open Source (SCA, transitive tree + reachability for Java/JS/Python, auto fix/upgrade PRs); Snyk Code (SAST, DeepCode AI, in-IDE, AI autofix); Snyk Container (OS + app-layer deps, base-image upgrade advice); Snyk IaC (Terraform/K8s/CFN/Helm/ARM, 400+ rules); Snyk API & Web (DAST, built on acquired **Probely** engine); Agent Fix (agentic autofix, ~85% claim); Advisor package health score.
- **Engines / data under the hood (the moat is proprietary):**
  - **Snyk Vulnerability Database (Snyk Intel)** — proprietary, human-curated, Snyk is a CNA; fed from NVD + GitHub mining + bulk research + manual audits; claims ~46 days ahead of NVD; **paid/closed, no free public API** (unlike NVD/OSV/GHSA).
  - **DeepCode AI (SAST)** — acquired 2020; hybrid symbolic + neural engine over data-flow graphs (sources/sanitizers/sinks), trained on 25M+ permissively-licensed OSS commits, 19+ languages; generative layer for autofixes.
  - **Reachability** — call-graph from app code to vulnerable dependency functions (static, Java/JS/Python) + dynamic/runtime; composite **Risk Score** = CVSS + **EPSS** + exploit maturity + popularity + reachability.
  - DAST engine = Probely (active web/API crawling + probes).
- **Runs:** CLI (`snyk test`/`monitor`), IDE plugins, SCM PR checks (pass/fail merge), CI (`--sarif`). SaaS-backed.
- **Pricing/standing:** per contributing-dev; Free (capped tests), Team ~$25/dev/mo, Enterprise custom (~$700–950/dev/yr at scale). Gartner AST Leader.
- **What 80/20 should TAKE:** (1) **Dependency CVE scanning via OSV.dev** (Snyk OSS minus the paywall) — highest leverage; lockfile → OSV → `product_bug` for pinned-vulnerable, no browser. (2) **EPSS + CISA KEV** free enrichment for prioritization. (3) **Container scan via Trivy/Grype** (Apache-2.0; OSV/GHSA + distro OVAL) + "suggest a slimmer base image." (4) **IaC via Checkov** (free, the OSS analogue of Snyk IaC's 400+ rules). (5) **Reachability-lite** — grep import/usage of the vulnerable package/symbol → confidence tier feeding `needs_verification`. (6) **DAST via Nuclei (MIT) / OWASP ZAP** for an active layer. (7) **License compliance** from the same lockfile parse. Order: OSV SCA → EPSS/KEV → Checkov IaC → Trivy container → reachability-lite → Nuclei/ZAP → licenses.
- **Sources:** [Scan/fix/prevent](https://docs.snyk.io/scan-fix-and-prevent) · [Vuln DB](https://docs.snyk.io/scan-with-snyk/snyk-open-source/manage-vulnerabilities/snyk-vulnerability-database) · [Container how-it-works](https://docs.snyk.io/scan-with-snyk/snyk-container/how-snyk-container-works) · [Reachability](https://docs.snyk.io/manage-risk/prioritize-issues-for-fixing/reachability-analysis) · [DeepCode AI](https://snyk.io/platform/deepcode-ai/) · [API & Web / Probely](https://snyk.io/news/snyk-launches-snyk-api-and-web-to-reimagine-dast-innovation-for-ai-era/) · [Gartner MQ Leader](https://snyk.io/blog/snyk-named-a-leader-in-the-2025-gartner-r-magic-quadrant-tm-for-application/) · [CVE DB comparison (NVD/OSV/GHSA/Snyk)](https://scanrook.io/blog/cve-database-comparison) · [Plans](https://snyk.io/plans/)

### Semgrep
- **What it is** — "semantic grep": AST + dataflow SAST. Free OSS engine (Semgrep CE, LGPL-2.1) + paid platform (Code/SAST, Supply Chain/SCA, Secrets, AI Assistant).
- **Capabilities** — CE (free, local, single-function taint, 30+ langs); Code Pro (cross-file/cross-function taint, framework-aware Pro rules); Supply Chain (lockfile + **reachability**: flags a CVE only if a call path reaches the vulnerable function; >90% noise-reduction claim; SBOM + license); Secrets (regex + entropy + dataflow + **live validation**, 630+ types, history); Assistant (LLM triage/autofix, platform-only).
- **Engines under the hood (most adoptable):**
  - **OSS engine (LGPL-2.1, OCaml)** — parses to AST, matches YAML patterns that look like code (`$X` metavars, `...` ellipses, `pattern-sources`/`-sinks` for taint). Runs fully local, never uploads code, **zero LLM** in the engine — matches 80/20's architecture exactly.
  - **Rule registry** — 2,000+ registry rules; the OSS `semgrep/semgrep-rules` repo alone is 2,800+ community rules. **Licensing nuance:** engine LGPL; Semgrep's own rules moved to a proprietary Rules License (free for internal/non-SaaS use); **third-party rules keep their source license** (often permissive).
  - **Pro engine** (paid, closed) adds interfile/interprocedural taint. **OpenGrep** (Jan-2025 LGPL fork by Aikido/Endor/Jit/Orca…) restores cross-function taint for free, rule/SARIF-compatible.
  - Supply-chain reachability = lockfile + AST/taint call-path + optional EPSS; Secrets validation pings the service to see if a key is live.
- **Runs:** `pip/brew/docker`, `semgrep scan --config auto|p/...` locally or CI; `semgrep ci` w/ token; IDE/pre-commit; rules-as-code (YAML, versionable).
- **Pricing/standing:** OSS free; platform free ≤10 contributors; Teams ~$40/contributor/mo (Code+SCA), Secrets ~$20. "SAST AppSec engineers don't hate."
- **What 80/20 should TAKE:** (1) **Shell out to the OSS `semgrep` binary** as a no-browser repo-scan detector: `semgrep scan --config p/owasp-top-ten --config p/security-audit --config p/secrets --sarif` → SARIF → cards; confirmed sinks `product_bug`, heuristics `needs_verification`. Free packs: `p/owasp-top-ten`, `p/security-audit`, `p/javascript`, `p/typescript`, `p/react`, `p/jwt`, `p/sql-injection`, `p/command-injection`, `p/xss`, `p/nodejsscan`. (2) **Adopt the YAML rules-as-code pattern** — ship a small bundled custom ruleset for our authz wedge (routes without RBAC middleware, missing server-side guards, exposed admin handlers, `dangerouslySetInnerHTML`). (3) **`p/secrets` ruleset** for hardcoded creds (we can't do live validation → `needs_verification` unless a known key format). (4) **OpenGrep** for free cross-function taint on JS/TS/Python (deeper injection detection than heuristics). (5) **Permissive third-party rulesets** (Trail of Bits, GitLab) bundled; fetch Semgrep's own via `--config p/...` at runtime (license-safe). (6) **Reachability framing** for our SCA story.
- **Sources:** [OSS engine](https://github.com/semgrep/semgrep) · [CE vs platform](https://semgrep.dev/docs/semgrep-pro-vs-oss) · [licensing](https://semgrep.dev/docs/licensing) · [Rules License](https://semgrep.dev/legal/rules-license/) · [semgrep-rules](https://github.com/semgrep/semgrep-rules) · [Supply Chain reachability](https://semgrep.dev/blog/2024/sca-reachability-analysis-methods/) · [Secrets](https://semgrep.dev/docs/semgrep-secrets/conceptual-overview) · [Opengrep fork (InfoQ)](https://www.infoq.com/news/2025/02/semgrep-forked-opengrep/) · [pricing](https://semgrep.dev/pricing/)

### GitGuardian
- **What it is** — the secrets-detection + Non-Human-Identity (NHI) security platform; #1 security app on the GitHub Marketplace; free OSS **ggshield** CLI front-end.
- **Capabilities** — Internal + Public secrets monitoring (incl. ~6yr of public-GitHub history, even deleted commits); NHI Governance (vault/IAM inventory, reused/over-privileged/stale secrets, rotation); ggshield (MIT CLI: files/repos/history/Docker/PyPI/CI, pre-commit/-push/-receive hooks); **Honeytoken** (decoy AWS creds, intrusion alert; OSS ggcanary); **Validity checks**; IDE + **MCP server** (guardrails for AI coding agents); HasMySecretLeaked.
- **Engines under the hood (gold for our secrets detector):**
  - **Two-tier detectors:** **450+ "specific" detectors** (one algorithm per credential type, high precision) + **"generic" detectors** (entropy/context patterns for the long tail); specific beats generic on collision.
  - **Pipeline = PreValidators → Scanner → PostValidators.** PreValidators discard binaries + skip `node_modules/`, `vendors?/`, `.sops`, and require a prefix (only scan SendGrid if text has `SG.`). PostValidators cut FPs: filter example/placeholder keys, **low-entropy strings**, English-dictionary strings, and **ML context models**.
  - **Validity = they verify the key is live** via the least-intrusive HEAD/GET → 5 states (valid/invalid/failed/cannot-check/unknown); some detectors only alert if valid; re-check cadence by plan.
  - Detector metadata: family, `High_recall`, `Prefixed`, `Can be checked`, min-matches (id+secret pairs), multi-line (private keys), base64 decode.
  - **ggshield** is a thin MIT client to their API (needs key); offline equivalent = **gitleaks** (MIT, regex + entropy, `gitleaks.toml`).
- **Runs:** pre-commit/-push hooks (real-time, free), IDE + MCP, CI gate, VCS-integration (server-side history + validity cadence).
- **Pricing/standing:** Free ≤25 devs (unlimited real-time, 500 historical detections, 10k API calls/mo); Business/Enterprise contact-sales. **G2 4.8/5**; secrets/NHI specialist (not SAST/SCA/DAST).
- **What 80/20 should TAKE** (extends our runtime `/.env` check to repo-scan + validity — the real wedge): (1) **Embed gitleaks' MIT ruleset** as the core pattern set (offline, no key) — **P0**. (2) **Two-stage prefix + entropy filter** (~3.5–4.5 bits/char) so bare high-entropy → `needs_verification` not `product_bug` — **P0**. (3) **Adopt GitGuardian's exclusion list verbatim** in `repo-scanner.ts` (skip binaries + `node_modules/`/`vendors?/`/`.sops`, de-prioritize html/css/md/lock) — prevents fixture false positives — **P0, trivial**. (4) **Live validity check** for a curated read-only set (GitHub `GET /user`, Stripe `/v1/account`, Slack `auth.test`, SendGrid, OpenAI) → **valid = `product_bug` (critical)** — the differentiator competitors lack — **P1**. (5) **Scan git history** via `git log -p` for secrets committed then deleted — **P1**. (6) **Sensitive-file context labeling** (`.env`/`*.pem` → up-weight; test paths → down-weight) — **P2**.
- **Sources:** [home](https://www.gitguardian.com/) · [pricing](https://www.gitguardian.com/pricing) · [ggshield (MIT)](https://github.com/GitGuardian/ggshield) · [detection engine](https://docs.gitguardian.com/secrets-detection/secrets-detection-engine/quick_start) · [detectors](https://docs.gitguardian.com/secrets-detection/secrets-detection-engine/detectors/introduction) · [validity checks](https://docs.gitguardian.com/secrets-detection/customize-detection/validity-checks) · [Honeytoken](https://blog.gitguardian.com/gitguardian-launches-honeytoken/) · [G2 4.8](https://www.g2.com/products/gitguardian/reviews) · [gitleaks (MIT)](https://github.com/gitleaks/gitleaks)

### OWASP ZAP
- **What it is** — the canonical free, open-source **DAST scanner + intercepting proxy** (now stewarded by Checkmarx); the most directly adoptable competitor for our DAST half (baseline scan is free, Dockerized, CI-ready).
- **Capabilities** — Passive Scan (observes traffic, no attacks → headers/cookies/info-disclosure/CSRF/JS findings); Active Scan (fires payloads: SQLi/XSS/traversal/SSTI…); Spider + AJAX Spider (SPA crawl); Fuzzer; API import+scan (OpenAPI/SOAP/GraphQL/Postman); Automation Framework (YAML); **Access Control Testing** + Sequence Scanner (the only authz-adjacent add-ons, heavyweight/manual); Retire.js (vulnerable-JS-lib SCA-lite); OAST/Interactsh (blind RCE/SSRF).
- **Engines / taxonomy under the hood:**
  - **Passive vs active** rule engines; rules ship as tiered add-ons (Release/Beta/Alpha) via a Marketplace; built-in Java rules + community script rules (JS/Python/Groovy/Zest).
  - **Alert taxonomy:** each finding = Plugin/Alert ID + Risk (High/Med/Low/Info) + Confidence (incl. "False Positive") + **CWE** + **WASC** + **Alert Tags mapping to OWASP Top 10 + WSTG** — the whole catalog is provenance-tagged to standards (mirrors our catalog discipline).
  - Tuning: per-rule Attack Strength + Alert Threshold; input vectors (query/POST/headers/cookies/path/JSON); **Scan Policies** (Default/Developer-CICD/QA-CICD/API/Pentester); auto anti-CSRF + auth/session/user model for authenticated scans.
  - **Baseline scan** = passive-only wrapper (`zap-baseline.py`), CI-safe even on prod. Docker images (stable/weekly/nightly/bare), headless daemon + REST API, official GitHub Actions.
  - **The honesty limit ZAP states outright:** _"Logical vulnerabilities, such as broken access control, will not be found by any active or automated vulnerability scanning."_ → exactly 80/20's wedge.
- **Concrete rule catalog (the adoptable taxonomy):**
  - **Active (Release):** SQLi (40018) + DB time-based (MySQL/Oracle/PostgreSQL/MsSQL/Hypersonic 40019-40027); Code Injection (90019); OS Command Injection (90020) + blind (90037); XPath (90021); XSLT (90017); SSI (40009); CRLF (40003); **SSTI** (90035) + blind (90036); Reflected XSS (40012); Persistent XSS (40014); Path Traversal (6); RFI (7); Directory Browsing (0); **`.env` Leak (40034)**, `.htaccess` Leak (40032); Source Code Disclosure /WEB-INF (10045); External Redirect (20019); Parameter Tampering (40008); **named CVEs:** Log4Shell (40043), Spring4Shell (40045), ShellShock (10048), Heartbleed (20015), Cloud Metadata (90034), Padding Oracle (90024), XXE (90023), Billion Laughs (40044).
  - **Passive (~165 alerts):** security headers (X-Frame-Options 10020, X-Content-Type-Options 10021, **CSP + ~13 sub-checks** 10038/10055, **HSTS + 8 variants** 10035, Permissions-Policy 10063, **CORP/COEP/COOP** 90004, Sec-Fetch 90005); cookies (HttpOnly 10010, Secure 10011, SameSite 10054, loosely-scoped 90033); **Absence of Anti-CSRF Tokens (10202)**; info-disclosure (Server/X-Powered-By banners 10036/10037, debug errors 10023, suspicious comments 10027, private IP 2, hash 10097, **CC/email/IBAN/Google-API-key/S3 leaks** 100008-100036); mixed content (10040), insecure form transitions (10041/10042); **Vulnerable JS Library (10003)**, Cross-Domain JS (10017), **SRI missing (90003)**, permissive CORS (10098), Reverse Tabnabbing (10108), polyfill malicious-domain (10115).
- **What 80/20 should TAKE:** **Tier 1 (wrap, highest leverage):** wrap `zap-baseline.py` as an optional `runBaselineScan` `ExecStep` (Docker, gate-on-present, skip gracefully) → ingest JSON → import ZAP's entire passive catalog with CWE+OWASP/WSTG provenance; High/Med → `product_bug`, Low/Info → `needs_verification`; passive-only avoids the SPA-shell trap. **Tier 2 (re-implement natively, no browser):** header-completeness pack (CSP/HSTS/CORP-COEP-COOP granularity), cookie-attribute pack, info-disclosure/banner pack, **secret/PII-in-response regexes**, SRI + vulnerable-JS-lib, open-redirect/mixed-content. **Tier 3 (gated active, opt-in + Docker):** `zap-full-scan.py` for XSS/SQLi/traversal/OS-cmd/SSTI/XXE/named-CVEs, clearly labeled (it's a real attack). **Do NOT cede authz** — ZAP can't find broken access control; that stays 100% our own.
- **Sources:** [Features](https://www.zaproxy.org/docs/desktop/start/features/) · [Alert details index](https://www.zaproxy.org/docs/alerts/) · [Active Scan Rules](https://www.zaproxy.org/docs/desktop/addons/active-scan-rules/) · [Active Scan feature ("broken access control will not be found")](https://www.zaproxy.org/docs/desktop/start/features/ascan/) · [Alert Tags (OWASP/WSTG)](https://www.zaproxy.org/docs/desktop/addons/common-library/alerttags/) · [Docker guide](https://www.zaproxy.org/docs/docker/about/) · [Baseline scan](https://www.zaproxy.org/docs/docker/baseline-scan/) · [Access Control Testing](https://www.zaproxy.org/docs/desktop/addons/access-control-testing/) · [Retire.js](https://www.zaproxy.org/docs/desktop/addons/retire.js/)

### Sonar (SonarQube / SonarCloud)
- **What it is** — open-core static code analysis (SAST + code-quality) across 30+ languages, built around "Clean Code" / catch-before-ship. SonarQube Server (self-host), Cloud (SaaS), SonarQube for IDE (SonarLint).
- **Capabilities** — Bugs, Code Smells, Vulnerabilities, **Security Hotspots** (security-sensitive code flagged for human review, not auto-judged), coverage, duplications; **taint analysis/injection** (cross-file, **paid-only**); DBD symbolic execution; secrets (Cloud); SCA + Advanced SAST (Enterprise add-on).
- **Engines under the hood:**
  - Per-language **first-party analyzers** (not third-party linters); **6,000+ rules** (30+ langs) published openly at rules.sonarsource.com w/ compliant/noncompliant samples; SonarLint ships 5,000+ locally.
  - **Rule taxonomy:** Standard (Bug/Vulnerability/Security Hotspot/Code Smell) + new MQR mode (Security/Reliability/Maintainability) with Clean Code attributes. Quality targets: ~0 FP for bugs/smells, >80% TP for vulns; hotspots deliberately have no severity (exploitability unknown until reviewed).
  - **Taint/SAST engine** = whole-codebase graph, source→sink interprocedural — but **absent from the free Community Build** (paid only).
  - **"Clean as You Code" + Quality Gate:** Quality Profile = active rules; **Quality Gate** = pass/fail conditions answering _"is my project ready for release?"_, focused on **new code** (the diff) so it's adoptable on legacy. SonarLint runs as-you-type; Connected Mode syncs server findings.
- **Runs:** IDE (SonarLint), CI (free SonarScanner CLI + official GitHub Action), PR decoration (paid), Quality Gate blocks merge/release.
- **Pricing/standing:** free Community Build (no taint/PR-decoration/branch) + Cloud free for public; Developer Edition ~$15k/yr/1M LOC; Cloud Team from ~$32/mo. The de-facto "clean-code quality-gate" standard; deep security is paywalled.
- **What 80/20 should TAKE (scope-aware — take the model, not the engine):** (1) **HIGH — the pass/fail "Launch Gate"** layered over our 0–100 score (e.g. zero security/authz `product_bug`s + readiness ≥ N → literal PASS/FAIL in `render-report.ts`). Sonar's strongest feature, conceptually identical to our bands but sharper. (2) **HIGH — "Clean as you code" changed-files-only mode** (score the diff) so re-runs on big legacy apps aren't all-red — makes us adoptable on existing codebases. (3) **MEDIUM — use Sonar's open rule catalog as a spec** (cite rule IDs) for a tight `code-health` regex/AST repo-scan generator (secrets, debug-left-on, exposed source maps) — don't vendor the engine. (4) **LOW — borrow the "Security Hotspot = review not confirmed" vocabulary** to sharpen our Truth Protocol `needs_verification` wording. **DON'T TAKE:** wrapping the free SonarScanner (Community Build has no taint → shallow + heavy JVM dep) or building full SAST — different product, dilutes the DAST + authz wedge.
- **Sources:** [Plans & pricing](https://www.sonarsource.com/plans-and-pricing/) · [Rule types/overview](https://docs.sonarsource.com/sonarqube-server/10.8/user-guide/rules/overview) · [rules.sonarsource.com](https://rules.sonarsource.com/) · [Quality Gates](https://docs.sonarsource.com/sonarqube-server/quality-standards-administration/managing-quality-gates/introduction-to-quality-gates) · [Clean as You Code](https://docs.sonarcloud.io/improving/clean-as-you-code) · [Taint analysis](https://www.sonarsource.com/solutions/taint-analysis/) · [Community taint = none](https://community.sonarsource.com/t/taint-analysis-capability/70624) · [SonarScanner CLI](https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/scanners/sonarscanner)



