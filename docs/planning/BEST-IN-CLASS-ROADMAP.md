# 80/20 Launch Audit — 20 Moves to Best-in-Class (framework kept intact)

The framework is the moat. Every item below preserves all of it:

- **Node `--experimental-strip-types`** — no build step in the runner; no TS enums/namespaces/parameter-properties.
- **The detector pattern** — `generators/<x>.ts` → `ExecStep` in `runner/executor.ts` → dispatch in `runner/execute-core.ts` (add to `NO_BROWSER_ACTIONS` if pure HTTP/CLI) → branch in `runner/classify.ts` → wire into `src/lib/card-generator.ts` → `*.test.ts`.
- **Truth Protocol** — confirmed `product_bug` vs `needs_verification` vs `test_bug`/`flaky`/`needs_input`; honest over scary-but-wrong; the Watchdog re-verifies every no-browser pass.
- **Free, local, in-your-agent** — no hosted backend, no API key required; PGlite local hub; vanilla HTML/CSS/JS dashboard.
- **The wedge** — admin/RBAC, IDOR/BOLA, write-authz, server-side guards: the depth ZAP's own docs say scanners *can't* automate. Defend it; don't dilute it.

Nothing here adds a paid dependency, a hosted service, or a finding we can't prove.

---

## Theme A — Native breadth (round out the surface, keep it free + no-tool)

**1. Cookie-hardening depth.** Extend `generators/cookie-security.ts`: flag `SameSite=None` without `Secure`, a session cookie missing `HttpOnly` on the *auth* response, and a `Domain` scoped too broadly (parent domain). Pure HTTP off the existing `loginProbe`. Honest verdict: confirmed for HttpOnly/Secure on a session cookie; `needs_verification` for scope. Source: OWASP WSTG-SESS, CWE-1004/614.

**2. Transport & isolation header depth.** Extend `security.ts` + `tls-hsts.ts`: HSTS `max-age` too low / no `preload`, `Cross-Origin-Resource-Policy` / `Cross-Origin-Embedder-Policy`, and `Permissions-Policy` that doesn't actually lock down camera/mic/geo. Reuse the `expectHeaderRecommended` / `expectHeaderExcludesTokens` assertions already added. All `needs_verification` (defense-in-depth). Source: RFC 6797, OWASP Secure Headers.

**3. Client-integrity pack.** New `generators/client-integrity.ts` off the crawl HTML: **SRI** missing on external/CDN `<script>`/`<link>`, **mixed content** (http asset on an https page), and **source-map exposure** (`*.js.map` served with `sourcesContent`). One new `http` GET per script for the map check. Confirmed for mixed-content + served source map; `needs_verification` for SRI. Source: W3C SRI, CWE-200.

**4. Exposed-file & redirect breadth.** Grow `security.ts` `SECRET_FILES` (`/.DS_Store`, `/.svn/entries`, `/backup.sql`, `/config.json`, `/.aws/credentials`, `/docker-compose.yml`) and add a `.well-known/security.txt` presence note (RFC 9116) + an **open-redirect** probe (`?next=`/`?url=`/`?redirect=` reflected into `Location` to an external origin — WSTG-CLNT-04). Open redirect is a confirmed bug; the rest are graded honestly.

## Theme B — Deepen the wedge (the part nobody else can automate)

**5. Three-role access matrix.** You already capture auth (`runner/capture-auth.ts`, `hints.roles.admin/user`). Run every privileged route/API as **anonymous → normal-user → admin** and assert the *gradient* (401/403 for anon+user, 200 for admin). Turns admin-rbac/object-authz/mutation-authz from single-shot into a real truth table. This is the headline competitors structurally cannot do.

**6. Cross-session BOLA/IDOR.** Extend `object-authz`: user A creates an object, then user B's session tries read/update/delete by id. Proves tenant isolation, not just "an id swapped." Confirmed bug when B succeeds; `needs_verification` under dev-stub auth (already handled).

**7. CSRF / state-change protection.** New `generators/csrf.ts`: a cookie-authed state-changing POST with no anti-CSRF token and `SameSite` not `Strict/Lax` is accepted cross-origin. Sits exactly on the write-authz wedge. Source: OWASP CSRF, CWE-352.

**8. Auth-robustness smoke.** Brute-force/rate-limit (repeated login → no 429), session-fixation (session id unchanged after login), and password-reset token in URL/referrer. All `needs_verification`-honest (a smoke signal, not a proven exploit) — surfaces the questions every launch should answer. Source: WSTG-ATHN/SESS.

## Theme C — Trust & accuracy (your *real* differentiator vs everyone's "fewer false positives")

