import fs from "node:fs";
import path from "node:path";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * Malicious-package / supply-chain provenance — BEYOND CVE lookup. Our SCA check finds
 * KNOWN advisories; this catches actively-malicious packages that have NO CVE yet — the
 * Shai-Hulud-class attacks that hit npm in repeated waves (Sep 2025, Nov 2025, and the
 * Apr–May 2026 "Third Coming" / "Mini Shai-Hulud" campaigns) plus the May 2026 typosquats
 * that harvest AWS/Vault/CI-CD secrets. Three signals, all read locally (no network):
 *   1. Install-script exfil    — pre/postinstall hooks that curl|wget|base64|node -e to
 *      the network (the Shai-Hulud delivery vector). CONFIRMED bug.
 *   2. Typosquat / confusion   — a direct dep one edit away from a very popular package.
 *      Honest: a strong signal, but a legit name can be close → needs_verification.
 *   3. Registry integrity      — a lockfile `resolved` URL pointing off the official
 *      registry (dependency-confusion / registry hijack). needs_verification.
 * Sources: Unit 42 (Shai-Hulud worm), Microsoft (May 2026 typosquat campaign), npm docs.
 */

export type SupplyHit = { kind: "install-script" | "typosquat" | "registry"; pkg: string; detail: string; severity: "high" | "medium" };

// Suspicious install-lifecycle script content — the exfil fingerprint.
const SCRIPT_RED_FLAGS: Array<{ re: RegExp; why: string }> = [
  { re: /\b(curl|wget)\b[^\n|]*\|\s*(sh|bash|node)/i, why: "pipes a network download straight into a shell" },
  { re: /\bnode\s+-e\b/i, why: "runs inline node -e (common loader for obfuscated payloads)" },
  { re: /base64\s+(-d|--decode)/i, why: "base64-decodes an embedded payload" },
  { re: /\beval\s*\(/i, why: "eval() in an install script" },
  { re: /https?:\/\/[^\s"']*\b(webhook|hook|exfil|collect|steal|pastebin|ngrok)\b/i, why: "posts to a webhook/exfil endpoint" },
  { re: /process\.env\.(NPM_TOKEN|GITHUB_TOKEN|AWS_|VAULT_|CI)/i, why: "reads CI/cloud secrets from the environment" },
  { re: /\bbundle\.js\b/i, why: "fetches a bundle.js loader (Shai-Hulud pattern)" },
];
const INSTALL_HOOKS = ["preinstall", "install", "postinstall", "preuninstall", "prepublish"];

// A small, curated set of very-popular npm packages typosquatters imitate. Sourced from
// npm download rankings; kept short + high-signal so we don't over-flag.
const POPULAR = [
  "react", "react-dom", "next", "express", "lodash", "axios", "chalk", "commander",
  "dotenv", "typescript", "webpack", "vite", "eslint", "prettier", "jest", "vue",
  "cross-env", "node-fetch", "moment", "uuid", "zod", "playwright", "tailwindcss",
];
const KNOWN_SAFE = new Set(POPULAR);

/**
 * Damerau-Levenshtein (optimal string alignment) — counts an adjacent transposition as a
 * single edit, because character swaps ("lodahs"↔"lodash") are the most common typosquat
 * trick and plain Levenshtein scores them as 2. Capped for speed.
 */
export function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1); // adjacent transposition
      }
    }
  }
  return dp[a.length][b.length];
}

/** Flag a direct dep name that is 1 edit from a popular package (but not the package itself). */
export function detectTyposquats(directNames: string[]): SupplyHit[] {
  const hits: SupplyHit[] = [];
  for (const name of directNames) {
    if (KNOWN_SAFE.has(name) || name.startsWith("@")) continue; // exact match / scoped are fine here
    for (const pop of POPULAR) {
      if (name === pop) break;
      if (editDistance(name, pop) === 1) {
        hits.push({ kind: "typosquat", pkg: name, detail: `one character from the popular package "${pop}"`, severity: "medium" });
        break;
      }
    }
  }
  return hits;
}

