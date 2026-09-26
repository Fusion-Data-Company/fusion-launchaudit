import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../server/api-src/demo.ts';

test('saved sample PDF keeps its report identity and never substitutes a missing report', async () => {
  delete process.env.POSTGRES_URL;
  delete process.env.LAUNCHAUDIT_LOCAL_DB;
  const invoke = async (url: string, method = 'GET') => {
    let status = 0;
    let body: any;
    const headers: Record<string, string> = {};
    const res = {status(n: number) {status = n; return res;},
      setHeader(k: string, v: string) {headers[k] = v;},
      json(value: unknown) {body = value;}, end(value?: Buffer | string) {body = value;}};
    await handler({url, method}, res);
    return {status, body, headers};
  };
  const sample = await invoke('/api/demo');
  assert.equal(sample.status, 200);
  const pdf = await invoke(sample.body.report.pdf_url);
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers['content-type'], 'application/pdf');
  const text = pdf.body.toString('latin1');
  assert.ok(text.startsWith('%PDF'));
  assert.ok(text.includes(sample.body.report.id));
  assert.match(text, /Sample generated/);
  assert.doesNotMatch(text, /Paid Sep|Launch ready/);
  const missing = await invoke('/api/demo?format=pdf&id=demo_missing');
  assert.equal(missing.status, 404);
  assert.equal(missing.headers['cache-control'], 'no-store');
  assert.equal((await invoke('/api/demo?id=invalid')).status, 400);
  assert.equal((await invoke('/api/demo', 'POST')).status, 401);
});
