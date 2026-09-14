import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { handsOnQueue, handsOnState, updateHandsOnWork, verifyHandsOnEvidence, type HandsOnCommand } from './hands-on-work.ts';
import { paymentLifecycleSchema } from './payment-lifecycle.ts';
import { deliveryEmail } from './audit-delivery.ts';

test('Deep/Pro manual ledger has real SQL ownership, evidence, payment and completion fences', async t => {
  const db = new PGlite(); const dir = await mkdtemp(join(tmpdir(),'hands-on-isolated-'));
  const sql = async (text: string, args: unknown[] = []) => (await db.query<Record<string,unknown>>(text,args)).rows;
  const bytes = 'ISOLATED ENGINEERING FIXTURE. Not customer work, acceptance evidence, or a completed audit.';
  const evidence = { path: join(dir,'fixture.txt'), sha256: createHash('sha256').update(bytes).digest('hex') };
  await writeFile(evidence.path,bytes);
  try {
    await db.exec(await readFile('db/migrations/003_paid_audits.sql','utf8'));
    await db.exec(await readFile('db/migrations/007_order_reporting.sql','utf8'));
    await db.exec(await readFile('db/migrations/008_order_delivery_and_demo.sql','utf8'));
    await db.exec(paymentLifecycleSchema);
    async function order(id: string, tier='standard', status='delivered') {
      await sql(`insert into paid_audits(id,stripe_session_id,email,target_url,tier,amount_cents,status,paid_at,grade_json,report_pdf_url)
        values($1,$2,'fixture@example.invalid','https://fixture.invalid',$3,$4,$5,now(),'{"ok":true}', '/unchanged-report')`,
      [id,`cs_${id}`,tier,tier==='pro'?49900:tier==='single'?7900:14900,status]);
    }
    await order('pa_deep'); await order('pa_pro','pro'); await order('pa_single','single');
    await t.test('queue exposes unscheduled paid tiers before migration, never treats automated delivery as completion', async () => {
      const queue = await handsOnQueue(sql); assert.equal(queue.schema_installed,false);
      assert.equal(queue.orders.length,2); assert.ok(queue.orders.every(row=>row.hands_on_state==='pending_scope'));
    });
    const migration = await readFile('db/migrations/009_hands_on_work.sql','utf8');
    await db.exec(migration); await db.exec(migration);
    const command = (id: string, action: HandsOnCommand['action'], version: number): HandsOnCommand => ({
      order_id:id,owner:'isolated-operator',expected_version:version,action,evidence,receipt:'isolated-acceptance-fixture',
      fix_plan:evidence,identity_refs:['fixture-identity-a','fixture-identity-b'],minutes:30,
      checks:['access_control','admin_rbac','write_authorization',...(id==='pa_pro'?['two_identity_idor','privilege']:[])].map(check=>({check,result:'pass',evidence})),
    });
    await t.test('concurrent claims and stale/foreign owners cannot overwrite', async () => {
      const attempts = await Promise.allSettled([updateHandsOnWork(sql,command('pa_deep','claim',0)),updateHandsOnWork(sql,command('pa_deep','claim',0))]);
      assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
      await assert.rejects(updateHandsOnWork(sql,{...command('pa_deep','contact',1),owner:'other'}),/conflict/);
      await assert.rejects(updateHandsOnWork(sql,command('pa_deep','contact',0)),/conflict/);
      await assert.rejects(updateHandsOnWork(sql,command('pa_single','claim',0)),/Eligible/);
    });
    await t.test('missing or changed evidence, unscoped reports and missing promised checks fail', async () => {
      await assert.rejects(verifyHandsOnEvidence({...evidence,sha256:'0'.repeat(64)}),/hash mismatch/);
      await assert.rejects(verifyHandsOnEvidence({...evidence,path:join(dir,'.env')}),/non-secret/);
      await assert.rejects(updateHandsOnWork(sql,command('pa_deep','report',1)),/scope/);
      await updateHandsOnWork(sql,command('pa_deep','contact',1));
      await updateHandsOnWork(sql,command('pa_deep','scope',2));
      await assert.rejects(updateHandsOnWork(sql,{...command('pa_deep','report',3),checks:[]}),/promised check/);
      await assert.rejects(updateHandsOnWork(sql,{...command('pa_deep','report',3),receipt:''}),/acceptance receipt/);
      await assert.rejects(updateHandsOnWork(sql,{...command('pa_deep','report',3),fix_plan:undefined}),/artifact path/);
    });
    await t.test('automated delivery retry cannot erase manual progress or report access', async () => {
      await sql(`update paid_audits set delivery_json='{"attempt":{"state":"done"}}' where id='pa_deep'`);
      const current=(await sql("select * from audit_hands_on_work where order_id='pa_deep'"))[0];
      assert.equal(current.state,'scoped'); assert.equal(current.version,3);
      const result=await updateHandsOnWork(sql,command('pa_deep','report',3)); assert.equal(result.state,'complete');
      assert.equal(await handsOnState(sql,'pa_deep'),'complete');
      const paid=(await sql("select status,report_pdf_url from paid_audits where id='pa_deep'"))[0];
      assert.deepEqual(paid,{status:'delivered',report_pdf_url:'/unchanged-report'});
      assert.ok(!(await handsOnQueue(sql)).orders.some(row=>row.id==='pa_deep'));
    });
    await t.test('Pro retains re-audit and walkthrough until both have evidence', async () => {
      await updateHandsOnWork(sql,command('pa_pro','claim',0)); await updateHandsOnWork(sql,command('pa_pro','contact',1));
      await assert.rejects(updateHandsOnWork(sql,{...command('pa_pro','scope',2),identity_refs:['same','same']}),/two distinct/);
      await updateHandsOnWork(sql,command('pa_pro','scope',2));
      const report=await updateHandsOnWork(sql,command('pa_pro','report',3)); assert.equal(report.state,'report_delivered');
      await assert.rejects(updateHandsOnWork(sql,{...command('pa_pro','call',4),minutes:5}),/30 minute/);
      await updateHandsOnWork(sql,command('pa_pro','call',4));
      assert.ok((await handsOnQueue(sql)).orders.some(row=>row.id==='pa_pro'));
      const done=await updateHandsOnWork(sql,command('pa_pro','reaudit',5)); assert.equal(done.state,'complete');
      assert.equal((done.history as unknown[]).length,6);
    });
    await t.test('closed payment or payment event arriving during evidence validation fences mutation', async () => {
      for (const status of ['refunded','disputed','payment_failed']) {
        const id=`pa_${status}`; await order(id,'standard',status);
        await assert.rejects(updateHandsOnWork(sql,command(id,'claim',0)),/Eligible/);
      }
      await order('pa_race'); await updateHandsOnWork(sql,command('pa_race','claim',0));
      const racingSql=async(text:string,args:unknown[]=[])=>{
        if(text.startsWith('update audit_hands_on_work')) await sql("insert into paid_audit_payment_state values('cs_pa_race','refunded',now())");
        return sql(text,args);
      };
      await assert.rejects(updateHandsOnWork(racingSql,command('pa_race','contact',1)),/payment changed/);
      assert.equal((await sql("select version from audit_hands_on_work where order_id='pa_race'"))[0].version,1);
      assert.ok(!(await handsOnQueue(sql)).orders.some(row=>row.id==='pa_race'));
    });
    await t.test('automatic Deep/Pro email does not claim hands-on completion', () => {
      const row={id:'pa_fixture',tier:'pro',amount_cents:49900} as Parameters<typeof deliveryEmail>[0];
      const grade={ok:true,url:'https://fixture.invalid',findings:[],passed:1,score:80,band:'green',summary:'Fixture'} as Parameters<typeof deliveryEmail>[1];
      const result=deliveryEmail(row,grade,{report:'https://fixture.invalid/report',page:'https://fixture.invalid/order'});
      assert.match(result.text,/automated URL report/); assert.doesNotMatch(result.text,/Pro audit.*finished/);
      row.delivery_json={hands_on:{required:true,status:'complete'}} as Parameters<typeof deliveryEmail>[0]['delivery_json'];
      const replay=deliveryEmail(row,grade,{report:'https://fixture.invalid/report',page:'https://fixture.invalid/order'});
      assert.match(replay.text,/hands-on work is recorded as complete/); assert.doesNotMatch(replay.text,/to collect a test login and confirm scope/);
    });
  } finally { await db.close(); await rm(dir,{recursive:true,force:true}); }
});
