-- Preserve terminal payment events that arrive before checkout fulfillment.
create table if not exists paid_audit_payment_state (
  stripe_session_id text primary key,
  status text not null check(status in ('payment_failed','refunded','disputed')),
  updated_at timestamptz not null default now()
);
