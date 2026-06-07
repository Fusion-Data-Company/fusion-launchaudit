# Fusion LaunchAudit Production Architecture

## Product Shape

Fusion LaunchAudit is a web command center plus local MCP runner.

- Web app: campaign setup, review, artifacts, findings, repair tasks, report export.
- Vercel API: campaign state, runner sync, model task routing, signed artifact upload URLs.
- Local MCP runner: repo inspection, app verification, auth-state capture, Playwright execution, artifact collection.
- Postgres: projects, campaigns, test cards, runs, findings, repair tasks, model task logs.
- Vercel Blob: screenshots, traces, videos, accessibility snapshots, exported reports.

## Database Tables

Minimum production schema:

- `projects`: owner, repo URL/path metadata, framework, support tier.
- `campaigns`: project, status, depth, app URL, readiness score, created by.
- `runner_sessions`: campaign, runner host, version, last sync, auth-state reference metadata.
- `test_cards`: campaign, category, risk, goal, steps, expected evidence, acceptance criteria, status.
- `runs`: campaign, test card, status, started/ended timestamps, runner host.
- `artifacts`: run, type, blob URL, checksum, redaction status.
- `findings`: run/test card, finding type, severity, summary, evidence refs.
- `repair_tasks`: finding, likely files, repro steps, expected behavior, verification command, agent prompt.
- `model_tasks`: campaign, task category, provider, model, prompt hash, output hash, cost, latency, status.

## Blob Storage

Artifact paths should be deterministic:

```txt
campaigns/{campaign_id}/runs/{run_id}/trace.zip
campaigns/{campaign_id}/runs/{run_id}/screenshots/{test_card_id}.png
campaigns/{campaign_id}/reports/{report_id}.pdf
```

Never store raw secrets or `.env` files in Blob. Store sanitized env-key presence maps only.

## Model Harness Reality

The model layer should not be one chatbot call. It should be a task router:

```ts
type ModelTaskCategory =
  | "campaign_planning"
  | "repo_analysis"
  | "runtime_exploration"
  | "test_generation"
  | "failure_classification"
  | "repair_packet"
  | "patch_generation"
  | "client_report";
```

Provider adapters:

- OpenAI: Responses API for planning, classification, repair packets, and Codex-style code tasks.
- Anthropic: long-context repo analysis and repair reasoning.
- OpenRouter: user-selectable coding models and low-cost smaller task routing.
- Genspark bridge: treat as an external research/agent provider through a controlled adapter when API/browser access is available.
- Docker-hosted LLM: expose an OpenAI-compatible endpoint such as `http://model-gateway:8080/v1/chat/completions`.

The proprietary model path is not “train a model first.” The realistic path is:

1. Capture campaign traces, test cards, findings, repair tasks, and fix outcomes.
2. Store clean supervised examples: input context -> test card, failure -> classification, finding -> repair packet.
3. Fine-tune or distill narrow tasks after enough successful campaigns.
4. Keep execution deterministic with Playwright; use the model for planning and diagnosis, not final truth.

## Deployment Defaults

Required Vercel env vars once persistence is added:

```txt
POSTGRES_URL
BLOB_READ_WRITE_TOKEN
OPENAI_API_KEY
MODEL_ROUTER_DEFAULT_PROVIDER
MODEL_ROUTER_DEFAULT_MODEL
RUNNER_SYNC_SECRET
```

V1 can run without these because the current campaign data is seeded and the runner sync endpoint validates shape only.
