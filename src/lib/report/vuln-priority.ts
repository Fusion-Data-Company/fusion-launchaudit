/**
 * Exploitability-based prioritization for dependency CVEs — EPSS + CISA KEV.
 *
 * CVSS severity alone is noise: only ~2.3% of CVEs rated 7+ are ever exploited in the
 * wild. Blending EPSS (probability of exploitation in the next 30 days) with the CISA
 * KEV catalog (known-exploited) lets "fix these first" mean something. This is the exact
 * intelligence Snyk/Endor charge for; EPSS (FIRST) and KEV (CISA) are free public feeds.
 *
 * All ranking logic here is pure + deterministic (network fetches live in the executor,
 * degrade gracefully, and never block a finding). Sources:
 *   EPSS  https://www.first.org/epss/   KEV  https://www.cisa.gov/known-exploited-vulnerabilities-catalog
 */

export type VulnEntry = {
  name: string;
  version: string;
  direct: boolean;
  imported: boolean;
  cveIds: string[];
  advisoryCount: number;
};

export type RankedVuln = VulnEntry & { maxEpss: number; kev: boolean; priority: string; tag: string };

const CVE_RE = /CVE-\d{4}-\d{4,}/gi;

/** Pull CVE ids out of OSV vuln objects (id + aliases). GHSA-only advisories yield none. */
export function extractCveIds(vulns: Array<{ id?: string; aliases?: string[] }> | undefined): string[] {
  const out = new Set<string>();
  for (const v of vulns ?? []) {
    for (const s of [v.id ?? "", ...(v.aliases ?? [])]) {
      for (const m of String(s).match(CVE_RE) ?? []) out.add(m.toUpperCase());
    }
  }
  return [...out];
}

/** Parse a FIRST EPSS API response into cve→probability. Tolerant of the documented shape. */
export function parseEpssResponse(json: unknown): Map<string, number> {
  const map = new Map<string, number>();
  const data = (json as { data?: Array<{ cve?: string; epss?: string | number }> })?.data;
  for (const row of data ?? []) {
    if (!row?.cve) continue;
    const p = typeof row.epss === "string" ? parseFloat(row.epss) : typeof row.epss === "number" ? row.epss : NaN;
    if (!Number.isNaN(p)) map.set(row.cve.toUpperCase(), p);
  }
  return map;
}

/** Parse the CISA KEV catalog JSON into a set of known-exploited CVE ids. */
export function parseKevCatalog(json: unknown): Set<string> {
  const set = new Set<string>();
  const vulns = (json as { vulnerabilities?: Array<{ cveID?: string }> })?.vulnerabilities;
  for (const v of vulns ?? []) if (v?.cveID) set.add(v.cveID.toUpperCase());
  return set;
}

// Priority tiers, highest first. KEV outranks everything (it's actively exploited);
// then high EPSS; then imported/direct reachability; then the rest.
function priorityOf(e: { kev: boolean; maxEpss: number; imported: boolean; direct: boolean }): { rank: number; priority: string } {
  if (e.kev) return { rank: 0, priority: "P0 — known exploited (CISA KEV)" };
  if (e.maxEpss >= 0.5) return { rank: 1, priority: "P1 — high exploit probability" };
  if (e.maxEpss >= 0.1) return { rank: 2, priority: "P2 — elevated exploit probability" };
  if (e.imported) return { rank: 3, priority: "P3 — reachable (imported by your code)" };
  if (e.direct) return { rank: 4, priority: "P4 — direct dependency" };
  return { rank: 5, priority: "P5 — transitive / low signal" };
}

/** Rank vulnerable deps by real exploitability. Deterministic; stable within a tier. */
export function rankVulns(entries: VulnEntry[], epss: Map<string, number>, kev: Set<string>): RankedVuln[] {
  const ranked = entries.map((e) => {
    const maxEpss = e.cveIds.reduce((m, c) => Math.max(m, epss.get(c) ?? 0), 0);
    const isKev = e.cveIds.some((c) => kev.has(c));
    const { rank, priority } = priorityOf({ kev: isKev, maxEpss, imported: e.imported, direct: e.direct });
    const tagBits = [isKev ? "KEV" : "", maxEpss > 0 ? `EPSS ${maxEpss.toFixed(2)}` : ""].filter(Boolean);
    return { ...e, maxEpss, kev: isKev, priority, tag: tagBits.length ? `[${tagBits.join(" · ")}]` : "", _rank: rank };
  });
  ranked.sort((a, b) => (a as { _rank: number })._rank - (b as { _rank: number })._rank || b.maxEpss - a.maxEpss || Number(b.direct) - Number(a.direct));
  return ranked.map(({ _rank, ...r }: RankedVuln & { _rank: number }) => r);
}
