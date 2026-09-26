/**
 * Core parser tests, not marketing/checkout tests. Expected group semantics:
 * RFC 9309 sections 2.2.1 (combine matching groups), 2.2.2 (Allow on ties),
 * and 2.2.4 (other records must not terminate groups).
 * https://www.rfc-editor.org/rfc/rfc9309.html
 * Runs the real pure parser with independent fictional input, no mocks/network.
 * This does not validate crawler fetching, all path patterns or full audit scope.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRobots, groupFor, robotsVerdict } from './robots.ts';

const ALL = ['*', 'googlebot', 'bingbot'];
function verdict(text: string, expected: string[]) {
  const result = robotsVerdict(text);
  assert.deepEqual(result.blockedAgents, expected);
  assert.equal(result.blocked, expected.length > 0);
}

test('single full-site exclusion remains detected', () => verdict('User-agent: *\nDisallow: /', ALL));
test('path-only restrictions are not root restrictions', () => verdict('User-agent: *\nAllow: /\nDisallow: /private/\nDisallow: /api/', []));
test('duplicate Googlebot groups combine Allow and Disallow equally', () => verdict('User-agent: Googlebot\nDisallow: /\n\nUser-agent: GOOGLEBOT\nAllow: /', []));
test('a later Googlebot group can contain the blocking rule', () => verdict('User-agent: Googlebot\nDisallow: /private/\n\nUser-agent: Googlebot\nDisallow: /', ['googlebot']));
test('a later default group can contain the blocking rule', () => verdict('User-agent: *\nDisallow: /private/\n\nUser-agent: *\nDisallow: /', ALL));
test('duplicate default groups combine Allow and Disallow equally', () => verdict('User-agent: *\nDisallow: /\n\nUser-agent: *\nAllow: /', []));
test('group order cannot change equivalent-rule result', () => {
  const parts = ['User-agent: Googlebot\nDisallow: /', 'User-agent: Googlebot\nAllow: /'];
  verdict(parts.join('\n\n'), []); verdict(parts.reverse().join('\n\n'), []);
});
test('Sitemap between agent declarations does not split their rules', () => {
  const text = 'User-agent: Googlebot\nSitemap: https://fixture.invalid/sitemap.xml\nUser-agent: Bingbot\nDisallow: /';
  verdict(text, ['googlebot', 'bingbot']);
  assert.deepEqual(parseRobots(text).sitemaps, ['https://fixture.invalid/sitemap.xml']);
});
test('unknown records between agents do not split their rules', () => verdict('User-agent: Googlebot\nCrawl-delay: 4\nUser-agent: Bingbot\nDisallow: /', ['googlebot', 'bingbot']));
test('named groups do not inherit default group rules', () => {
  const text='User-agent: *\nDisallow: /\nUser-agent: Googlebot\nAllow: /';
  verdict(text, ['*','bingbot']);
  assert.deepEqual(groupFor(parseRobots(text).groups,'googlebot')!.disallow, []);
});
test('only equally most-specific matching groups combine', () => {
  const text='User-agent: Googlebot\nDisallow: /general\nUser-agent: Googlebot-Image\nDisallow: /images\nUser-agent: Googlebot-Image\nAllow: /images/public';
  const group=groupFor(parseRobots(text).groups,'Googlebot-Image')!;
  assert.deepEqual(group.disallow,['/images']);
  assert.deepEqual(group.allow,['/images/public']);
});
test('informational crawler blocks also use combined groups', () => {
  const result=robotsVerdict('User-agent: GPTBot\nDisallow: /\nUser-agent: GPTBot\nAllow: /');
  assert.deepEqual(result.otherBlockedAgents,[]);
  assert.equal(result.blocked,false);
});
test('empty and absent rules remain allowed', () => {
  verdict('',[]); verdict('Sitemap: https://fixture.invalid/map.xml',[]); verdict('User-agent: *\nDisallow:',[]);
});
test('group selection does not mutate parsed source or accumulate rules', () => {
  const groups=parseRobots('User-agent: *\nDisallow: /api/\nUser-agent: *\nAllow: /').groups;
  const original=JSON.stringify(groups);
  const first=groupFor(groups,'bingbot');
  for(let n=0;n<10;n++) assert.deepEqual(groupFor(groups,'bingbot'),first);
  assert.equal(JSON.stringify(groups),original);
});
test('other records after an actual rule do not merge the next agent', () => verdict('User-agent: Googlebot\nDisallow: /private/\nSitemap: https://fixture.invalid/map.xml\nUser-agent: Bingbot\nDisallow: /',['bingbot']));
test('case folding and comment/blank handling survive group merging', () => verdict('USER-AGENT: GOOGLEBOT # first\r\nDisallow: /\r\n\r\nuser-agent: googlebot\r\nAllow: / # tie permits\r\n',[]));
