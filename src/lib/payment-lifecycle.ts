import type { SqlClient } from './db.ts';
export type ClosedPaymentStatus = 'payment_failed' | 'refunded' | 'disputed';

export const paymentLifecycleSchema = `create table if not exists paid_audit_payment_state (
  stripe_session_id text primary key,
  status text not null check(status in ('payment_failed','refunded','disputed')),
  updated_at timestamptz not null default now()
)`;

export async function reconcilePaymentState(sql: SqlClient, session: string): Promise<void> {
  await sql(`update paid_audits a set status=p.status
    from paid_audit_payment_state p where a.stripe_session_id=$1 and p.stripe_session_id=a.stripe_session_id`, [session]);
}

/** Retain terminal payment evidence even if checkout has not arrived yet. */
export async function recordPaymentState(sql: SqlClient, session: string, status: ClosedPaymentStatus): Promise<void> {
  await sql(`insert into paid_audit_payment_state(stripe_session_id,status) values($1,$2)
    on conflict(stripe_session_id) do update set status=case
      when paid_audit_payment_state.status='disputed' or excluded.status='disputed' then 'disputed'
      when paid_audit_payment_state.status='refunded' or excluded.status='refunded' then 'refunded'
      else 'payment_failed' end, updated_at=now()`, [session,status]);
  await reconcilePaymentState(sql,session);
}
