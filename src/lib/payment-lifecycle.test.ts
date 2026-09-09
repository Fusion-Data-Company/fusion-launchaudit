import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { recordPaymentState } from './payment-lifecycle.ts';
import { ensurePaidAuditsTable, upsertPaidAudit } from './paid-audits.ts';
import type { SqlClient } from './db.ts';

test('refund before checkout survives insertion and later failure events',async()=>{
 const db=new PGlite();
 const sql:SqlClient=async(q,p=[]) => (await db.query(q,p)).rows as Record<string,unknown>[];
 try {
  await ensurePaidAuditsTable(sql);
  await recordPaymentState(sql,'cs_test','refunded');
  const row=await upsertPaidAudit(sql,{stripeSessionId:'cs_test',email:'test@example.com',targetUrl:'https://example.com',tier:'single',amountCents:7900});
  assert.equal(row.status,'refunded');
  await recordPaymentState(sql,'cs_test','payment_failed');
  assert.equal((await sql('select status from paid_audits'))[0].status,'refunded');
  await recordPaymentState(sql,'cs_test','disputed');
  await recordPaymentState(sql,'cs_test','refunded');
  assert.equal((await sql('select status from paid_audits'))[0].status,'disputed');
 } finally {await db.close();}
});
