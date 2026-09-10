import { timingSafeEqual } from 'node:crypto';
import { getSqlClient } from '../../src/lib/db.ts';
import { deliverSubmissions, deliverScanLeads } from '../../src/lib/crm-delivery.ts';
export default async function handler(req:any,res:any) {
 const expected=process.env.CRON_SECRET?.trim();
 const received=typeof req.headers?.authorization==='string'?req.headers.authorization:'';
 const a=Buffer.from(received),b=Buffer.from(`Bearer ${expected || ''}`);
 if(!expected||a.length!==b.length||!timingSafeEqual(a,b))return res.status(401).json({error:'Unauthorized'});
 if(req.method!=='GET'&&req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 const sql=await getSqlClient();if(!sql)return res.status(503).json({error:'Storage unavailable'});
 try{return res.status(200).json({submissions:await deliverSubmissions(sql),scanLeads:await deliverScanLeads(sql)});}catch{return res.status(503).json({error:'CRM reconciliation unavailable'});}
}
