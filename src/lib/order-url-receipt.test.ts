import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { ensurePaidAuditsTable, setPaidAuditUrl, type PaidAuditRow } from './paid-audits.ts';
import { sendOrderUrlReceipt, deliverPaidAudit, URL_RECEIPT_RECOVERY_PREDICATE } from './audit-delivery.ts';
import type { SqlClient } from './db.ts';

async function fixture() {
  const db = new PGlite();
  const sql: SqlClient = async (q,p=[]) => (await db.query(q,p)).rows as Record<string,unknown>[];
  await ensurePaidAuditsTable(sql);
  await sql(`insert into paid_audits (id,stripe_session_id,email,target_url,tier,amount_cents,status)
    values ('receipt','cs_test_receipt123','fixture@example.com','','pro',49900,'awaiting_url')`);
  return {db,sql,row:async()=>(await sql("select * from paid_audits where id='receipt'"))[0] as PaidAuditRow,
    age:async()=>sql(`update paid_audits set url_request_json=jsonb_set(url_request_json,'{started_at}',to_jsonb((now()-interval '1 day')::text))`)};
}

test('one pay-first receipt survives concurrent webhook retries and does not suppress the later PDF', async()=>{
  const f=await fixture();let sends=0;let release!:()=>void;let entered!:()=>void;
  const barrier=new Promise<void>(r=>release=r), started=new Promise<void>(r=>entered=r);
  try {
    const stale=await f.row();
    const first=sendOrderUrlReceipt(f.sql,stale,{send:async mail=>{
      sends++; assert.match(mail.text,/499/);assert.match(mail.text,/cs_test_receipt123/);
      assert.match(mail.text,/has not started/);assert.equal(mail.attachments,undefined);
      entered();await barrier;return {ok:true,id:'gmail_receipt'};
    }});
    await started;
    await sendOrderUrlReceipt(f.sql,stale,{send:async()=>{sends++;return {ok:true}}});
    await setPaidAuditUrl(f.sql,'cs_test_receipt123','https://example.com');
    release();await first;
    assert.equal(sends,1);assert.equal((await f.row()).url_request_json?.provider_message_id,'gmail_receipt');
    assert.equal((await f.row()).delivered_email_at,null);
    const grade={ok:true,url:'https://example.com',score:80,band:'yellow',passed:3,summary:'Isolated fixture',note:'URL-only fixture',pages:['https://example.com'],findings:[],kind:'deep',pages_scanned:1,checks_run:3,lighthouse:null};
    await f.sql(`update paid_audits set status='delivered',grade_json=$1::jsonb`,[JSON.stringify(grade)]);
    await deliverPaidAudit(f.sql,await f.row(),{upload:async()=>null,send:async mail=>{
      sends++;assert.equal(mail.attachments?.length,1);return {ok:true,id:'gmail_pdf'};
    }});
    assert.equal(sends,2);assert.equal((await f.row()).delivery_json?.email.provider_message_id,'gmail_pdf');
    assert.equal((await f.row()).url_request_json?.provider_message_id,'gmail_receipt');
  }finally{release();await f.db.close()}
});

test('definite rejection retries after cooldown; uncertain acceptance never resends automatically',async()=>{
  for(const error of ['Gmail authorization rejected: HTTP 400.','Gmail send outcome uncertain.']) {
    const f=await fixture();let sends=0;
    try {
      await sendOrderUrlReceipt(f.sql,await f.row(),{send:async()=>{sends++;return {ok:false,error}}});
      assert.equal((await f.sql(`select id from paid_audits where ${URL_RECEIPT_RECOVERY_PREDICATE}`)).length,0);
      await f.age();
      await sendOrderUrlReceipt(f.sql,await f.row(),{send:async()=>{sends++;return {ok:true}}});
      assert.equal(sends,error.includes('rejected')?2:1);
    }finally{await f.db.close()}
  }
});

test('refund between receipt preparation and send prevents email',async()=>{
  const f=await fixture();let sends=0;
  try {
    const sql:SqlClient=async(q,p)=>{
      if(q.includes("status='awaiting_url' and url_request_json->>'token'"))await f.sql("update paid_audits set status='refunded'");
      return f.sql(q,p);
    };
    await sendOrderUrlReceipt(sql,await f.row(),{send:async()=>{sends++;return {ok:true}}});
    assert.equal(sends,0);assert.equal((await f.row()).status,'refunded');
  }finally{await f.db.close()}
});
