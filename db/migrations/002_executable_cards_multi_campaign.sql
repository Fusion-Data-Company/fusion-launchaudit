alter table campaigns add column if not exists name text not null default 'Launch Audit Campaign';
alter table campaigns add column if not exists repo_path_hint text;
alter table test_cards add column if not exists exec jsonb not null default '[]'::jsonb;
