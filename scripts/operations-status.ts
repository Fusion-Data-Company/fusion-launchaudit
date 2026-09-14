/** Read-only operator snapshot. Run with the production POSTGRES_URL supplied by the connected runtime. */
import { DELIVERY_ATTENTION_PREDICATE } from '../src/lib/audit-delivery.ts';
import { getSqlClient } from '../src/lib/db.ts';
import { handsOnQueue } from '../src/lib/hands-on-work.ts';
const sql = await getSqlClient();
if (!sql) throw new Error('Operations database unavailable');
const orders = await sql(`select status, count(*)::int as count from paid_audits group by status`);
const attention = await sql(`select id, status, created_at, stripe_session_id, delivery_json->'attempt'->>'state' as delivery_state,
    case when status='delivered' then 'Check SMTP acceptance before resolving held delivery; do not resend automatically'
         when status='blocked' then 'Confirm or complete the blocked-run refund'
         else 'Run or inspect queued-order recovery' end as operator_action
  from paid_audits
  where (status='queued' and created_at < now()-interval '1 hour')
     or (status='blocked' and coalesce(grade_json->'refund'->>'id','')='')
     or (${DELIVERY_ATTENTION_PREDICATE})
  order by created_at limit 50`);
const submissions = await sql(`select id,name,email,type,message,created_at from submissions order by created_at desc limit 50`);
const hands_on = await handsOnQueue(sql);
console.log(JSON.stringify({checked_at:new Date().toISOString(),orders,attention,submissions,hands_on},null,2));