/** Scan a package.json scripts object for install-lifecycle exfil patterns. */
export function scanScriptsObject(scripts: Record<string, unknown> | undefined, pkgLabel: string): SupplyHit[] {
  const hits: SupplyHit[] = [];
  if (!scripts) return hits;
  for (const hook of INSTALL_HOOKS) {
    const body = scripts[hook];
    if (typeof body !== "string") continue;
    for (const flag of SCRIPT_RED_FLAGS) {
      if (flag.re.test(body)) {
        hits.push({ kind: "install-script", pkg: pkgLabel, detail: `${hook} script ${flag.why}`, severity: "high" });
        break; // one flag per hook is enough to condemn it
      }
    }
  }
  return hits;
}

/** A lockfile `resolved` URL off the official npm registry is a confusion/hijack signal. */
export function checkRegistryIntegrity(lockJson: unknown): SupplyHit[] {
  const hits: SupplyHit[] = [];
  const packages = (lockJson as { packages?: Record<string, { resolved?: string }> })?.packages;
  if (!packages) return hits;
  for (const [p, meta] of Object.entries(packages)) {
    const resolved = meta?.resolved;
    if (!resolved || !/^https?:/i.test(resolved)) continue;
    if (!/registry\.npmjs\.org|registry\.yarnpkg\.com/i.test(resolved)) {
      const name = p.includes("node_modules/") ? p.slice(p.lastIndexOf("node_modules/") + 13) : p;
      hits.push({ kind: "registry", pkg: name || resolved, detail: `resolved from a non-official registry (${new URL(resolved).host})`, severity: "medium" });
      if (hits.length >= 10) break;
    }
  }
  return hits;
}

function readJson(file: string): unknown {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

export function generateSupplyChain(scan: RepoScan | null, _crawl: RuntimeCrawl, _hints: AuditHints, c: Counter): GeneratedCard[] {
  const repoPath = scan?.detail?.repo_path;
  if (!repoPath) return [];
  const pkgPath = path.join(repoPath, "package.json");
  const pkg = readJson(pkgPath) as { scripts?: Record<string, unknown>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | null;
  if (!pkg) return []; // not a node project — nothing to check here

  const hits: SupplyHit[] = [];
  // 1) The project's OWN install scripts.
  hits.push(...scanScriptsObject(pkg.scripts, "(this project)"));
  // 2) Direct dependency names → typosquat.
  const directNames = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
  hits.push(...detectTyposquats(directNames));
  // 3) Installed direct deps' install scripts (bounded — only direct deps, only if present).
  for (const name of directNames.slice(0, 200)) {
    const depPkg = readJson(path.join(repoPath, "node_modules", name, "package.json")) as { scripts?: Record<string, unknown> } | null;
    if (depPkg) hits.push(...scanScriptsObject(depPkg.scripts, name));
    if (hits.length >= 40) break;
  }
  // 4) Lockfile registry integrity.
  const lock = readJson(path.join(repoPath, "package-lock.json"));
  if (lock) hits.push(...checkRegistryIntegrity(lock));

  return [
    {
      id: c.next("TC-SUPPLY"),
      title: "No malicious-package signals (install-script exfil, typosquat, registry hijack)",
      category: "supply_chain",
      status: "ready",
      risk: "high",
      goal: "Catch actively-malicious dependencies that have no CVE yet — the Shai-Hulud-class attacks CVE lookups miss.",
      steps: [
        "Scan this project's + direct deps' pre/postinstall scripts for exfil patterns",
        "Flag direct deps one edit from a popular package (typosquat)",
        "Check the lockfile for packages resolved off the official registry",
      ],
      expectedEvidence: ["supply_chain_report"],
      dataNeeds: [],
      acceptanceCriteria: "No install-lifecycle script exfiltrates to the network, no direct dep typosquats a popular package, no dependency resolves from a non-official registry. Sources: OWASP, Unit 42 (Shai-Hulud), Microsoft (2026 typosquat campaign).",
      exec: [{ action: "supply_chain_scan", hits }],
    },
  ];
}
