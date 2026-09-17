/**
 * Provider-free regression checks for report access after payment closure.
 * Runs the real order handler/public projection in a fresh Node process. SQL,
 * PDF rendering and delivery/provider dependencies are mocked: this is NOT
 * a Stripe, persistence, report-quality or production acceptance test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('closed-payment report access: isolated handler and projection regressions', (t) => {
  const script = String.raw`
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const root = pathToFileURL(process.cwd() + '/');
const moduleUrl = path => new URL(path, root).href;
let row, configured, sqlReads, renders, failRead, forbiddenCalls;
const forbidden = () => { forbiddenCalls++; throw Error('Unexpected external side effect'); };
globalThis.fetch = forbidden;
const sql = async (query, params=[]) => {
  if (query.startsWith('create table')) return [];
  assert.match(query, /^select \* from paid_audits where stripe_session_id = \$1 limit 1$/);
  sqlReads++;
  if (failRead) throw Error('Isolated read failure');
  return row && row.stripe_session_id === params[0] ? [row] : [];
};
mock.module(moduleUrl('src/lib/db.ts'), {namedExports:{getSqlClient:async()=>configured?sql:null}});
mock.module(moduleUrl('src/lib/storage-contract.ts'), {namedExports:{paidAuditsSchemaSql:''}});
mock.module(moduleUrl('src/lib/instant-grade.ts'), {namedExports:{parseTargetUrl:forbidden}});
mock.module(moduleUrl('src/lib/audit-deadline.ts'), {namedExports:{withAuditDeadline:forbidden}});
mock.module(moduleUrl('src/lib/deep-grade.ts'), {namedExports:{runDeepGrade:forbidden}});
mock.module(moduleUrl('src/lib/stripe.ts'), {namedExports:{stripeGet:forbidden,stripeRequest:forbidden}});
mock.module(moduleUrl('src/lib/checkout-input.ts'), {namedExports:{
  formatUsd:n=>'$'+(n/100).toFixed(2),
  tierInfo:tier=>({label:tier,handsOn:false,includes:'Fixture scope',next:'Fixture next step'})
}});
const reportUrl = id=>'https://fixture.invalid/api/order-report?session_id='+id;
mock.module(moduleUrl('src/lib/audit-delivery.ts'), {namedExports:{
  deliverPaidAudit:forbidden,
  orderReportRouteUrl:reportUrl,
  orderPageUrl:id=>'https://fixture.invalid/order/success?session_id='+id
}});
const mockBytes = Buffer.from('mocked PDF renderer output');
mock.module(moduleUrl('src/lib/audit-report-pdf.ts'), {namedExports:{
  renderAuditReportPdf:()=>{renders++;return mockBytes;},reportFilename:()=>'fixture.pdf'
}});
const { publicOrderStatus } = await import(moduleUrl('src/lib/paid-audits.ts'));
const { default: handler } = await import(moduleUrl('server/api-src/order-report.ts'));
const session = 'cs_test_payment_closure_20260917';
const grade = {ok:true,url:'https://fixture.invalid',score:80,band:'yellow',passed:4,summary:'Fictional test',findings:[]};
function reset(status='delivered') {
  configured=true;sqlReads=0;renders=0;failRead=false;forbiddenCalls=0;
  row={id:'pa_fixture',stripe_session_id:session,email:'buyer@example.invalid',target_url:grade.url,tier:'single',
    amount_cents:7900,status,grade_json:grade,created_at:'2026-09-17T00:00:00Z',completed_at:'2026-09-17T00:01:00Z',
    report_url:reportUrl(session),report_pdf_url:reportUrl(session),
    delivery_json:{email:{status:'sent',at:'2026-09-17T00:01:00Z',detail:null}}};
}
async function invoke(req={method:'GET',query:{session_id:session}}) {
  const result={code:0,headers:{},body:undefined};
  const res={status:n=>{result.code=n;return res;},setHeader:(k,v)=>{result.headers[k]=v;},
    json:body=>{result.body=body;},end:body=>{result.body=body;}};
  await handler(req,res);
  assert.equal(forbiddenCalls,0,'read-only report path must not call providers');
  return result;
}
await test('payment closure controls both report representations',async t=>{
  for(const state of ['payment_failed','refunded','disputed']) {
    await t.test(state+' removes grade, links and email delivery from public status',()=>{
      reset(state);const status=publicOrderStatus(row);
      assert.equal(status.status,state);
      assert.equal(status.grade,null);
      assert.equal(status.report_url,null);
      assert.equal(status.report_pdf_url,null);
      assert.equal(status.email_delivery,null);
      assert.equal(status.amount_cents,7900);
    });
    await t.test(state+' returns 410 before rendering, including repeat requests',async()=>{
      reset(state);
      for(let n=0;n<2;n++) {
        const response=await invoke();
        assert.equal(response.code,410);
        assert.match(response.body.error,new RegExp(state));
        assert.equal(response.headers['cache-control'],'private, no-store');
        assert.equal(Buffer.isBuffer(response.body),false);
      }
      assert.equal(renders,0);
      assert.equal(row.status,state);
    });
  }
  await t.test('delivered paid order retains its report and public projection',async()=>{
    reset();const status=publicOrderStatus(row);
    assert.equal(status.grade.score,80);
    assert.equal(status.report_url,reportUrl(session));
    assert.equal(status.report_pdf_url,reportUrl(session));
    assert.equal(status.email_delivery.status,'sent');
    const response=await invoke();assert.equal(response.code,200);
    assert.deepEqual(response.body,mockBytes);assert.equal(renders,1);
    assert.equal(response.headers['content-type'],'application/pdf');
    assert.equal(response.headers['cache-control'],'private, no-store');
  });
  await t.test('queued order with no grade is not a delivered report',async()=>{
    reset('queued');row.grade_json=null;const response=await invoke();
    assert.equal(response.code,404);assert.equal(response.body.status,'queued');assert.equal(renders,0);
  });
  await t.test('invalid session is rejected before database access',async()=>{
    reset();const response=await invoke({method:'GET',query:{session_id:'invalid'}});
    assert.equal(response.code,400);assert.equal(sqlReads,0);assert.equal(renders,0);
  });
  await t.test('non-GET method is rejected without reading or rendering',async()=>{
    reset();const response=await invoke({method:'POST',query:{session_id:session}});
    assert.equal(response.code,405);assert.equal(sqlReads,0);assert.equal(renders,0);
  });
  await t.test('unconfigured database returns 503 without a report',async()=>{
    reset();configured=false;const response=await invoke();
    assert.equal(response.code,503);assert.equal(sqlReads,0);assert.equal(renders,0);
  });
  await t.test('unknown order returns 404 without a report',async()=>{
    reset();row=null;const response=await invoke();
    assert.equal(response.code,404);assert.equal(renders,0);
  });
  await t.test('database read failure does not expose report bytes',async()=>{
    reset();failRead=true;const response=await invoke();
    assert.equal(response.code,500);assert.equal(renders,0);
  });
  await t.test('query-string fallback preserves the same failed-payment gate',async()=>{
    reset('payment_failed');const response=await invoke({method:'GET',url:'/api/order-report?session_id='+session});
    assert.equal(response.code,410);assert.equal(renders,0);
  });
});
`;
  // Explicit environment allowlist: no production database, Stripe, SMTP or Blob credentials.
  const env: Record<string,string> = {NODE_NO_WARNINGS:'1'};
  for (const key of ['PATH','SystemRoot','TEMP','TMP','HOME']) if (process.env[key]) env[key]=process.env[key]!;
  const result=spawnSync(process.execPath,
    ['--experimental-strip-types','--experimental-test-module-mocks','--input-type=module','--eval',script],
    {cwd:fileURLToPath(new URL('../../',import.meta.url)),env,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
  if (result.error) throw result.error;
  t.diagnostic(result.stdout);
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
});
