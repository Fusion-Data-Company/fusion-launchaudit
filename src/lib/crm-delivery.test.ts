import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deliverSubmissions} from './crm-delivery.ts';
test('failed delivery stays pending; successful replay marks only stable source event',async()=>{
 const old=globalThis.fetch;const oldKey=process.env.RONIN_API_KEY;process.env.RONIN_API_KEY='test';
 const calls:string[]=[];let status=503;let body:any;
 globalThis.fetch=async(_url,init)=>{body=JSON.parse(String(init?.body));return new Response('{}',{status})};
 const sql=async(text:string)=>{calls.push(text);return text.startsWith('SELECT')?[{id:'id1',name:'Test',email:'test@example.invalid',type:'question',message:'test'}]:[]};
 try{assert.equal((await deliverSubmissions(sql)).delivered,0);assert.equal(calls.some(c=>c.startsWith('INSERT')),false);status=200;assert.equal((await deliverSubmissions(sql)).delivered,1);assert.equal(body.sourceRecordKey,'launch-audit:submission:id1');assert.equal(calls.some(c=>c.startsWith('INSERT')),true)}finally{globalThis.fetch=old;if(oldKey===undefined)delete process.env.RONIN_API_KEY;else process.env.RONIN_API_KEY=oldKey}
});
