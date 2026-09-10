import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withAuditDeadline } from './audit-deadline.ts';

test('unfinished audit becomes retryable failure, never a delivered or blocked/refund result', async () => {
 const result = await withAuditDeadline(new Promise(() => {}), 5);
 assert.equal(result.ok, false);
 assert.equal('status' in result && result.status, 503);
 assert.equal('blocked' in result, false);
});
test('completed audit result is preserved and thrown failures are not hidden', async () => {
 const failure = {ok:false as const,status:400,error:'Invalid target'};
 assert.equal(await withAuditDeadline(Promise.resolve(failure), 100), failure);
 await assert.rejects(withAuditDeadline(Promise.reject(new Error('failure')),100), /failure/);
});
