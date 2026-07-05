import fs from "node:fs";
import path from "node:path";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * Dependency CVE scanner (SCA) — catalog domain 02 / the table-stakes check every
 * security competitor (Snyk, Aikido, Semgrep) leads with. Reads the npm lockfile,
 * resolves exact name@version, and (at execution time, no browser) queries the FREE
 * OSV.dev database — the same advisory data Trivy/Grype use — for known advisories.
 *
 * Honest by design: a pinned version matching a published OSV/GHSA advisory is a real,
 * verifiable finding (classify -> product_bug). Reachability is NOT analyzed, so the
 * report flags direct vs. transitive so an unused/dev-only package is lower priority.
 * Only npm lockfiles are parsed today; pnpm/yarn targets are declared blocked, never
 * silently passed.
 */

export type LockDep = { ecosystem: string; name: string; version: string; direct: boolean };

/** Parse an npm package-lock.json (v2/v3 `packages`, or legacy v1 `dependencies`) into exact name@version pairs. */
export function parseNpmLock(lockJson: unknown, directNames: Set<string>): LockDep[] {
  const out = new Map<string, LockDep>();
  const add = (name: string, version: string | undefined) => {
    if (!name || !version) return;
    const key = `${name}@${version}`;
    if (!out.has(key)) out.set(key, { ecosystem: "npm", name, version, direct: directNames.has(name) });
  };
  const lock = lockJson as {
    packages?: Record<string, { version?: string }>;
    dependencies?: Record<string, { version?: string; dependencies?: Record<string, unknown> }>;
  };
  if (lock?.packages && typeof lock.packages === "object") {
    const marker = "node_modules/";
    for (const [p, meta] of Object.entries(lock.packages)) {
      if (!p || !p.includes(marker)) continue; // skip the root "" entry and workspace roots
      const name = p.slice(p.lastIndexOf(marker) + marker.length);
      add(name, meta?.version);
    }
  } else if (lock?.dependencies && typeof lock.dependencies === "object") {
    const walk = (deps: Record<string, { version?: string; dependencies?: Record<string, unknown> }>) => {
      for (const [name, meta] of Object.entries(deps)) {
        add(name, meta?.version);
        if (meta?.dependencies) walk(meta.dependencies as Record<string, { version?: string; dependencies?: Record<string, unknown> }>);
      }
    };
    walk(lock.dependencies);
  }
  return [...out.values()];
}

const SRC_EXT = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".vue", ".svelte"]);
const SKIP_DIR = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", "out", ".turbo", ".vercel"]);

/**
 * Reachability-lite (Snyk/Semgrep's headline, honestly scoped): which DIRECT packages
 * does the app's own source actually import? A vulnerable package that's imported is
 * higher priority than one that's transitive/unused. This is a real import-presence
 * heuristic, NOT a call graph — so we say "imported", never "the vuln is reachable".
 * Bounded walk (no node_modules) so it's cheap on big repos.
 */
export function collectImportedNames(repoPath: string, candidates: Set<string>): Set<string> {
  const found = new Set<string>();
  if (candidates.size === 0) return found;
  const res = new Map<string, RegExp>();
  for (const name of candidates) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    res.set(name, new RegExp(`(?:from\\s*|require\\(\\s*|import\\(\\s*)['"]${esc}(?:['"]|/)`));
  }
  const FILE_CAP = 3000;
  let filesRead = 0;
  const stack = [repoPath];
  while (stack.length && filesRead < FILE_CAP && found.size < candidates.size) {
    const dir = stack.pop()!;
    let entries: import("node:fs").Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (found.size >= candidates.size || filesRead >= FILE_CAP) break;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) stack.push(full); continue; }
      if (!SRC_EXT.has(path.extname(e.name))) continue;
      let content: string;
      try { content = fs.readFileSync(full, "utf8"); } catch { continue; }
      filesRead += 1;
      for (const [name, re] of res) {
        if (!found.has(name) && re.test(content)) found.add(name);
      }
    }
  }
  return found;
}

// SPDX families with copyleft obligations a proprietary web app usually must clear
// with legal before shipping. Source: the SPDX license list + OSI categories.
const COPYLEFT = /\b(AGPL|GPL-|GPLv|LGPL|SSPL|CC-BY-SA|EUPL|OSL|MPL-2)/i;

export type LicenseHit = { name: string; license: string; kind: "copyleft" | "unknown" };

/** Read each direct dep's declared license from its INSTALLED package.json (no network). */
export function readDirectLicenses(repoPath: string, directNames: Set<string>): LicenseHit[] {
  const hits: LicenseHit[] = [];
  for (const name of directNames) {
    let pkgRaw: string;
    try { pkgRaw = fs.readFileSync(path.join(repoPath, "node_modules", name, "package.json"), "utf8"); }
    catch { continue; } // not installed → can't read a license; the CVE card covers presence
    let lic = "";
    try {
      const pkg = JSON.parse(pkgRaw) as { license?: unknown; licenses?: Array<{ type?: string }> };
      if (typeof pkg.license === "string") lic = pkg.license;
      else if (pkg.license && typeof pkg.license === "object") lic = String((pkg.license as { type?: string }).type ?? "");
      else if (Array.isArray(pkg.licenses)) lic = pkg.licenses.map((l) => l?.type).filter(Boolean).join(" OR ");
    } catch { /* unreadable manifest */ }
    if (!lic) hits.push({ name, license: "UNKNOWN", kind: "unknown" });
    else if (COPYLEFT.test(lic)) hits.push({ name, license: lic, kind: "copyleft" });
  }
  return hits;
}

