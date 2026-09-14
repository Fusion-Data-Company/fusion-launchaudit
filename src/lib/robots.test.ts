import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { groupFor, parseRobots, robotsVerdict } from "./robots.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const fusion = fs.readFileSync(path.join(here, "fixtures", "robots-fusiondataco.txt"), "utf8");

test("the live fusiondataco.com robots.txt (Allow: / then path-specific Disallows, many named groups) is NOT a site-wide block", () => {
  const v = robotsVerdict(fusion);
  assert.equal(v.blocked, false, JSON.stringify(v));
  assert.deepEqual(v.blockedAgents, []);
  const star = parseRobots(fusion).groups.find((g) => g.agents.includes("*"));
  assert.ok(star);
  assert.ok(star!.allow.includes("/"));
  assert.ok(star!.disallow.includes("/api/"));
  assert.ok(!star!.disallow.includes("/"));
  // The old regex fired on this exact file; that is the false positive this test pins.
  assert.equal(/^\s*user-agent:\s*\*\s*$[\s\S]*?^\s*disallow:\s*\/\s*$/im.test(fusion), true, "fixture must still contain the pattern that fooled the old check");
});

test("a real Disallow: / for everyone is a block", () => {
  assert.equal(robotsVerdict("User-agent: *\nDisallow: /\n").blocked, true);
  assert.equal(robotsVerdict("user-agent: *\r\ndisallow: /*\r\n").blocked, true);
  assert.deepEqual(robotsVerdict("User-agent: *\nDisallow: /").blockedAgents, ["*", "googlebot", "bingbot"]);
});

test("Allow: / with path Disallows, Allow before or after, is not a block; blank Disallow means allow all", () => {
  assert.equal(robotsVerdict("User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\n").blocked, false);
  assert.equal(robotsVerdict("User-agent: *\nDisallow: /api/\nAllow: /\n").blocked, false);
  assert.equal(robotsVerdict("User-agent: *\nDisallow:\n").blocked, false);
  assert.equal(robotsVerdict("User-agent: *\nDisallow: /private\n").blocked, false);
  // Tie between Allow: / and Disallow: / resolves to allow (least restrictive), as Google does.
  assert.equal(robotsVerdict("User-agent: *\nDisallow: /\nAllow: /\n").blocked, false);
  // A more specific Allow does not rescue a root Disallow.
  assert.equal(robotsVerdict("User-agent: *\nDisallow: /\nAllow: /public/\n").blocked, true);
});

test("comments, BOM, CRLF and blank lines inside a group are handled", () => {
  const txt = "﻿# staging\r\nUser-agent: *   # everyone\r\n\r\nDisallow: /api/ # closed\r\nAllow: /\r\nSitemap: https://x.y/sitemap.xml\r\n";
  const v = robotsVerdict(txt);
  assert.equal(v.blocked, false);
  assert.deepEqual(v.sitemaps, ["https://x.y/sitemap.xml"]);
});

test("named groups are obeyed instead of *, never merged with it; AI crawler groups are informational", () => {
  const txt = ["User-agent: GPTBot", "User-agent: ClaudeBot", "Disallow: /", "", "User-agent: *", "Allow: /", "Disallow: /admin/", "", "User-agent: Googlebot", "Disallow: /private/"].join("\n");
  const v = robotsVerdict(txt);
  assert.equal(v.blocked, false);
  assert.deepEqual(v.otherBlockedAgents, ["gptbot", "claudebot"]);
  assert.deepEqual(groupFor(parseRobots(txt).groups, "Googlebot-Image")!.disallow, ["/private/"]);
  assert.deepEqual(groupFor(parseRobots(txt).groups, "DuckDuckBot")!.agents, ["*"]);
  // Everyone allowed but Googlebot specifically kept out: that IS a launch problem.
  const g = robotsVerdict("User-agent: *\nAllow: /\n\nUser-agent: Googlebot\nDisallow: /\n");
  assert.equal(g.blocked, true);
  assert.deepEqual(g.blockedAgents, ["googlebot"]);
});
