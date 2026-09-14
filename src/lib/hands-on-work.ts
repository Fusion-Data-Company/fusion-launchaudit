/** Internal human-work ledger. No audit, email, payment or deployment side effects. */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import type { SqlClient } from './db.ts';

const eligible = `a.tier in ('standard','pro') and a.paid_at is not null
  and a.amount_cents=case when a.tier='standard' then 14900 else 49900 end
  and a.status in ('awaiting_url','queued','delivered')
  and not exists(select 1 from paid_audit_payment_state p where p.stripe_session_id=a.stripe_session_id)`;

export async function handsOnState(sql: SqlClient, orderId: string): Promise<'pending_scope'|'scoped'|'report_delivered'|'complete'> {
  const exists = await sql("select to_regclass('audit_hands_on_work') as relation");
  if (!exists[0]?.relation) return 'pending_scope';
  const row = (await sql('select state from audit_hands_on_work where order_id=$1', [orderId]))[0];
  return row?.state === 'scoped' || row?.state === 'report_delivered' || row?.state === 'complete' ? row.state : 'pending_scope';
}

export async function handsOnQueue(sql: SqlClient) {
  const exists = await sql("select to_regclass('audit_hands_on_work') as relation");
  const installed = Boolean(exists[0]?.relation);
  const rows = await sql(`select a.id, a.stripe_session_id, a.tier, a.status as automated_status,
    a.paid_at, a.target_url,
    ${installed ? "w.owner,w.version,coalesce(w.state,'pending_scope') as hands_on_state,w.contact,w.scope,w.report,w.call,w.reaudit" : "null as owner,0 as version,'pending_scope' as hands_on_state,null as contact,null as scope,null as report,null as call,null as reaudit"}
    from paid_audits a ${installed ? 'left join audit_hands_on_work w on w.order_id=a.id' : ''}
    where ${eligible} ${installed ? "and coalesce(w.state,'pending_scope')<>'complete'" : ''}
    order by a.paid_at limit 100`);
  return { schema_installed: installed, orders: rows.map(row => ({ ...row,
    next_action: !row.contact ? 'Confirm scope by email within one business day of payment'
      : !row.scope ? 'Record buyer-confirmed scope and authorization'
      : !row.report ? `Deliver evidenced hands-on report within ${row.tier === 'pro' ? 'three' : 'two'} business days of scope`
      : !row.call ? 'Complete the 30 minute walkthrough'
      : 'Re-audit when the buyer ships fixes; retain this entitlement',
  })) };
}

type Artifact = { path: string; sha256: string };
export async function verifyHandsOnEvidence(value: unknown): Promise<Artifact> {
  const a = value as Artifact | null;
  if (!a || !isAbsolute(a.path || '') || !/^[a-f0-9]{64}$/.test(a.sha256 || '')
    || /(^|\/)\.env(?:\.|\/|$)|(^|\/)_secure(\/|$)/i.test(a.path)) throw new Error('Absolute non-secret artifact path and SHA-256 required');
  const stat = await lstat(a.path);
  if (!stat.isFile() || stat.size === 0) throw new Error('Evidence must be a nonempty regular file');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(a.path)) hash.update(chunk);
  if (hash.digest('hex') !== a.sha256) throw new Error('Evidence hash mismatch');
  return { path: a.path, sha256: a.sha256 };
}

export type HandsOnCommand = {
  order_id: string; owner: string; expected_version: number;
  action: 'claim'|'contact'|'scope'|'report'|'call'|'reaudit';
  evidence?: Artifact; receipt?: string;
  fix_plan?: Artifact;
  checks?: Array<{ check: string; result: 'pass'|'fail'; evidence: Artifact }>;
  identity_refs?: string[]; minutes?: number;
};

