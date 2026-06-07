create table if not exists projects (
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
