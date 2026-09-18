/**
 * robots.txt, read the way crawlers read it (RFC 9309), so the "site blocked"
 * launch check cannot fire on a file that says Allow: / and then closes a few
 * application paths.
 *
 *  - Records are groups: one or more User-agent lines followed by Allow /
 *    Disallow lines. A blank line does not end a group; the next User-agent
 *    line after a rule does.
 *  - Comments (#) and a UTF-8 BOM are stripped; field names are case-insensitive;
 *    CRLF is fine; unknown fields (Sitemap, Crawl-delay) are ignored for matching.
 *  - A crawler obeys the most specific group that names it (longest matching
 *    token, case-insensitive) and otherwise the "*" group. Equally specific
 *    matching groups are combined; named groups never inherit wildcard rules.
 *  - "Disallow:" with an empty value means allow everything.
 *  - Root is blocked only when a Disallow rule matches "/" and no Allow rule of
 *    equal or greater length also matches it. On a tie (Allow: / vs Disallow: /)
 *    the least restrictive rule wins, which is what Google and Bing do.
 */

export type RobotsGroup = { agents: string[]; allow: string[]; disallow: string[]; sitemaps?: string[] };

export function parseRobots(text: string): { groups: RobotsGroup[]; sitemaps: string[] } {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const rawLine of text.replace(/^﻿/, "").split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const field = line.slice(0, i).trim().toLowerCase();
    const value = line.slice(i + 1).trim();
    if (field === "user-agent") {
      if (!current || !lastWasAgent) { current = { agents: [], allow: [], disallow: [] }; groups.push(current); }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    if (field === "sitemap") { sitemaps.push(value); continue; }
    // Other records must not split consecutive User-agent declarations (RFC 9309 2.2.4).
    if (field !== "disallow" && field !== "allow") continue;
    if (!current) continue; // rules before any User-agent line belong to nobody
    lastWasAgent = false;
    if (field === "disallow") current.disallow.push(value);
    else if (field === "allow") current.allow.push(value);
  }
  return { groups, sitemaps };
}

/** Combine equally most-specific matches; fall back to all wildcard groups. */
export function groupFor(groups: RobotsGroup[], agent: string): RobotsGroup | null {
  const name = agent.toLowerCase();
  let matching: RobotsGroup[] = [];
  let bestLen = -1;
  for (const g of groups) {
    const length = Math.max(-1, ...g.agents
      .filter((token) => token !== "*" && token.length > 0 && name.startsWith(token))
      .map((token) => token.length));
    if (length > bestLen) { matching = [g]; bestLen = length; }
    else if (length >= 0 && length === bestLen) matching.push(g);
  }
  if (!matching.length) matching = groups.filter((g) => g.agents.includes("*"));
  if (!matching.length) return null;
  if (matching.length === 1) return matching[0];
  // Build a fresh group so repeated inspections cannot mutate the parsed file.
  return {
    agents: [...new Set(matching.flatMap((g) => g.agents))],
    allow: [...new Set(matching.flatMap((g) => g.allow))],
    disallow: [...new Set(matching.flatMap((g) => g.disallow))],
  };
}

/** Does a single Allow/Disallow pattern match the site root "/"? Only "/" and "/*" (optionally "$"-anchored "/*$") do. */
function matchesRoot(pattern: string): boolean {
  const p = pattern.trim();
  return p === "/" || p === "/*" || p === "/*$";
}

/** True when this group forbids the site root for its crawlers. */
export function groupBlocksRoot(group: RobotsGroup): boolean {
  const dis = group.disallow.filter((p) => p !== "" && matchesRoot(p));
  if (!dis.length) return false;
  const disLen = Math.max(...dis.map((p) => p.trim().length));
  const allowLen = Math.max(-1, ...group.allow.filter(matchesRoot).map((p) => p.trim().length));
  // Longest rule wins; on a tie the Allow (least restrictive) wins.
  return allowLen < disLen;
}

/** The crawlers whose opinion decides "is this site findable": the default group plus the two search engines that matter for launch. */
export const LAUNCH_AGENTS = ["*", "googlebot", "bingbot"] as const;

export type RobotsVerdict = {
  /** true when the default group, Googlebot or Bingbot is kept out of "/". */
  blocked: boolean;
  /** which of LAUNCH_AGENTS are blocked. */
  blockedAgents: string[];
  /** named non-search groups that are blocked from "/" (AI training crawlers etc.); informational, never a launch blocker. */
  otherBlockedAgents: string[];
  sitemaps: string[];
};

export function robotsVerdict(text: string): RobotsVerdict {
  const { groups, sitemaps } = parseRobots(text);
  const blockedAgents: string[] = [];
  for (const agent of LAUNCH_AGENTS) {
    const g = groupFor(groups, agent);
    if (g && groupBlocksRoot(g)) blockedAgents.push(agent);
  }
  const otherBlockedAgents: string[] = [];
  const otherAgents = new Set(groups.flatMap((g) => g.agents).filter((a) => a !== "*"));
  for (const agent of otherAgents) {
    const g = groupFor(groups, agent);
    if (g && groupBlocksRoot(g)) otherBlockedAgents.push(agent);
  }
  return { blocked: blockedAgents.length > 0, blockedAgents, otherBlockedAgents, sitemaps };
}
