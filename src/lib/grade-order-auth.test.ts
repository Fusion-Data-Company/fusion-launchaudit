import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../server/api-src/grade-order.ts';

test('scheduled grading rejects missing credentials and accepts only configured bearer secrets', async()=>{
 const keys=['CRON_SECRET','RUNNER_SYNC_SECRET','POSTGRES_URL','LAUNCHAUDIT_LOCAL_DB'];
 const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try {
  for(const k of keys)delete process.env[k];
  async function request(auth?:string){
   let status=0;
   const res={status(n:number){status=n;return res;},json(_body:unknown){}};
   await handler({method:'GET',headers:auth?{authorization:auth}:{}},res);
   return status;
  }
  assert.equal(await request(),401);
  process.env.CRON_SECRET='cron-test-only';process.env.RUNNER_SYNC_SECRET='runner-test-only';
  assert.equal(await request('Bearer wrong'),401);
  // Authorized requests reach the database gate; no production DB is accessed.
  assert.equal(await request('Bearer cron-test-only'),503);
  assert.equal(await request('Bearer runner-test-only'),503);
 } finally {for(const k of keys)if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}
});
