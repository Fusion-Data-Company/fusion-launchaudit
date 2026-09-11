import type {SqlClient} from './db.ts';
import {timingSafeEqual,createHash,randomUUID} from 'node:crypto';
export function orderCronAuthorized(header:string|undefined){const secret=process.env.CRON_SECRET;if(!secret||!header)return false;return timingSafeEqual(createHash('sha256').update(header).digest(),createHash('sha256').update(`Bearer ${secret}`).digest());}
export function auditOrderReport(row:{id:string|number;order_id:string;payload:Record<string,any>;created_at:string|Date}):Record<string,any>{const p=row.payload;return{...p,version:Number(row.id),eventId:`launchaudit-v1:${row.order_id}:${row.id}`,createdAt:new Date(p.createdAt).toISOString(),paidAt:p.paidAt?new Date(p.paidAt).toISOString():null,packagePreparedAt:null,deliveredAt:p.deliveredAt?new Date(p.deliveredAt).toISOString():null,occurredAt:new Date(row.created_at).toISOString()};}
export async function syncAuditOrders(sql:SqlClient){
 if(!process.env.FUSION_ORDER_CRM_KEY)throw Error('reporting_not_configured');
 const q=async(strings:TemplateStringsArray,...values:unknown[])=>sql(strings.reduce((a,s,i)=>a+(i?`$${i}`:"")+s,""),values);let acknowledged=0,failed=0;
 for(let i=0;i<3;i++){
  const lease=randomUUID();
  const rows=await q`UPDATE audit_crm_outbox SET lease_until=now()+interval '60 seconds',lease_token=${lease}::uuid,attempts=attempts+1 WHERE id=(SELECT id FROM audit_crm_outbox WHERE acknowledged_at IS NULL AND next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`;
  const row=rows[0];if(!row)break;
  try{const payload=auditOrderReport(row as any);const response=await fetch('https://fusiondataco.app/api/ronin/estate/orders',{method:'POST',headers:{'Content-Type':'application/json','x-ronin-key':process.env.FUSION_ORDER_CRM_KEY},body:JSON.stringify(payload),signal:AbortSignal.timeout(6000)});const receipt=await response.json();if(!response.ok||receipt.received!==true||receipt.eventId!==payload.eventId)throw Error('receipt_not_confirmed');const saved=await q`UPDATE audit_crm_outbox SET acknowledged_at=now(),lease_until=NULL,lease_token=NULL,last_error=NULL WHERE id=${row.id} AND lease_token=${lease}::uuid RETURNING id`;acknowledged+=saved.length;
  }catch{const saved=await q`UPDATE audit_crm_outbox SET lease_until=NULL,lease_token=NULL,next_attempt_at=now()+interval '5 minutes',last_error='CRM receipt not confirmed; original event retained' WHERE id=${row.id} AND lease_token=${lease}::uuid RETURNING id`;failed+=saved.length;}
 }
 const pending=await q`SELECT count(*)::int AS count FROM audit_crm_outbox WHERE acknowledged_at IS NULL`;return{acknowledged,failed,pending:pending[0].count};
}
