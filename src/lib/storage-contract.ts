export type StorageSubsystem = "postgres" | "blob" | "runner";

export type StorageStatus = "configured" | "missing_secret" | "seeded_only" | "planned";

export type StorageReadinessItem = {
  subsystem: StorageSubsystem;
  label: string;
  status: StorageStatus;
  requiredEnv: string[];
  purpose: string;
  productionGate: string;
};

export type DatabaseTableContract = {
  table: string;
  purpose: string;
  keyColumns: string[];
  requiredForV1: boolean;
};

export type BlobArtifactContract = {
  artifactType: "trace" | "screenshot" | "video" | "network_log" | "accessibility_snapshot" | "report_pdf";
  pathTemplate: string;
  access: "private" | "public";
  retention: string;
  redactionRequired: boolean;
};

export const storageReadiness: StorageReadinessItem[] = [
  {
    subsystem: "postgres",
    label: "Campaign database",
    status: "missing_secret",
    requiredEnv: ["POSTGRES_URL"],
    purpose: "Durably stores projects, campaigns, test cards, runs, findings, repair tasks, model task logs, and artifact metadata.",
    productionGate: "A campaign must survive deploys and page refreshes without depending on seeded JSON.",
  },
  {
    subsystem: "blob",
    label: "Evidence artifact store",
    status: "missing_secret",
    requiredEnv: ["BLOB_READ_WRITE_TOKEN"],
    purpose: "Stores screenshots, traces, videos, network logs, accessibility snapshots, and exported client reports.",
    productionGate: "Every failed or blocked test must have durable evidence refs that can be opened from the audit report.",
  },
  {
    subsystem: "runner",
    label: "Runner sync authentication",
    status: "missing_secret",
    requiredEnv: ["RUNNER_SYNC_SECRET"],
    purpose: "Protects local runner sync and artifact registration endpoints from unauthenticated writes.",
    productionGate: "Runner writes must be signed or rejected before accepting real customer campaign data.",
  },
];

export const databaseTables: DatabaseTableContract[] = [
  {
    table: "projects",
    purpose: "One customer app/repo under audit.",
    keyColumns: ["id", "owner_id", "repo_url", "framework", "support_tier", "created_at"],
    requiredForV1: true,
  },
  {
    table: "campaigns",
    purpose: "Launch audit campaign state and readiness score.",
    keyColumns: ["id", "project_id", "status", "app_url", "depth", "readiness_score", "created_at"],
    requiredForV1: true,
  },
  {
    table: "runner_sessions",
    purpose: "Local MCP runner identity, version, host, and last sync metadata.",
    keyColumns: ["id", "campaign_id", "runner_host", "version", "auth_state_ref", "last_sync_at"],
    requiredForV1: true,
  },
  {
    table: "test_cards",
    purpose: "Generated, reviewed, and executed evidence-gated test cards.",
    keyColumns: ["id", "campaign_id", "category", "risk", "status", "goal", "acceptance_criteria"],
    requiredForV1: true,
  },
  {
    table: "runs",
    purpose: "Per-test execution attempts with pass/fail/blocked state.",
    keyColumns: ["id", "campaign_id", "test_card_id", "status", "started_at", "ended_at"],
    requiredForV1: true,
  },
  {
    table: "artifacts",
    purpose: "Blob-backed evidence metadata and redaction state.",
    keyColumns: ["id", "run_id", "artifact_type", "blob_path", "sha256", "redaction_status"],
    requiredForV1: true,
  },
  {
    table: "findings",
    purpose: "Classified failures and blocked areas.",
    keyColumns: ["id", "campaign_id", "test_card_id", "type", "severity", "summary"],
    requiredForV1: true,
  },
  {
    table: "repair_tasks",
    purpose: "Coding-agent-ready repair packets generated from product bugs.",
    keyColumns: ["id", "finding_id", "title", "likely_files", "verification_command", "agent_prompt"],
    requiredForV1: true,
  },
  {
    table: "model_tasks",
    purpose: "Model routing audit trail, prompt/output hashes, latency, cost, and quality gate status.",
    keyColumns: ["id", "campaign_id", "category", "provider_slot_id", "model", "status", "prompt_hash", "output_hash"],
    requiredForV1: true,
  },
];

