-- The pay-first receipt must not mark the later PDF report as delivered.
alter table paid_audits add column if not exists url_request_json jsonb;
