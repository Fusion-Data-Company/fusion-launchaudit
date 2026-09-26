import { waitUntil } from '@vercel/functions';
import { gradePaidAudit, type PaidAuditRow } from './paid-audits.ts';
import type { SqlClient } from './db.ts';

/** Start paid work independently of the buyer's tab. The persisted queue and
 * claim token remain authoritative; the scheduled sweep recovers interruptions. */
export function startPaidAudit(sql: SqlClient, row: PaidAuditRow): void {
  if (row.status !== 'queued' && row.status !== 'awaiting_url') return;
  const work = gradePaidAudit(sql, row).then(() => undefined).catch(() => {
    console.error('Paid audit background run interrupted; retained for scheduled recovery.', row.id);
  });
  waitUntil(work);
}
