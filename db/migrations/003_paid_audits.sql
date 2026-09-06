-- Hosted deep-audit orders (Stripe Checkout). One row per completed checkout session.
-- status lifecycle: queued -> graded (instant surface grade stored in grade_json, automatic)
--                          -> delivered (Playwright deep audit run by a worker/human; report_url set)
create table if not exists paid_audits (
  id text primary key,
  stripe_session_id text not null unique,
  email text not null,
  target_url text not null,
  tier text not null,
  amount_cents integer not null default 0,
  status text not null default 'queued',
  grade_json jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  report_url text
);

create index if not exists paid_audits_status_idx on paid_audits (status, created_at);
