# Hermes Launch Plan — saved + Fusion assessment

> Hermes proposed a 3-phase open-source launch plan. Captured verbatim below,
> with an honest assessment of what's worth taking given what 80/20 Launch Audit
> ALREADY has shipped (repo is already public + live at launch-audit-platform.vercel.app).

---

## Hermes's plan (verbatim)

Since this is a "free for everyone" drop, the goal is maximum visibility, zero friction for users, and elite presentation.

### 1. The "Elite Presentation" (Technical Polish)
- Write a God-Tier README: a "landing page" style README with a clear value prop, quick-start guides, and a "Why this exists" section.
- Create a CONTRIBUTING.md & CODE_OF_CONDUCT.md: sets the professional tone for open-source contributors.
- Generate a LICENSE file: ensuring the "free for everyone" part is legally clear (MIT or Apache 2.0).
- Audit for "Leaked" Secrets: scan for API keys, hardcoded paths, or .env files that shouldn't be public.

### 2. The "Frictionless Entry" (User Experience)
- Write Installation Scripts: a setup.sh or install.py that handles dependencies automatically.
- Build a Makefile: standardize make install, make test, make build.
- Create GitHub Actions (CI/CD): automated tests so contributions don't break the build.

### 3. The "Hype Cycle" (Promotion & Distribution)
- Draft the "Launch Post" for X/Twitter (thread hooks), Reddit (subreddit-aware), Hacker News (concise technical pitch).
- Create a "Quick-Start" Tutorial: git clone → "First Success" in under 60 seconds.
- Analyze Competitors: find similar tools, identify the USP, weave it into promotion.

### Execution (3 phases)
- Phase 1 — The Lockdown (Internal): audit code, fix README, make repo production-ready.
- Phase 2 — The Packaging (UX): scripts, Makefiles, CI/CD for a one-click experience.
- Phase 3 — The Blast-Off (External): social campaigns + community research.

---

## Fusion assessment — what to take, what's already done

**Status reality check:** the repo is ALREADY public and the app is ALREADY live. So the
"where's the code / which phase" framing is partly moot. Here's the honest map.

### Already shipped (do NOT redo)
| Hermes item | Status in our repo |
|---|---|
| LICENSE | ✅ `LICENSE` (MIT) |
| README (landing-style) | ✅ `README.md` (215 lines, value prop + quick-start + Cursor/Codex) |
| CONTRIBUTING.md | ✅ present |
| CODE_OF_CONDUCT.md | ✅ present |
| Security policy | ✅ `SECURITY.md` + issue/PR templates in `.github/` |
| Leaked-secrets audit | ✅ it's literally the product (+ `security-auditor` skill) |
| Launch posts (X/Reddit/HN/PH/LinkedIn) | ✅ `LAUNCH-KIT.md` — tailored, honest-claims-only, with posting sequence |
| Competitor / USP angle | ◑ partially in `docs/research/` + LAUNCH-KIT |
| One-paste install | ✅ on the landing page (clone + install + MCP register, per agent) |

### Worth taking (genuinely new value)
1. **GitHub Actions CI** — the one clear gap (`.github/workflows` is missing). A workflow
   that runs `npm test` (113 tests) + `npm audit` on every push/PR. High payoff: protects
   against engine regressions (relevant — we just fixed real classifier/detector bugs), and
   a green check badge signals quality to OSS contributors. ~20 min, low risk.
2. **A final public-secrets sweep before the wide drop** — high-stakes (going broad), quick.
   Run our own grader/security pass over the repo + a history scan for any stray key.
3. **README skim** — only if weak. It's already substantial; a 5-min read confirms the
   value-prop hook + quick-start are tight. Probably fine.

### Skip / low value for this stack
- **Makefile / setup.sh** — the one-paste install already works and `package.json` scripts
  cover test/build. A Makefile is marginal for a no-build-step Node/TS project.
- **Re-drafting launch posts** — LAUNCH-KIT.md already does this, tailored and honest. Don't
  duplicate with generic boilerplate.
- **Re-doing LICENSE/CONTRIBUTING/COC** — done.

### Recommended next step
Do #1 (CI) and #2 (secret sweep). Everything else Hermes listed is either already shipped or
low-leverage. The CI workflow is the single highest-value addition and makes the public repo
look professionally maintained.
