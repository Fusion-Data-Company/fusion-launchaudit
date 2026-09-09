/** Read-only operator snapshot. Run with the production POSTGRES_URL supplied by the connected runtime. */
import { getSqlClient } from '../src/lib/db.ts';
const sql = await getSqlClient();
if (!sql) throw new Error('Operations database unavailable');
const orders = await sql(`select status, count(*)::int as count from paid_audits group by status`);
const attention = await sql(`select id, status, created_at, stripe_session_id from paid_audits
  where (status='queued' and created_at < now()-interval '1 hour')
     or (status='blocked' and coalesce(grade_json->'refund'->>'id','')='')
  order by created_at limit 50`);
const submissions = await sql(`select id,name,email,type,message,created_at from submissions order by created_at desc limit 50`);
console.log(JSON.stringify({checked_at:new Date().toISOString(),orders,attention,submissions},null,2));
