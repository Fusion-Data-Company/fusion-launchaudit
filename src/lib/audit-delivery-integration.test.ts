import test from 'node:test';
import assert from 'node:assert/strict';
import tls from 'node:tls';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {getSqlClient} from './db.ts';
import {ensurePaidAuditsTable,type PaidAuditRow} from './paid-audits.ts';
import {deliverPaidAudit} from './audit-delivery.ts';
import {sendMail} from './mailer.ts';
import reportHandler from '../../server/api-src/order-report.ts';

// Entire SMTP conversation terminates on localhost. No customer, Stripe, Blob or provider writes.
test('Single Run delivery sends a real MIME PDF through local TLS SMTP once and regenerates it through the real report handler',async(t)=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'launchaudit-local-smtp-'));
 const cert=path.join(dir,'cert.pem'),key=path.join(dir,'key.pem');
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost','-keyout',key,'-out',cert],{stdio:'ignore'});
 const savedCa=tls.getCACertificates();
 const savedDb=process.env.LAUNCHAUDIT_LOCAL_DB,savedPostgres=process.env.POSTGRES_URL;
 const messages:string[]=[];let connections=0;
 const sockets=new Set<tls.TLSSocket>();
 const server=tls.createServer({key:await readFile(key),cert:await readFile(cert)},socket=>{
  connections++;sockets.add(socket);socket.on('close',()=>sockets.delete(socket));
  let buf='',data=false,auth=0;
  socket.write('220 localhost isolated test SMTP\r\n');
  socket.on('data',chunk=>{
   buf+=chunk.toString();
   while(true){
    if(data){
     const end=buf.indexOf('\r\n.\r\n');if(end<0)return;
     messages.push(buf.slice(0,end).replace(/^\.\./gm,'.'));
     buf=buf.slice(end+5);data=false;socket.write('250 message accepted locally\r\n');continue;
    }
    const end=buf.indexOf('\r\n');if(end<0)return;
    const line=buf.slice(0,end);buf=buf.slice(end+2);
    if(auth===1){assert.equal(Buffer.from(line,'base64').toString(),'fixture');auth=2;socket.write('334 UGFzc3dvcmQ6\r\n');}
    else if(auth===2){assert.equal(Buffer.from(line,'base64').toString(),'fixture');auth=0;socket.write('235 authenticated\r\n');}
    else if(line.startsWith('EHLO '))socket.write('250 localhost\r\n');
    else if(line==='AUTH LOGIN'){auth=1;socket.write('334 VXNlcm5hbWU6\r\n');}
    else if(line.startsWith('MAIL FROM:')||line.startsWith('RCPT TO:'))socket.write('250 accepted\r\n');
    else if(line==='DATA'){data=true;socket.write('354 end with dot\r\n');}
    else if(line==='QUIT'){socket.end('221 bye\r\n');}
    else socket.write('500 unexpected command\r\n');
   }
  });
 });
 try{
  tls.setDefaultCACertificates([...savedCa,await readFile(cert,'utf8')]);
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'localhost',resolve)});
  const address=server.address();assert.ok(address&&typeof address!=='string');
  delete process.env.POSTGRES_URL;process.env.LAUNCHAUDIT_LOCAL_DB='memory://';
  const sql=await getSqlClient();assert.ok(sql);await ensurePaidAuditsTable(sql);
  const grade={ok:true,kind:'deep',url:'https://example.test',score:80,band:'yellow',passed:3,summary:'Isolated Single Run delivery integration fixture.',note:'Local engineering fixture; not a customer audit.',pages_scanned:1,pages:['https://example.test'],checks_run:3,lighthouse:null,findings:[]};
  await sql(`insert into paid_audits(id,stripe_session_id,email,target_url,tier,amount_cents,status,grade_json) values ('pa_local_smtp','cs_test_local_smtp123','buyer@example.test','https://example.test','single',7900,'delivered',$1::jsonb)`,[JSON.stringify(grade)]);
  const row=async()=>(await sql("select * from paid_audits where id='pa_local_smtp'"))[0] as PaidAuditRow;
  const localEnv={MONITOR_SMTP_URL:`smtps://fixture:fixture@localhost:${address.port}`,MONITOR_MAIL_FROM:'sender@example.test'};
  const deps={upload:async()=>null,send:(input:Parameters<typeof sendMail>[0])=>sendMail(input,localEnv)};
  const delivered=await deliverPaidAudit(sql,await row(),deps);
  assert.equal(delivered.delivery_json?.email.status,'sent');
  assert.equal(delivered.delivery_json?.attempt?.state,'done');
  assert.ok(delivered.report_url?.includes('/api/order-report?session_id='));
  assert.equal(messages.length,1);assert.equal(connections,1);
  assert.match(messages[0],/To: buyer@example.test/);assert.match(messages[0],/Content-Type: application\/pdf/);
  const attachment=/Content-Type: application\/pdf[^]*?Content-Disposition: attachment; filename="([^"]+)"\r\n\r\n([A-Za-z0-9+/=\r\n]+)\r\n--/.exec(messages[0]);
  assert.ok(attachment,'MIME must contain the actual base64 PDF attachment');
  const pdf=Buffer.from(attachment[2].replace(/\s/g,''),'base64');
  assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok(pdf.length>1000);
  assert.match(pdf.toString('latin1'),/Single Run/);
  // Replay through delivery entrypoint uses persisted receipt: no second connection or message.
  await deliverPaidAudit(sql,await row(),deps);
  assert.equal(messages.length,1);assert.equal(connections,1);
  const response:{code?:number;bytes?:Buffer;headers:Record<string,string>}={headers:{}};
  const res={status(n:number){response.code=n;return res},setHeader(k:string,v:string){response.headers[k]=v},json(value:unknown){throw Error(JSON.stringify(value))},end(b?:Buffer|string){response.bytes=Buffer.isBuffer(b)?b:Buffer.from(b??'')}};
  await reportHandler({method:'GET',query:{session_id:'cs_test_local_smtp123'}},res);
  assert.equal(response.code,200);assert.equal(response.headers['content-type'],'application/pdf');
  assert.equal(response.bytes?.subarray(0,5).toString(),'%PDF-');
  assert.equal(response.bytes?.length,pdf.length);
  if(process.env.LAUNCHAUDIT_DELIVERY_EVIDENCE_DIR){
   const out=process.env.LAUNCHAUDIT_DELIVERY_EVIDENCE_DIR;await mkdir(out,{recursive:true});
   await writeFile(path.join(out,'local-smtp-message.eml'),messages[0]);await writeFile(path.join(out,'local-smtp-report.pdf'),pdf);
   await writeFile(path.join(out,'result.json'),JSON.stringify({fixture:true,customer_payment:false,external_email_sent:false,local_tls_smtp_accepted:messages.length,smtp_connections:connections,pdf_bytes:pdf.length,regenerated_pdf_http:response.code,regenerated_pdf_bytes:response.bytes?.length},null,2));
  }
  t.diagnostic(`Local TLS SMTP accepted ${messages.length} MIME message; PDF ${pdf.length} bytes; replay sent zero; real report handler returned ${response.code}. No external email or payment.`);
 }finally{
  tls.setDefaultCACertificates(savedCa);
  if(savedDb===undefined)delete process.env.LAUNCHAUDIT_LOCAL_DB;else process.env.LAUNCHAUDIT_LOCAL_DB=savedDb;
  if(savedPostgres===undefined)delete process.env.POSTGRES_URL;else process.env.POSTGRES_URL=savedPostgres;
  for(const socket of sockets)socket.destroy();
  await new Promise<void>(resolve=>server.close(()=>resolve()));
  await rm(dir,{recursive:true,force:true});
 }
});
