-- Free surface-scan history, the unlock-email lead capture, and weekly monitoring.
-- Applied idempotently at runtime by ensureScanTables (src/lib/scan-store.ts);
-- this file is the migration of record and mirrors storage-contract.ts.

create table if not exists scans (
  id text primary key,
  url text not null,
  origin text not null,
  score integer not null,
  band text not null,
  passed integer not null default 0,
  counts jsonb not null default '{}'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  source text not null default 'free',
  created_at timestamptz not null default now()
);
create index if not exists scans_origin_idx on scans (origin, created_at desc);

create table if not exists scan_leads (
  id text primary key,
  email text not null,
  scan_id text,
  origin text,
  created_at timestamptz not null default now()
);
create index if not exists scan_leads_email_idx on scan_leads (email, created_at);

create table if not exists monitors (
  id text primary key,
  origin text not null unique,
  email text,
  frequency text not null default 'weekly',
  agency_name text,
  logo_url text,
  active boolean not null default true,
  last_scan_id text,
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);
