/**
 * Provider-free report-link regressions using the real delivery and order
 * projection code. SQL, Blob, mail and PDF rendering are simulated; this is
 * not a storage-provider, real-payment or customer-delivery acceptance test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('private report links: isolated delivery and projection regressions', t => {
  const script = String.raw`
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const root = pathToFileURL(process.cwd() + '/');
const moduleUrl = path => new URL(path, root).href;
const forbidden = () => { throw Error('Unexpected provider or network call'); };
globalThis.fetch = forbidden;
const bytes = Buffer.from('isolated renderer bytes, not a production report');
let current, uploads, messages, rendered, claims, uploadFails, closeBeforeSend;
const route = id => 'https://fixture.invalid/api/order-report?session_id=' + encodeURIComponent(id);
const legacy = 'https://legacy.public.blob.vercel-storage.com/fictional-report.pdf';
const privateUrl = 'https://backup.private.blob.vercel-storage.com/fictional-report.pdf';
const grade = {ok:true,url:'https://example.invalid',score:80,band:'yellow',passed:4,summary:'Fictional fixture',findings:[]};
const copy = value => structuredClone(value);
function reset() {
  current={id:'pa_link_fixture',stripe_session_id:'cs_test_report_links',email:'buyer@example.invalid',
    target_url:grade.url,tier:'single',amount_cents:7900,status:'delivered',grade_json:grade,
    created_at:'2026-09-17T00:00:00Z',completed_at:'2026-09-17T00:01:00Z',
    report_url:legacy,report_pdf_url:legacy,delivered_email_at:null,delivery_json:null};
  uploads=[];messages=[];rendered=[];claims=[];uploadFails=false;closeBeforeSend=false;
  process.env.BLOB_READ_WRITE_TOKEN='fixture-only-not-a-credential';
}
const sql = async (query, params=[]) => {
  const q=query.replace(/\s+/g,' ').trim();
  assert.equal(params[0],current.id);
  if(q.startsWith('select * from paid_audits where id=$1')) return [copy(current)];
  if(q.includes('report_pdf_url=$2') && q.endsWith('returning *')) {
    assert.match(q,/status = 'delivered'/);
    if(current.status!=='delivered'||current.delivered_email_at||current.delivery_json?.attempt) return [];
    current.report_url=q.includes('coalesce(report_url,$2)')?(current.report_url??params[1]):params[1];
    current.report_pdf_url=params[1];
    current.delivery_json=JSON.parse(params[2]);
    claims.push(copy(current));
    return [copy(current)];
  }
  if(q.startsWith('update paid_audits set report_url=$2, delivery_json=$3::jsonb')) {
    if(closeBeforeSend) current.status='refunded';
    if(current.status!=='delivered'||current.delivery_json?.attempt?.token!==params[3]) return [];
    current.report_url=params[1];current.delivery_json=JSON.parse(params[2]);return [{id:current.id}];
  }
  if(q.startsWith('update paid_audits set delivery_json=$2::jsonb,')) {
    if(current.status!=='delivered'||current.delivery_json?.attempt?.token!==params[3]) return [];
    current.delivery_json=JSON.parse(params[1]);
    if(params[2]) current.delivered_email_at='2026-09-17T00:02:00Z';
    return [];
  }
  throw Error('Unexpected SQL in isolated fixture: '+q);
};
mock.module(moduleUrl('src/lib/db.ts'),{namedExports:{getSqlClient:forbidden}});
mock.module(moduleUrl('src/lib/storage-contract.ts'),{namedExports:{paidAuditsSchemaSql:''}});
mock.module(moduleUrl('src/lib/instant-grade.ts'),{namedExports:{parseTargetUrl:forbidden}});
mock.module(moduleUrl('src/lib/deep-grade.ts'),{namedExports:{runDeepGrade:forbidden}});
mock.module(moduleUrl('src/lib/audit-deadline.ts'),{namedExports:{withAuditDeadline:forbidden}});
mock.module(moduleUrl('src/lib/stripe.ts'),{namedExports:{stripeGet:forbidden,stripeRequest:forbidden}});
mock.module(moduleUrl('src/lib/checkout-input.ts'),{namedExports:{
  formatUsd:n=>'$'+(n/100).toFixed(2),
  tierInfo:()=>({label:'Single Run',handsOn:false,includes:'Fixture scope',next:'Fixture next step'})
}});
mock.module(moduleUrl('src/lib/mailer.ts'),{namedExports:{sendMail:async message=>{messages.push(message);return {ok:true};}}});
mock.module(moduleUrl('src/lib/audit-report-pdf.ts'),{namedExports:{
  renderAuditReportPdf:input=>{rendered.push(input);return bytes;},
  reportFilename:()=>'fixture.pdf'
}});
mock.module(moduleUrl('src/lib/hands-on-work.ts'),{namedExports:{handsOnState:forbidden}});
mock.module('@vercel/blob',{namedExports:{put:async(path, content, options)=>{
  uploads.push({path,content,options});
  if(uploadFails) throw Error('Private upload rejected by incompatible fixture store');
  return {url:privateUrl,pathname:path};
}}});
const {deliverPaidAudit} = await import(moduleUrl('src/lib/audit-delivery.ts'));
const {publicOrderStatus} = await import(moduleUrl('src/lib/paid-audits.ts'));
function checkDelivery(result) {
  assert.equal(result.report_url,route(current.stripe_session_id));
  assert.equal(result.report_pdf_url,route(current.stripe_session_id));
  assert.equal(messages.length,1);
  assert.ok(messages[0].text.includes(route(current.stripe_session_id)));
  assert.ok(!messages[0].text.includes(legacy));
  assert.ok(!messages[0].text.includes(privateUrl));
  assert.equal(messages[0].attachments.length,1);
  assert.deepEqual(messages[0].attachments[0].content,bytes);
  assert.equal(rendered[0].links.report,route(current.stripe_session_id));
  assert.equal(result.delivery_json.email.status,'sent');
}
await test('customer report links always pass through the payment-guarded route',async t=>{
  await t.test('legacy public URLs are replaced in successful-order projections',()=>{
    reset();const p=publicOrderStatus(current);
    assert.equal(p.report_url,route(current.stripe_session_id));
    assert.equal(p.report_pdf_url,route(current.stripe_session_id));
    assert.equal(p.grade.score,80);assert.equal(current.report_url,legacy);
  });
  await t.test('no completed grade means no stale report links',()=>{
    reset();current.grade_json=null;const p=publicOrderStatus(current);
    assert.equal(p.report_url,null);assert.equal(p.report_pdf_url,null);
  });
  for(const state of ['payment_failed','refunded','disputed']) await t.test(state+' exposes no report link',()=>{
    reset();current.status=state;const p=publicOrderStatus(current);
    assert.equal(p.grade,null);assert.equal(p.report_url,null);assert.equal(p.report_pdf_url,null);
  });
  await t.test('new backups request private storage and email only the guarded route',async()=>{
    reset();const result=await deliverPaidAudit(sql,copy(current));checkDelivery(result);
    assert.equal(uploads.length,1);assert.equal(uploads[0].options.access,'private');
    assert.equal(result.delivery_json.blob.url,privateUrl);
  });
  await t.test('private-backup rejection preserves download and email fulfillment',async()=>{
    reset();uploadFails=true;const result=await deliverPaidAudit(sql,copy(current));checkDelivery(result);
    assert.equal(uploads[0].options.access,'private');assert.equal(result.delivery_json.blob,null);
  });
  await t.test('missing Blob token still delivers the report through its guarded route',async()=>{
    reset();delete process.env.BLOB_READ_WRITE_TOKEN;
    const result=await deliverPaidAudit(sql,copy(current));checkDelivery(result);assert.equal(uploads.length,0);
  });
  await t.test('legacy backup metadata is retained but never redistributed',async()=>{
    reset();current.delivery_json={blob:{url:legacy,pathname:'old-fixture.pdf'},email:{status:'skipped'}};
    const result=await deliverPaidAudit(sql,copy(current));checkDelivery(result);
    assert.equal(result.delivery_json.blob.url,legacy);assert.equal(uploads.length,0);
  });
  await t.test('the durable pre-send claim also replaces an old public link',async()=>{
    reset();await deliverPaidAudit(sql,copy(current));
    assert.equal(claims[0].report_url,route(current.stripe_session_id));
    assert.equal(claims[0].report_pdf_url,route(current.stripe_session_id));
  });
  await t.test('an already-sent delivery is not resent or uploaded again',async()=>{
    reset();const result=await deliverPaidAudit(sql,copy(current));checkDelivery(result);
    await deliverPaidAudit(sql,copy(current));
    assert.equal(messages.length,1);assert.equal(uploads.length,1);
  });
  await t.test('a payment closed before sending still prevents message delivery',async()=>{
    reset();closeBeforeSend=true;const result=await deliverPaidAudit(sql,copy(current));
    assert.equal(result.status,'refunded');assert.equal(messages.length,0);
  });
});
`;
  const env: Record<string,string> = {NODE_NO_WARNINGS:'1',PUBLIC_SITE_URL:'https://fixture.invalid'};
  for(const key of ['PATH','SystemRoot','TEMP','TMP','HOME']) if(process.env[key]) env[key]=process.env[key]!;
  const result=spawnSync(process.execPath,
    ['--experimental-strip-types','--experimental-test-module-mocks','--input-type=module','--eval',script],
    {cwd:fileURLToPath(new URL('../../',import.meta.url)),env,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
  if(result.error) throw result.error;
  t.diagnostic(result.stdout);
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
});
