-- Paid audit delivery: the hosted PDF link, the delivery record (blob + email outcome), and when the email went out.
-- Applied idempotently at runtime by ensurePaidAuditsTable (src/lib/paid-audits.ts); this file is the migration of record.
alter table paid_audits add column if not exists report_pdf_url text;
alter table paid_audits add column if not exists delivery_json jsonb;
alter table paid_audits add column if not exists delivered_email_at timestamptz;

-- The public /demo report: one real run of the generator against fusiondataco.com, persisted so the page never re-runs it per view.
create table if not exists demo_reports (
  id text primary key,
  url text not null,
  tier text not null default 'single',
  grade_json jsonb not null,
  pdf_url text,
  buyer_name text,
  buyer_company text,
  buyer_email text,
  created_at timestamptz not null default now()
);
create index if not exists demo_reports_created_idx on demo_reports (created_at desc);
