/**
 * Public benchmark leaderboard — turn the calibration gate into a credibility weapon: a
 * shared, reproducible corpus (our planted-vuln fixtures) with a head-to-head recall/
 * precision table. No DAST vendor publishes head-to-head recall on a shared corpus.
 *
 * Truth Protocol in the leaderboard too: only MEASURED rows carry numbers. A competitor row
 * with no local measurement shows "—" and a "run it to populate" note — we never fabricate a
 * competitor's score. Pure + deterministic so it's unit-tested.
 */

export type LeaderboardEntry = {
  tool: string;
  measured: boolean;
  recall?: number; // 0..1
  precision?: number; // 0..1
  f1?: number; // 0..1
  note?: string;
};

function pct(n: number | undefined): string {
  return n === undefined ? "—" : `${Math.round(n * 100)}%`;
}
function f1str(n: number | undefined): string {
  return n === undefined ? "—" : n.toFixed(3);
}

/** Rank measured entries by F1 (desc); unmeasured rows sort last, order preserved. */
export function rankLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const measured = entries.filter((e) => e.measured).sort((a, b) => (b.f1 ?? 0) - (a.f1 ?? 0));
  const unmeasured = entries.filter((e) => !e.measured);
  return [...measured, ...unmeasured];
}

/** Render a markdown leaderboard table. Unmeasured competitors show "—", never a fake score. */
export function renderLeaderboard(entries: LeaderboardEntry[]): string {
  const ranked = rankLeaderboard(entries);
  const rows = ranked.map((e, i) => {
    const rank = e.measured ? String(i + 1) : "—";
    const note = e.note ? ` <sub>${e.note}</sub>` : "";
    // Truth Protocol: an unmeasured row NEVER shows a number, even if fields were set.
    const [r, p, f] = e.measured ? [pct(e.recall), pct(e.precision), f1str(e.f1)] : ["—", "—", "—"];
    return `| ${rank} | ${e.tool}${note} | ${r} | ${p} | ${f} |`;
  });
  return ["| # | Tool | Recall | Precision | F1 |", "|---|------|--------|-----------|-----|", ...rows].join("\n");
}
