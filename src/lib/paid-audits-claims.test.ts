import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { paidAuditsSchemaSql } from './storage-contract.ts';
import { ensurePaidAuditsTable, gradePaidAudit, refundBlockedOrder, type PaidAuditRow } from './paid-audits.ts';
import { recordPaymentState } from './payment-lifecycle.ts';
import type { SqlClient } from './db.ts';

test('an existing claim prevents a second grader and a refund cannot be overwritten', async () => {
  const db = new PGlite();
  try {
    await db.exec(paidAuditsSchemaSql);
    await db.query(`insert into paid_audits(id,stripe_session_id,email,target_url,tier,status)
      values ('pa_test','cs_test','buyer@example.com','invalid-url','single','queued')`);
    const sql: SqlClient = async (q,p=[]) => (await db.query(q,p)).rows as Record<string,unknown>[];
    const row=(await sql('select * from paid_audits'))[0] as PaidAuditRow;
    await sql("update paid_audits set grade_claim_token='first',grade_claimed_at=now()");
    await gradePaidAudit(sql,row);
    assert.equal((await sql('select grade_claim_token from paid_audits'))[0].grade_claim_token,'first');
    await sql('update paid_audits set grade_claim_token=null,grade_claimed_at=null');
    const lifecycleRace: SqlClient = async (q,p=[]) => {
      if(q.startsWith('update paid_audits set grade_json')) await sql("update paid_audits set status='refunded'");
      return sql(q,p);
    };
    const result=await gradePaidAudit(lifecycleRace,row);
    assert.equal(result.status,'refunded');
    assert.equal(result.grade_json,null);
  } finally { await db.close(); }
});

test('a lifecycle close observed after claiming fences the automatic refund', async () => {
  const db = new PGlite();
  const previousSecret = process.env.STRIPE_SECRET_KEY;
  try {
    const sql: SqlClient = async (q,p=[]) => (await db.query(q,p)).rows as Record<string,unknown>[];
    await ensurePaidAuditsTable(sql);
    await sql(`insert into paid_audits(id,stripe_session_id,email,target_url,tier,status,grade_claim_token)
      values ('pa_race','cs_race','buyer@example.com','https://example.com','single','queued','claim-race')`);
    await recordPaymentState(sql, 'cs_race', 'refunded');
    process.env.STRIPE_SECRET_KEY = 'sk_test_unused';
    const result = await refundBlockedOrder(sql, (await sql("select * from paid_audits where id='pa_race'"))[0] as PaidAuditRow, 'claim-race');
    assert.equal(result.id, undefined);
    assert.match(result.skipped ?? '', /order is refunded/);
    assert.equal((await sql("select status from paid_audits where id='pa_race'"))[0].status, 'refunded');
  } finally {
    if (previousSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousSecret;
    await db.close();
  }
});
