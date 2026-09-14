-- Separate from automated report delivery: its retries must never erase human work.
create table if not exists audit_hands_on_work (
  order_id text primary key references paid_audits(id),
  owner text not null,
  version integer not null default 1,
  state text not null default 'pending_scope'
    check (state in ('pending_scope','scoped','report_delivered','complete')),
  contact jsonb,
  scope jsonb,
  report jsonb,
  call jsonb,
  reaudit jsonb,
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
