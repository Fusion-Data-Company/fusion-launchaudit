import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { ensurePaidAuditsTable, gradePaidAudit, type PaidAuditRow } from './paid-audits.ts';
import type { SqlClient } from './db.ts';

test('failed grades and blocked refund attempts respect cooldown; accepted refunds are not retried', async () => {
  const db = new PGlite();
  const sql: SqlClient = async (q, p = []) => (await db.query(q, p)).rows as Record<string, unknown>[];
  const savedSecret = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  try {
    await ensurePaidAuditsTable(sql);
    await sql(`insert into paid_audits(id,stripe_session_id,email,target_url,tier,status)
      values ('pa_retry','cs_retry','fixture@example.invalid','invalid-url','single','queued')`);
    const row = async () => (await sql("select * from paid_audits where id='pa_retry'"))[0] as PaidAuditRow & {grade_claimed_at: string; grade_claim_token: string | null};
    await gradePaidAudit(sql, await row());
    const failed = await row();
    assert.equal(failed.status, 'queued');
    assert.ok(failed.grade_claimed_at);
    assert.equal(failed.grade_claim_token, null);
    await gradePaidAudit(sql, failed);
    assert.deepEqual((await row()).grade_claimed_at, failed.grade_claimed_at);

    await sql(`update paid_audits set status='blocked',grade_claimed_at=now()-interval '11 minutes',
      grade_json='{"blocked":true,"error":"bot wall","refund":{"error":"timeout"}}'::jsonb`);
    await gradePaidAudit(sql, await row());
    const retry = await row();
    assert.equal((retry.grade_json as any).refund.skipped, 'STRIPE_SECRET_KEY unset');
    assert.equal(retry.grade_claim_token, null);
    await gradePaidAudit(sql, retry);
    assert.deepEqual((await row()).grade_claimed_at, retry.grade_claimed_at);

    await sql(`update paid_audits set grade_claimed_at=now()-interval '11 minutes',
      grade_json='{"blocked":true,"refund":{"id":"re_accepted"}}'::jsonb`);
    const accepted = await row();
    await gradePaidAudit(sql, accepted);
    assert.deepEqual((await row()).grade_json, accepted.grade_json);
    assert.deepEqual((await row()).grade_claimed_at, accepted.grade_claimed_at);
  } finally {
    if (savedSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = savedSecret;
    await db.close();
  }
});
