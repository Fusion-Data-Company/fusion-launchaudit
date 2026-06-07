# Fusion LaunchAudit

Fusion LaunchAudit is a launch-audit campaign platform: web command center plus local MCP runner.

The first production-shaped slice is static frontend assets, Vercel-compatible API functions, typed campaign data, a local runner sync simulator, Fusion branding, dark mode, and a competitive proof harness.

## Run Locally

```bash
npm run dev
```

Open:

```txt
http://127.0.0.1:3010
```

Verify API:

```bash
curl http://127.0.0.1:3010/api/campaign
```

Verify runner sync:

```bash
npm run runner:sync
```

## Deploy Shape

- `public/index.html`: static Fusion-branded command center.
- `public/assets/app.css`: dark/light theme with blue and cayenne ambient glow system.
- `public/assets/app.js`: browser renderer backed by `/api/campaign`.
- `api/campaign.ts`: Vercel campaign API.
- `api/runner/sync.ts`: Vercel runner sync API.
- `runner/local-runner.ts`: local runner simulator and sync payload contract.
- `src/lib/*`: typed campaign, MCP runner, and competitive scorecard data.

## Production Docs

- `docs/production-architecture.md`
- `docs/outperform-testsprite-scorecard.md`

## Current Verification

Current local checks:

```bash
npm run build
npm run runner:sync
```

Browser QA should verify:

- dark mode default
- light/dark toggle
- no horizontal overflow at desktop and mobile widths
- 5 test cards render
- 3 findings render
- 6 scorecard categories render

## Next Real Production Layer

1. Add Postgres campaign persistence.
2. Add Vercel Blob artifact storage.
3. Replace seeded repo/runtime summaries with real local MCP scanner output.
4. Add Playwright execution for approved test cards.
5. Add model task router for OpenAI, Anthropic, OpenRouter, Genspark bridge, and Docker-hosted OpenAI-compatible models.
6. Add report export and before/after repair rerun proof.