**9. Reproducible evidence bundle per finding.** Every finding already carries a fix prompt; add a one-line **repro** (the exact `curl`/Playwright step + a redacted response slice) into `render-report.ts` and the verdict. "Here's the proof, run it yourself" beats any competitor's confidence score and hardens the Watchdog.

**10. Baseline + diff mode ("clean as you code").** A `--since <git-ref>` that scores only changed files/routes so re-runs on big legacy apps aren't all-red (Sonar's signature move) — pure logic in the generator + `render-report.ts`. Makes the tool usable on real, messy codebases.

**11. Documented suppression file.** `.launchauditignore` with a **required rationale** per entry; the report shows an "accepted risk (N)" count. Teams need accept-with-reason — and forcing a written reason keeps it honest instead of hidden. Never let it silence a confirmed security/authz bug without an explicit, logged override.

**12. Confidence calibration + precision tracking.** Per-category precision/recall measured against the fixtures on every CI run; if a category drifts below threshold, fail CI. This is how you *earn* the Truth-Protocol claim instead of asserting it.

## Theme D — Interop & distribution (best-in-class plumbing)

**13. SARIF + JSON-schema output.** Emit SARIF 2.1.0 alongside the HTML/JSON so findings load straight into GitHub code-scanning and any SARIF viewer, and publish a JSON schema for the report. Interop is table-stakes for "best in class"; it's a pure serializer in `render-report.ts`.

**14. GitHub Action: PR gate.** Ship the *product* as a reusable Action that runs the audit on a PR, posts the **Launch Gate PASS/FAIL** as a commit status check, comments the top fixes, and fails the build on a confirmed security/authz bug. You already run CI for your own tests — this packages the gate for customers.

**15. Optional external-engine wraps — gated + graceful.** Add **Semgrep/Opengrep** (SAST, bundle a tiny wedge ruleset), **OWASP ZAP baseline** (passive, dodges the SPA-shell trap), **Checkov** (IaC), **Trivy/Grype** (containers) as optional `ExecStep`s that **skip to a `blocked` card when the binary is absent**. Unit-test each parser (SARIF/JSON) so the integration is verifiable even where the tool isn't installed. Keeps the no-tool default; rewards power users.

**16. `launchaudit init` wizard.** Detect routes from the repo scan, scaffold the `hints` file, and walk auth capture interactively so the **wedge fires with zero hand-authoring**. The single biggest adoption unlock — most users never write a hints file, so the best checks never run.

## Theme E — Proof, scale, provenance (credibility *is* the product)

**17. Benchmark harness.** One planted-bug fixture per detector + a published **recall/precision report** vs. `docs/research/test-catalog`. "Catches 5/5 on buggy-shop, 0 false positives on shop-fixed" is your Show-HN proof; make it a command anyone can run.

**18. Grow the sourced catalog (keep the provenance law).** Work `docs/research/test-catalog/ROLLUP.md` down the prioritized list; every new row cites a real standard (OWASP/ASVS/WCAG/RFC) or is tagged `[UNVERIFIED]`. The catalog is the build spec *and* the credibility story — never invent a test or a source.

**19. Performance & scale.** Parallelize card execution with a bounded worker pool, add crawl budget/time caps and big-repo file caps (you've started this in the SCA/secrets walks), and cache OSV results per run. Best-in-class means fast on a real 50k-file app, not just the fixture.

**20. Remediation ranking + report polish.** Enrich CVE findings with free **EPSS + CISA KEV** to sort "fix these first," wire that ordering to the Launch Gate, and make the report itself accessible (the a11y auditor should pass its own report). Close the loop: find → rank → gate → fix-prompt → re-verify.

---

## Suggested sequence

1. **Wedge first (5–8)** — it's the moat and the marketing line; deepen it before breadth.
2. **Trust (9–12)** — every new detector is only worth shipping if the Truth Protocol holds; calibration + evidence keep recall honest as you add surface.
3. **Distribution (13, 14, 16)** — SARIF + a PR-gate Action + the init wizard are what turn "great engine" into "adopted everywhere."
4. **Native breadth (1–4)** — cheap, safe, makes the report look complete next to Aikido.
5. **External wraps + proof (15, 17–20)** — power-user depth and the credibility artifacts, last.

## Guardrail — what NOT to build (defend the wedge)

No CSPM, no cloud runtime firewall, no proprietary full-taint SAST platform, no registry posture, no hosted backend that breaks "runs in your agent." Everyone else markets "reachability / fewer false positives" — that's *your* Truth Protocol, already built. Free + local + in-the-agent + authorization-depth beats every $300–$15k/yr SaaS for a vibecoder shipping a web app. Keep that the whole pitch.
