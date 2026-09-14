import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const script = readFileSync(new URL('../../public/assets/order-success.js', import.meta.url), 'utf8');
type Response = { status?: number; body: Record<string, unknown> };
function page(responses: Response[]) {
  const nodes = new Map<string, { innerHTML: string; textContent: string; className: string; hidden: boolean; addEventListener: (...args: unknown[]) => void }>();
  function node(id: string) {
    if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', className: '', hidden: false, addEventListener: () => {} });
    return nodes.get(id)!;
  }
  const timers: (() => Promise<void>)[] = [];
  let requests = 0;
  runInNewContext(script, {
    URLSearchParams,
    window: { renderAuditReport: (element: {innerHTML: string}, value: unknown) => { element.innerHTML = JSON.stringify(value); }, location: { search: '?session_id=cs_test_recovery123', href: 'https://80-20.dev/order/success?session_id=cs_test_recovery123' } },
    document: { getElementById: node, querySelector: node },
    fetch: async () => {
      const response = responses[Math.min(requests++, responses.length - 1)];
      return { status: response.status ?? 200, json: async () => response.body };
    },
    setTimeout: (callback: () => Promise<void>) => timers.push(callback),
  });
  return { node, timers, requests: () => requests, settle: () => new Promise<void>(resolve => setImmediate(resolve)) };
}
const delivered = { tier_label: 'Single Run', amount_display: '$79', includes: 'URL audit', next: 'Report delivered', report_url: 'https://example.com/report', report_pdf_url: 'https://example.com/report.pdf', email_delivery: {status: 'sent'}, ok: true, status: 'delivered', tier: 'single', target_url: 'https://example.com', grade: { score: 82, band: 'green', findings: [], pages_scanned: 1, passed: 5, kind: 'deep' } };

test('temporary order API failures retry and display the persisted report', async () => {
  for (const status of [429, 500, 503]) {
    const p = page([{ status, body: { error: 'Unavailable' } }, { body: delivered }]);
    await p.settle();
    assert.equal(p.timers.length, 1);
    await p.timers.shift()!();
    assert.equal(p.requests(), 2);
    assert.equal(p.node('order-chip').textContent, 'Report ready');
    assert.equal(p.node('st-paid').className, 'done');
    assert.match(p.node('report').innerHTML, /Single Run complete/);
    assert.match(p.node('report-actions').innerHTML, /Download the PDF/);
    assert.match(p.node('report-actions').innerHTML, /Open the hosted copy/);
    assert.match(p.node('order-summary').innerHTML, /Email sent/);
  }
});

test('queued audit error automatically retries until the report is delivered', async () => {
  const p = page([{ body: { ok: true, status: 'queued', tier: 'single', target_url: 'https://example.com', grade_error: 'Execution window exceeded' } }, { body: delivered }]);
  await p.settle();
  assert.equal(p.node('order-chip').textContent, 'Retrying');
  assert.equal(p.timers.length, 1);
  await p.timers.shift()!();
  assert.equal(p.node('order-chip').textContent, 'Report ready');
});

test('failed payment is terminal and offers checkout and support without claiming a report', async () => {
  const p = page([{ body: { ok: true, status: 'payment_failed', tier: 'single', target_url: 'https://example.com' } }]);
  await p.settle();
  assert.equal(p.node('order-chip').textContent, 'Payment failed');
  assert.match(p.node('grade').innerHTML, /Return to checkout/);
  assert.match(p.node('grade').innerHTML, /Contact support/);
  assert.equal(p.node('report').hidden, true);
  assert.equal(p.node('st-paid').className, '');
  assert.match(p.node('st-paid').innerHTML, /Payment failed/);
  assert.equal(p.timers.length, 0);
});

test('unconfirmed payment stops after bounded polls without asserting payment success', async () => {
  const p = page([{ body: { ok: true, status: 'pending' } }]);
  await p.settle();
  while (p.timers.length) await p.timers.shift()!();
  assert.equal(p.requests(), 40);
  assert.match(p.node('grade').innerHTML, /have not confirmed/);
  assert.doesNotMatch(p.node('grade').innerHTML, /payment went through/);
});

test('permanent invalid-order response does not keep retrying', async () => {
  const p = page([{ status: 400, body: { error: 'Provide a valid session_id.' } }]);
  await p.settle();
  assert.equal(p.timers.length, 0);
  assert.equal(p.node('order-chip').textContent, 'Not found');
});


test('paid-before-URL and hands-on tiers retain their current delivery workflow', async () => {
  const p = page([{body: {...delivered, status: 'awaiting_url', tier: 'pro', tier_label: 'Pro', amount_display: '$499', grade: null, target_url: '', report_url: null, report_pdf_url: null}}]);
  await p.settle();
  assert.equal(p.node('order-chip').textContent, 'Needs your URL');
  assert.equal(p.node('st-paid').className, 'done');
  assert.match(p.node('url-card').innerHTML, /Start the audit/);
  assert.equal(p.timers.length, 0);
  for (const tier of ['standard', 'pro']) {
    const q = page([{body: {...delivered, tier, hands_on: true, next: 'Operator follows up'}}]);
    await q.settle();
    assert.match(q.node('report').innerHTML, /hands-on part is next/);
    assert.match(q.node('report-actions').innerHTML, /Download the PDF/);
  }
});
