import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import handler from '../../server/api-src/stripe-webhook.ts';
import { signStripePayload } from './stripe.ts';
import { getSqlClient } from './db.ts';
import { handsOnQueue, updateHandsOnWork } from './hands-on-work.ts';

test('canonical Deep149 and Pro499 paid events reach durable human work exactly once', async () => {
  const saved = {...process.env}; const originalFetch = globalThis.fetch;
  const dir = await mkdtemp(join(tmpdir(),'audit-deep-tier-isolated-'));
  delete process.env.POSTGRES_URL; delete process.env.VERCEL_ENV;
  process.env.STRIPE_SECRET_KEY='sk_test_isolated';
  process.env.STRIPE_WEBHOOK_SECRET='whsec_isolated';
  process.env.STRIPE_SESSION_FIXTURE_DIR=dir;
  process.env.LAUNCHAUDIT_LOCAL_DB=join(dir,'db');
  globalThis.fetch=async()=>{throw new Error('Outbound network prohibited in isolated tier mapping proof')};
  const invoke=async(sessionId:string,type='checkout.session.completed')=>{
    const body=JSON.stringify({id:`evt_fixture_${sessionId}`,type,data:{object:{id:sessionId}}});
    let status=0;let result:any;
    const res={status(n:number){status=n;return res},json(value:unknown){result=value}};
    await handler({method:'POST',headers:{'stripe-signature':signStripePayload(body,'whsec_isolated')},body} as never,res);
    assert.equal(status,200);return result;
  };
  try {
    for (const [tier,amount] of [['standard',14900],['pro',49900]] as const) {
      const id=`cs_test_mapping_${tier}`;
      const canonical={id,livemode:false,mode:'payment',status:'complete',payment_status:'paid',currency:'usd',amount_total:amount,
        customer_details:{email:'fixture@example.invalid'},metadata:{tier,target_url:'https://fixture.invalid'},
        payment_intent:{id:`pi_fixture_${tier}`,livemode:false,status:'succeeded',latest_charge:{livemode:false,paid:true,amount_refunded:0,disputed:false,created:1789400000}}};
      await writeFile(join(dir,`${id}.json`),JSON.stringify(canonical));
      assert.equal((await invoke(id)).status,'queued');
      assert.equal((await invoke(id)).status,'queued');
    }
    const sql=await getSqlClient();assert.ok(sql);
    await sql(await readFile('db/migrations/009_hands_on_work.sql','utf8'));
    const rows=await sql('select id,stripe_session_id,tier,amount_cents,status,target_url,paid_at from paid_audits order by tier');
    assert.equal(rows.length,2);
    for (const row of rows) {
      assert.equal(row.amount_cents,row.tier==='standard'?14900:49900);
      assert.equal(row.target_url,'https://fixture.invalid');assert.ok(row.paid_at);
      const claimed=await updateHandsOnWork(sql,{order_id:String(row.id),owner:'isolated-operator',expected_version:0,action:'claim'});
      assert.equal(claimed.state,'pending_scope');
      // Another genuine handler replay must not replace the order or its owned work.
      await invoke(String(row.stripe_session_id));
    }
    const queue=await handsOnQueue(sql);assert.equal(queue.orders.length,2);
    assert.deepEqual(queue.orders.map(r=>r.tier).sort(),['pro','standard']);
    assert.ok(queue.orders.every(r=>r.owner==='isolated-operator' && r.hands_on_state==='pending_scope'));
    assert.ok(queue.orders.every(r=>r.next_action==='Confirm scope by email within one business day of payment'));
    // Actual handler lifecycle event closes only its corresponding human-work lane.
    await invoke('cs_test_mapping_standard','checkout.session.async_payment_failed');
    assert.deepEqual((await handsOnQueue(sql)).orders.map(r=>r.tier),['pro']);
    assert.equal((await sql('select count(*)::int as n from paid_audits'))[0].n,2);
  } finally {
    globalThis.fetch=originalFetch;
    for(const key of ['POSTGRES_URL','VERCEL_ENV','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_SESSION_FIXTURE_DIR','LAUNCHAUDIT_LOCAL_DB']) {
      if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];
    }
  }
});