export const blobArtifacts: BlobArtifactContract[] = [
  {
    artifactType: "trace",
    pathTemplate: "campaigns/{campaign_id}/runs/{run_id}/traces/{test_card_id}.zip",
    access: "private",
    retention: "180 days",
    redactionRequired: true,
  },
  {
    artifactType: "screenshot",
    pathTemplate: "campaigns/{campaign_id}/runs/{run_id}/screenshots/{test_card_id}-{viewport}.png",
    access: "private",
    retention: "180 days",
    redactionRequired: true,
  },
  {
    artifactType: "video",
    pathTemplate: "campaigns/{campaign_id}/runs/{run_id}/videos/{test_card_id}.webm",
    access: "private",
    retention: "90 days",
    redactionRequired: true,
  },
  {
    artifactType: "network_log",
    pathTemplate: "campaigns/{campaign_id}/runs/{run_id}/network/{test_card_id}.har.json",
    access: "private",
    retention: "180 days",
    redactionRequired: true,
  },
  {
    artifactType: "accessibility_snapshot",
    pathTemplate: "campaigns/{campaign_id}/runs/{run_id}/a11y/{test_card_id}.json",
    access: "private",
    retention: "180 days",
    redactionRequired: false,
  },
  {
    artifactType: "report_pdf",
    pathTemplate: "campaigns/{campaign_id}/reports/{report_id}.pdf",
    access: "private",
    retention: "365 days",
    redactionRequired: true,
  },
];

export const storageSchemaSql = `create table if not exists projects (
  id text primary key,
  owner_id text not null,
  repo_url text,
  repo_path_hint text,
  framework text,
  support_tier text not null,
  created_at timestamptz not null default now()
);

create table if not exists campaigns (
  id text primary key,
  project_id text not null references projects(id),
  status text not null,
  app_url text not null,
  depth text not null,
  readiness_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists runner_sessions (
  id text primary key,
  campaign_id text not null references campaigns(id),
  runner_host text not null,
  version text not null,
  auth_state_ref text,
  last_sync_at timestamptz
);

create table if not exists test_cards (
  id text primary key,
  campaign_id text not null references campaigns(id),
  category text not null,
  risk text not null,
  status text not null,
  title text not null,
  goal text not null,
  steps jsonb not null,
  expected_evidence jsonb not null,
  data_needs jsonb not null,
  acceptance_criteria text not null
);

create table if not exists runs (
  id text primary key,
  campaign_id text not null references campaigns(id),
  test_card_id text not null references test_cards(id),
  status text not null,
  started_at timestamptz,
  ended_at timestamptz
);

create table if not exists artifacts (
  id text primary key,
  run_id text not null references runs(id),
  artifact_type text not null,
  blob_path text not null,
  sha256 text,
  redaction_status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists findings (
  id text primary key,
  campaign_id text not null references campaigns(id),
  test_card_id text references test_cards(id),
  type text not null,
  severity text not null,
  title text not null,
  summary text not null,
  evidence_refs jsonb not null
);

create table if not exists repair_tasks (
  id text primary key,
  finding_id text not null references findings(id),
  severity text not null,
  title text not null,
  why_it_matters text not null,
  evidence_refs jsonb not null,
  likely_files jsonb not null,
  reproduction_steps jsonb not null,
  expected_behavior text not null,
  verification_command text not null,
  agent_prompt text not null
);

create table if not exists model_tasks (
  id text primary key,
  campaign_id text not null references campaigns(id),
  category text not null,
  provider_slot_id text not null,
  model text not null,
  status text not null,
  prompt_hash text,
  output_hash text,
  quality_gate text not null,
  latency_ms integer,
  cost_micros integer,
  created_at timestamptz not null default now()
);

alter table campaigns add column if not exists name text not null default 'Launch Audit Campaign';

alter table campaigns add column if not exists repo_path_hint text;

alter table test_cards add column if not exists exec jsonb not null default '[]'::jsonb;`;

export function getStorageRuntimeReadiness(env: Record<string, string | undefined>) {
  return storageReadiness.map((item) => {
    const missing = item.requiredEnv.filter((name) => !env[name]);
    return {
      ...item,
      status: missing.length === 0 ? ("configured" as const) : item.status,
      missingEnv: missing,
    };
  });
}
