import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { paidAuditsSchemaSql } from './storage-contract.ts';
import { gradePaidAudit, type PaidAuditRow } from './paid-audits.ts';
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