function blockedCard(c: Counter, why: string): GeneratedCard {
  return {
    id: c.next("TC-DEPCVE"),
    title: "Dependency CVE scan (OSV) — needs an npm lockfile",
    category: "dependency_cve",
    status: "blocked",
    risk: "low",
    goal: "Check resolved dependency versions against the OSV vulnerability database (the free DB Trivy/Grype use).",
    steps: ["Provide --repo pointing at a project with a package-lock.json"],
    expectedEvidence: ["osv_report"],
    dataNeeds: ["an npm package-lock.json (npm-shrinkwrap.json also accepted)"],
    acceptanceCriteria: `BLOCKED: ${why}.`,
    exec: [],
  };
}

export function generateDependencies(scan: RepoScan | null, _crawl: RuntimeCrawl, _hints: AuditHints, c: Counter): GeneratedCard[] {
  const repoPath = scan?.detail?.repo_path;
  if (!repoPath) return [blockedCard(c, "no --repo was provided, so there is no lockfile to read")];

  let lockRaw: string | null = null;
  let lockName = "";
  for (const f of ["package-lock.json", "npm-shrinkwrap.json"]) {
    try {
      lockRaw = fs.readFileSync(path.join(repoPath, f), "utf8");
      lockName = f;
      break;
    } catch {
      /* try next */
    }
  }
  if (!lockRaw) return [blockedCard(c, "no package-lock.json found (npm projects only for now — pnpm/yarn lock parsing is not yet implemented)")];

  let directNames = new Set<string>();
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoPath, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    directNames = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]);
  } catch {
    /* direct/transitive labelling is best-effort */
  }

  let deps: LockDep[];
  try {
    deps = parseNpmLock(JSON.parse(lockRaw), directNames);
  } catch {
    return [blockedCard(c, `${lockName} could not be parsed as JSON`)];
  }
  if (deps.length === 0) return [blockedCard(c, `${lockName} resolved zero dependencies`)];

  // Cap the query payload defensively; OSV allows large batches but we keep it bounded.
  const capped = deps.slice(0, 2000);
  // Reachability-lite: which direct deps does the app's own source actually import?
  const imported = collectImportedNames(repoPath, directNames);
  const cards: GeneratedCard[] = [
    {
      id: c.next("TC-DEPCVE"),
      title: "Dependencies have no known CVEs (OSV/GHSA)",
      category: "dependency_cve",
      status: "ready",
      risk: "high",
      goal: "A pinned dependency with a known CVE ships the vulnerability straight into production — this is the table-stakes check Snyk, Aikido, and Semgrep all lead with.",
      steps: [`Read ${lockName}`, `Query OSV.dev for ${capped.length} resolved package versions`, "Expect no version that matches a published advisory"],
      expectedEvidence: ["osv_report"],
      dataNeeds: [],
      acceptanceCriteria: "No resolved dependency version matches a known OSV/GHSA advisory. Source: osv.dev (free, no key — the advisory DB Trivy/Grype consume).",
      exec: [
        {
          action: "dep_cve_audit",
          deps: capped.map((d) => ({ ecosystem: d.ecosystem, name: d.name, version: d.version })),
          direct: capped.filter((d) => d.direct).map((d) => d.name),
          imported: [...imported],
        },
      ],
    },
  ];

  // License compliance (Snyk/Semgrep SCA feature) — only when deps are installed,
  // since the license lives in each package's installed manifest. No network.
  let nodeModulesExists = false;
  try { nodeModulesExists = fs.statSync(path.join(repoPath, "node_modules")).isDirectory(); } catch { /* not installed */ }
  if (nodeModulesExists && directNames.size > 0) {
    const flagged = readDirectLicenses(repoPath, directNames);
    cards.push({
      id: c.next("TC-DEPLIC"),
      title: "Dependency licenses are launch-safe (no unreviewed copyleft)",
      category: "dependency_license",
      status: "ready",
      risk: "low",
      goal: "Copyleft (GPL/AGPL/SSPL) or unknown-licensed dependencies can impose source-disclosure or other obligations a proprietary web app must clear with legal before shipping.",
      steps: ["Read each direct dependency's installed license", "Flag copyleft + unknown licenses for review"],
      expectedEvidence: ["license_report"],
      dataNeeds: [],
      acceptanceCriteria: "No direct dependency ships an unreviewed copyleft or unknown license. Source: SPDX license list.",
      exec: [{ action: "license_audit", flagged }],
    });
  }
  return cards;
}
