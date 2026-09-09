/** Live release check: invalid inputs, protected worker, and one scan of our own public site. No checkout or payment. */
import assert from 'node:assert/strict';
const base = process.argv[2];
if (!base || !/^https:\/\//.test(base)) throw new Error('Pass the HTTPS deployment URL');
async function check(path: string, expected: number, body?: unknown) {
  const r = await fetch(new URL(path,base), {method: body===undefined?'GET':'POST', ...(body===undefined?{}:{headers:{'content-type':'application/json'},body:JSON.stringify(body)}),signal:AbortSignal.timeout(45000)});
  const text = await r.text();
  assert.equal(r.status,expected,`${path}: ${text.slice(0,160)}`);
  let data: any; try {data=JSON.parse(text);} catch {throw new Error(`${path}: non-JSON response`);}
  console.log(JSON.stringify({path,status:r.status,ok:data.ok,error:data.error}));
  return data;
}
await check('/api/contact',400,{email:{},message:7});
await check('/api/grade',400,{url:'http://[::ffff:7f00:1]/'});
await check('/api/grade-order',401);
await check('/api/order-status',400);
const grade=await check('/api/grade',200,{url:'https://80-20.dev/'});
assert.equal(grade.ok,true);
assert.equal(typeof grade.score,'number');
assert.ok(Array.isArray(grade.findings));
console.log(JSON.stringify({result:'PASS',score:grade.score,findings:grade.findings.length,payment_created:false}));
