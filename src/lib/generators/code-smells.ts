import fs from "node:fs";
import path from "node:path";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * SAST-lite (native, no external tool — on-brand: runs in the agent, no semgrep/
 * docker required). Greps source for the dynamic-code + HTML-injection SINKS that
 * are the usual XSS/RCE entry points. Honest by design: a grep match is a SINK to
 * REVIEW, not a proven exploit (no dataflow/taint) → classify -> needs_verification.
 * Sources: CWE-79 (XSS), CWE-78 (OS command injection), CWE-95 (eval injection),
 * OWASP WSTG-INPV. This complements (does not replace) a real SAST like Semgrep.
 */

const SRC_EXT = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".vue", ".svelte"]);
const SKIP_DIR = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", "out", ".turbo", ".vercel", "__tests__"]);

export type SmellHit = { file: string; line: number; rule: string; cwe: string };

const RULES: Array<{ rule: string; cwe: string; re: RegExp }> = [
  { rule: "eval() on a dynamic value", cwe: "CWE-95", re: /\beval\s*\(\s*[^)'"`\s]/ },
  { rule: "new Function() from a string", cwe: "CWE-95", re: /\bnew\s+Function\s*\(/ },
  { rule: "child_process with an interpolated command", cwe: "CWE-78", re: /\b(exec|execSync|spawn|spawnSync)\s*\(\s*`[^`]*\$\{/ },
  { rule: "dangerouslySetInnerHTML", cwe: "CWE-79", re: /dangerouslySetInnerHTML/ },
  { rule: "direct innerHTML assignment", cwe: "CWE-79", re: /\.innerHTML\s*=\s*[^'"`\s]/ },
];

/** Bounded source walk (skips node_modules/build dirs). Returns sink hits with file:line. */
export function scanCodeSmells(repoPath: string): SmellHit[] {
  const hits: SmellHit[] = [];
  const FILE_CAP = 4000, HIT_CAP = 200;
  let filesRead = 0;
  const stack = [repoPath];
  while (stack.length && filesRead < FILE_CAP && hits.length < HIT_CAP) {
    const dir = stack.pop()!;
    let entries: import("node:fs").Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (hits.length >= HIT_CAP || filesRead >= FILE_CAP) break;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) stack.push(full); continue; }
      if (!SRC_EXT.has(path.extname(e.name))) continue;
      let content: string;
      try { content = fs.readFileSync(full, "utf8"); } catch { continue; }
      filesRead += 1;
      const lines = content.split("\n");
      for (let i = 0; i < lines.length && hits.length < HIT_CAP; i++) {
        for (const { rule, cwe, re } of RULES) {
          if (re.test(lines[i])) { hits.push({ file: path.relative(repoPath, full), line: i + 1, rule, cwe }); break; }
        }
      }
    }
  }
  return hits;
}

export function generateCodeSmells(scan: RepoScan | null, _crawl: RuntimeCrawl, _hints: AuditHints, c: Counter): GeneratedCard[] {
  const repoPath = scan?.detail?.repo_path;
  if (!repoPath) return []; // runtime-only audit (no --repo) — nothing to scan
  const hits = scanCodeSmells(repoPath);
  return [{
    id: c.next("TC-SMELL"),
    title: "No unreviewed dynamic-code or HTML-injection sinks",
    category: "code_smell",
    status: "ready",
    risk: "medium",
    goal: "eval, new Function, interpolated child_process, and innerHTML/dangerouslySetInnerHTML are the usual XSS/RCE entry points — each should be confirmed to receive only trusted input.",
    steps: ["Scan source for dynamic-code + HTML-injection sinks", "Review each for untrusted input"],
    expectedEvidence: ["smell_report"],
    dataNeeds: [],
    acceptanceCriteria: "Every eval / new Function / interpolated-exec / innerHTML sink is confirmed to receive only trusted, sanitized input. Sources: CWE-79/78/95, OWASP WSTG-INPV.",
    exec: [{ action: "code_smell_scan", hits }],
  }];
}
