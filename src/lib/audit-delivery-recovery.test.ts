import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {ensurePaidAuditsTable, type PaidAuditRow} from './paid-audits.ts';
import {deliverPaidAudit, DELIVERY_RECOVERY_PREDICATE, DELIVERY_ATTENTION_PREDICATE} from './audit-delivery.ts';
import type {SqlClient} from './db.ts';

async function fixture() {
 const db=new PGlite();
 const sql:SqlClient=async(q,p=[]) => (await db.query(q,p)).rows as Record<string,unknown>[];
 await ensurePaidAuditsTable(sql);
 const grade={ok:true,url:'https://example.com',score:80,band:'yellow',passed:3,summary:'Isolated regression fixture',note:'Isolated URL-only audit',pages:['https://example.com'],findings:[],kind:'deep',pages_scanned:1,checks_run:3,lighthouse:null};
 await sql(`insert into paid_audits (id,stripe_session_id,email,target_url,tier,amount_cents,status,grade_json) values ('pa_recovery','cs_test_recovery123','fixture@example.com','https://example.com','single',7900,'delivered',$1::jsonb)`,[JSON.stringify(grade)]);
 const row=async()=>(await sql("select * from paid_audits where id='pa_recovery'"))[0] as PaidAuditRow;
 const age=async()=>sql(`update paid_audits set delivery_json=jsonb_set(delivery_json,'{attempt,started_at}',to_jsonb((now()-interval '1 day')::text))`);
 return {db,sql,row,age};
}
const upload=async()=>null;

test('interrupted pre-send delivery keeps PDF route and is recovered by the sweep predicate',async()=>{
 const f=await fixture();let sends=0;
 try {
  await assert.rejects(deliverPaidAudit(f.sql,await f.row(),{upload:async()=>{throw Error('interrupted before send')},send:async()=>{sends++;return {ok:true}}}));
  assert.match((await f.row()).report_pdf_url!,/api\/order-report/);
  assert.equal(sends,0);
  assert.equal((await f.sql(`select id from paid_audits where ${DELIVERY_RECOVERY_PREDICATE}`)).length,0);
  await f.age();
  assert.equal((await f.sql(`select id from paid_audits where ${DELIVERY_RECOVERY_PREDICATE}`)).length,1);
  const recovered=await deliverPaidAudit(f.sql,await f.row(),{upload,send:async()=>{sends++;return {ok:true}}});
  assert.equal(recovered.delivery_json?.email.status,'sent');assert.equal(sends,1);
  await deliverPaidAudit(f.sql,await f.row(),{upload,send:async()=>{sends++;return {ok:true}}});
  assert.equal(sends,1);
 }finally{await f.db.close()}
});

test('acceptance followed by persistence failure stays held without automatic resend',async()=>{
 const f=await fixture();let sends=0;
 try {
  const failing:SqlClient=async(q,p)=>{if(q.startsWith('update paid_audits set delivery_json=$2'))throw Error('interruption after SMTP acceptance');return f.sql(q,p)};
  await assert.rejects(deliverPaidAudit(failing,await f.row(),{upload,send:async()=>{sends++;return {ok:true}}}));
  assert.equal((await f.row()).delivery_json?.attempt?.state,'sending');
  assert.equal((await f.sql(`select id from paid_audits where ${DELIVERY_ATTENTION_PREDICATE}`)).length,0);
  await f.age();
  assert.equal((await f.sql(`select id from paid_audits where ${DELIVERY_ATTENTION_PREDICATE}`)).length,1);
  assert.equal((await f.sql(`select id from paid_audits where ${DELIVERY_RECOVERY_PREDICATE}`)).length,0);
  await deliverPaidAudit(f.sql,await f.row(),{upload,send:async()=>{sends++;return {ok:true}}});
  assert.equal(sends,1);
 }finally{await f.db.close()}
});

test('definite SMTP rejection retries after cooldown; timeout remains uncertain',async()=>{
 for(const error of ['SMTP step 6 expected 250, got: 550 Recipient rejected','SMTP timeout','SMTP step 9 expected 221, got: 500 QUIT rejected']) {
  const f=await fixture();let sends=0;
  try {
   await deliverPaidAudit(f.sql,await f.row(),{upload,send:async()=>{sends++;return {ok:false,error}}});
   const retryable=error.startsWith('SMTP step 6');
   assert.equal((await f.row()).delivery_json?.attempt?.state,retryable?'retryable':'uncertain');
   await f.age();
   await deliverPaidAudit(f.sql,await f.row(),{upload,send:async()=>{sends++;return {ok:true}}});
   assert.equal(sends,retryable?2:1);
  }finally{await f.db.close()}
 }
});

test('concurrent browser and cron delivery claim one sender',async()=>{
 const f=await fixture();let sends=0;let release!:()=>void;let entered!:()=>void;
 const barrier=new Promise<void>(r=>release=r);const started=new Promise<void>(r=>entered=r);
 const deps={upload:async()=>{entered();await barrier;return null},send:async()=>{sends++;return {ok:true as const}}};
 try{
  const stale=await f.row();const first=deliverPaidAudit(f.sql,stale,deps);await started;
  await deliverPaidAudit(f.sql,stale,deps);release();await first;
  assert.equal(sends,1);assert.equal((await f.row()).delivery_json?.email.status,'sent');
 }finally{release();await f.db.close()}
});

test('refund during preparation prevents the send',async()=>{
 const f=await fixture();let sends=0;
 try{
  await deliverPaidAudit(f.sql,await f.row(),{upload:async()=>{await f.sql("update paid_audits set status='refunded'");return null},send:async()=>{sends++;return {ok:true}}});
  assert.equal(sends,0);assert.equal((await f.row()).status,'refunded');
 }finally{await f.db.close()}
});
