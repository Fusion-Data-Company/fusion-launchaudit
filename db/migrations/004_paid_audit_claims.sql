-- Additive lease ownership for hosted paid grading. No customer rows modified.
alter table paid_audits add column if not exists grade_claim_token text;
alter table paid_audits add column if not exists grade_claimed_at timestamptz;
