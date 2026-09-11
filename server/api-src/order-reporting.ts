import {getSqlClient} from '../../src/lib/db.ts';
import {orderCronAuthorized,syncAuditOrders} from '../../src/lib/order-reporting.ts';
export default async function handler(req:any,res:any){if(!orderCronAuthorized(req.headers.authorization))return res.status(401).json({error:'Unauthorized'});if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});try{const sql=await getSqlClient();if(!sql)throw Error('storage');return res.status(200).json(await syncAuditOrders(sql));}catch{return res.status(503).json({error:'Order reporting unavailable; events retained'});}}
