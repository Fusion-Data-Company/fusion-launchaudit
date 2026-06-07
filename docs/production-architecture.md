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

Current migration artifact:

- `db/migrations/001_launch_audit_core.sql`

## Blob Storage

Artifact paths should be deterministic:

```txt
campaigns/{campaign_id}/runs/{run_id}/trace.zip
campaigns/{campaign_id}/runs/{run_id}/screenshots/{test_card_id}.png
campaigns/{campaign_id}/reports/{report_id}.pdf
```

Never store raw secrets or `.env` files in Blob. Store sanitized env-key presence maps only.

## Model Harness Reality

The model layer is now represented in the app as a seeded task router. It is not live invocation yet, but the campaign API exposes provider slots, route assignments, fallbacks, and quality gates so the production execution layer has a concrete contract instead of an abstract wish.

```ts
type ModelTaskCategory =
  | "repo_context"
  | "runtime_crawl"
  | "test_generation"
  | "failure_classification"
  | "repair_task_writing"
  | "patch_planning"
  | "visual_review"
  | "traffic_analysis";
```

Seeded provider slots:

- Fusion managed default: planning, classification, test generation, and repair writing fallback.
- OpenRouter coding model: owner-selected coding models for repair packets and patch planning.
- Genspark agent bridge: browser/runtime/visual-review provider through a controlled HTTPS bridge.
- Docker hosted local LLM: OpenAI-compatible local endpoint for private repo context and traffic analysis.
- Proprietary QA model: future customer-owned endpoint or fine-tuned model trained only from approved artifacts.

The proprietary model path is not “train a model first.” The realistic path is:

1. Capture campaign traces, test cards, findings, repair tasks, and fix outcomes.
2. Store clean supervised examples: input context -> test card, failure -> classification, finding -> repair packet.
3. Fine-tune or distill narrow tasks after enough successful campaigns.
4. Keep execution deterministic with Playwright; use the model for planning and diagnosis, not final truth.

Current seed endpoints:

- `/api/campaign`: includes `model_provider_slots`, `model_routes`, and `model_task_contracts`.
- `/api/model-routing`: returns only the model harness contract for setup and admin screens.

## Storage Readiness API

Current seed endpoints:

- `/api/storage/readiness`: reports Postgres, Blob, and runner-sync secret readiness without returning secret values.
- `/api/storage/schema`: returns the Postgres table contract and schema SQL.
- `/api/storage/register-artifact`: validates runner artifact registration payloads and returns the deterministic Blob path. Until `BLOB_READ_WRITE_TOKEN` is configured, it runs in `contract_only_missing_blob_token` mode.

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
