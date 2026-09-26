import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildMessage, mailerConfigured, sendMail, sendGmailMessage } from "./mailer.ts";

test("mailerConfigured is false without both env vars", () => {
  assert.equal(mailerConfigured({}), false);
  assert.equal(mailerConfigured({ MONITOR_SMTP_URL: "smtps://u:p@h:465" }), false);
  assert.equal(mailerConfigured({ MONITOR_SMTP_URL: "smtps://u:p@h:465", MONITOR_MAIL_FROM: "a@b.c" }), true);
  assert.equal(mailerConfigured({ GOOGLE_CLIENT_ID:'client', GOOGLE_CLIENT_SECRET:'secret', GOOGLE_REFRESH_TOKEN:'refresh', FROM_EMAIL:'a@b.c' }), true);
});

test('Workspace delivery preserves the complete MIME attachment and requires a provider message id',async()=>{
  const message=buildMessage('a@b.c',{to:'b@b.c',subject:'Report',text:'Actual report',attachments:[{filename:'audit.pdf',contentType:'application/pdf',content:Buffer.from('%PDF-1.4')}]});
  const requests:Array<{url:string,init:RequestInit|undefined}>=[];
  const request:typeof fetch=async(input,init)=>{requests.push({url:String(input),init});return new Response(JSON.stringify(requests.length===1?{access_token:'test-access'}:{id:'gmail-message'}),{status:200});};
  const result=await sendGmailMessage(message,{GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret',GOOGLE_REFRESH_TOKEN:'refresh'},request);
  assert.deepEqual(result,{ok:true,id:'gmail-message'});
  assert.equal(requests[1].url,'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
  assert.equal(Buffer.from(JSON.parse(String(requests[1].init?.body)).raw,'base64url').toString(),message);
});

test('expired Google authorization never submits mail or exposes provider secret text',async()=>{
  let calls=0;
  const request:typeof fetch=async()=>{calls++;return new Response(JSON.stringify({error:'invalid_grant',error_description:'private-secret'}),{status:400});};
  const result=await sendGmailMessage('message',{},request);
  assert.equal(calls,1);assert.ok('error' in result);assert.match(result.error,/authorization rejected/);assert.doesNotMatch(result.error,/private-secret/);
});

test('ambiguous send failure is not reported as delivered or automatically retried',async()=>{
  let calls=0;
  const request:typeof fetch=async()=>{if(++calls===1)return new Response(JSON.stringify({access_token:'test-access'}));throw Error('connection interrupted');};
  const result=await sendGmailMessage('message',{},request);
  assert.equal(calls,2);assert.ok('error' in result);assert.match(result.error,/outcome uncertain/);
});

test("sendMail is a documented no-op when not configured", async () => {
  const r = await sendMail({ to: "a@b.c", subject: "s", text: "t" }, {});
  assert.ok("skipped" in r);
});

test("sendMail rejects a non-smtps URL without opening a socket", async () => {
  const r = await sendMail({ to: "a@b.c", subject: "s", text: "t" }, { MONITOR_SMTP_URL: "smtp://u:p@h:587", MONITOR_MAIL_FROM: "a@b.c" });
  assert.ok("ok" in r && r.ok === false);
});

test("buildMessage produces a plain message, and a multipart/mixed one with a base64 PDF attachment", () => {
  const plain = buildMessage("from@80-20.dev", { to: "to@x.y", subject: "Hi\r\nthere", text: "line one\n.starts with dot" }, { date: new Date(0), messageId: "<id@80-20.dev>" });
  assert.match(plain, /^From: from@80-20.dev\r\nTo: to@x.y\r\nSubject: Hi there\r\n/);
  assert.match(plain, /Content-Type: text\/plain; charset=utf-8/);
  assert.match(plain, /\r\n\r\nline one\r\n\.starts with dot$/);

  const pdf = Buffer.from("%PDF-1.4\n%%EOF");
  const mixed = buildMessage("from@80-20.dev", { to: "to@x.y", subject: "Report", text: "body", html: "<p>body</p>", attachments: [{ filename: "report.pdf", contentType: "application/pdf", content: pdf }] });
  assert.match(mixed, /Content-Type: multipart\/mixed; boundary="mixed_[0-9a-f]+"/);
  assert.match(mixed, /Content-Type: multipart\/alternative; boundary="alt_[0-9a-f]+"/);
  assert.match(mixed, /Content-Type: text\/html; charset=utf-8/);
  assert.match(mixed, /Content-Disposition: attachment; filename="report.pdf"/);
  assert.ok(mixed.includes(pdf.toString("base64")));
  assert.match(mixed, /--mixed_[0-9a-f]+--$/);
});

test("MAIL_CAPTURE_DIR writes the exact outbound .eml even when SMTP is not configured", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mailcap-"));
  const r = await sendMail({ to: "rob@fusiondataco.com", subject: "Captured", text: "hello", attachments: [{ filename: "a.pdf", contentType: "application/pdf", content: Buffer.from("%PDF") }] }, { MAIL_CAPTURE_DIR: dir });
  assert.ok("skipped" in r);
  assert.ok(r.captured && r.captured.startsWith(dir));
  const eml = await fs.readFile(r.captured!, "utf8");
  assert.match(eml, /^From: no-reply@80-20.dev\r\n/);
  assert.match(eml, /filename="a.pdf"/);
});