export async function updateHandsOnWork(sql: SqlClient, command: HandsOnCommand) {
  const c = command;
  if (!/^pa_[A-Za-z0-9_]+$/.test(c.order_id) || !c.owner?.trim() || c.owner.length > 100
    || !Number.isInteger(c.expected_version) || c.expected_version < 0) throw new Error('Order, operator and expected version required');
  const order = (await sql(`select a.* from paid_audits a where a.id=$1 and ${eligible}`, [c.order_id]))[0];
  if (!order) throw new Error('Eligible paid Deep/Pro order required');
  if (c.action === 'claim') {
    if (c.expected_version !== 0) throw new Error('Initial claim requires version zero');
    const claimed = await sql(`insert into audit_hands_on_work(order_id,owner,history)
      select a.id,$2,jsonb_build_array(jsonb_build_object('action','claim','owner',$2::text,'at',now()))
      from paid_audits a where a.id=$1 and ${eligible}
      on conflict(order_id) do nothing returning *`, [c.order_id,c.owner]);
    if (!claimed.length) throw new Error('Work already claimed; inspect owner/version');
    return claimed[0];
  }
  const current = (await sql('select * from audit_hands_on_work where order_id=$1', [c.order_id]))[0];
  if (!current || current.owner !== c.owner || current.version !== c.expected_version || current.state === 'complete')
    throw new Error('Owner/version conflict or work already complete');
  if (!['contact','scope','report','call','reaudit'].includes(c.action)) throw new Error('Unsupported action');
  if (current[c.action]) throw new Error('Step already recorded');
  const evidence = await verifyHandsOnEvidence(c.evidence);
  const record: Record<string, unknown> = { evidence, at: new Date().toISOString(), operator: c.owner };
  if (['contact','report','reaudit'].includes(c.action)) {
    if (!c.receipt || !/^\S{3,200}$/.test(c.receipt)) throw new Error('Existing provider acceptance receipt required; this command never sends');
    record.receipt = c.receipt;
  }
  if (c.action !== 'contact' && (order.status !== 'delivered' || !order.target_url)) throw new Error('Named target and automated report required before scoping');
  if (c.action === 'scope') {
    if (!current.contact) throw new Error('Record actual scope contact first');
    if (order.tier === 'pro' && (!Array.isArray(c.identity_refs) || c.identity_refs.length !== 2
      || c.identity_refs.some(ref => !ref.trim()) || c.identity_refs[0] === c.identity_refs[1]))
      throw new Error('Pro scope requires two distinct test identity references, never credentials');
    record.identity_refs = c.identity_refs || [];
  }
  if (['report','call','reaudit'].includes(c.action) && !current.scope) throw new Error('Confirmed scope required');
  if (c.action === 'report' || c.action === 'reaudit') {
    record.fix_plan = await verifyHandsOnEvidence(c.fix_plan);
    const required = ['access_control','admin_rbac','write_authorization', ...(order.tier === 'pro' ? ['two_identity_idor','privilege'] : [])];
    if (!Array.isArray(c.checks) || c.checks.length !== required.length
      || required.some(check => c.checks!.filter(x => x.check === check).length !== 1)) throw new Error('Evidence per promised check required');
    for (const check of c.checks) {
      if (!['pass','fail'].includes(check.result)) throw new Error('Untested/blocked checks cannot mark hands-on work delivered');
      await verifyHandsOnEvidence(check.evidence);
    }
    record.checks = c.checks;
  }
  if (c.action === 'call' || c.action === 'reaudit') {
    if (order.tier !== 'pro' || !current.report) throw new Error('Pro initial report must be delivered first');
    if (c.action === 'call' && (!Number.isFinite(c.minutes) || c.minutes! < 30)) throw new Error('Completed 30 minute walkthrough required');
    if (c.action === 'call') record.minutes = c.minutes;
  }
  const next = { ...current, [c.action]: record };
  const state = next.report ? (order.tier === 'standard' || (next.call && next.reaudit) ? 'complete' : 'report_delivered') : next.scope ? 'scoped' : 'pending_scope';
  // Column name is selected only from the literal action allowlist above.
  const rows = await sql(`update audit_hands_on_work w set ${c.action}=$4::jsonb,state=$5,version=version+1,updated_at=now(),
    history=history || jsonb_build_array(jsonb_build_object('action',$6::text,'owner',$2::text,'at',now(),'evidence',$4::jsonb))
    from paid_audits a where w.order_id=$1 and a.id=w.order_id and w.owner=$2 and w.version=$3
      and ${eligible} returning w.*`, [c.order_id,c.owner,c.expected_version,JSON.stringify(record),state,c.action]);
  if (!rows.length) throw new Error('Owner/version/payment changed; no progress recorded');
  return rows[0];
}
