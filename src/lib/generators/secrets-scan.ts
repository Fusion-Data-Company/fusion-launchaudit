import fs from "node:fs";
import path from "node:path";
import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * Repo secrets scanner — catalog domain 02 / the second table-stakes security check
 * (with SCA) every dev now expects, and the one Aikido/GitGuardian lead with. Walks the
 * tracked TEXT files under the repo and runs a curated, high-signal pattern set (the
 * gitleaks/GitGuardian "specific detector" family: AWS, GitHub, Stripe, Slack, Google,
 * OpenAI, PEM private keys) plus ONE generic high-entropy rule gated behind a Shannon-
 * entropy check (GitGuardian's two-stage prefix+entropy model) so example/placeholder
 * strings don't become false positives.
 *
 * Honest by design (Truth Protocol):
 *  - A live-FORMAT credential in a tracked file is real and verifiable from the bytes
 *    on disk → classify -> product_bug ("rotate it and purge from git history").
 *  - A generic entropy-only hit is a candidate, NOT a confirmed secret → needs_verification.
 *  - REDACTION: only first4 + "…" + last4 of any match is ever stored or emitted. The raw
 *    secret is never persisted, logged, or carried in a card/exec step.
 *  - Exclusion set is taken verbatim from GitGuardian's PreValidators (skip binaries +
 *    node_modules/.git/vendor/dist/build/.next/out/coverage) so we don't flag bundled deps.
 */

export type SecretHit = { file: string; line: number; rule: string; preview: string; knownFormat: boolean };

// GitGuardian PreValidators: directories that are never the user's own source.
const EXCLUDED_DIRS = new Set(["node_modules", ".git", "vendor", "vendors", "dist", "build", ".next", "out", "coverage"]);
// Skip binaries (GitGuardian discards them before scanning) — extension-based, fast.
const BINARY_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp", ".tif", ".tiff", ".svg",
  ".pdf", ".zip", ".gz", ".tar", ".tgz", ".bz2", ".7z", ".rar", ".jar", ".war",
  ".woff", ".woff2", ".ttf", ".eot", ".otf", ".mp3", ".mp4", ".mov", ".avi", ".webm",
  ".wav", ".flac", ".ogg", ".bin", ".exe", ".dll", ".so", ".dylib", ".class", ".wasm",
  ".node", ".lockb", ".heic", ".psd", ".sketch", ".db", ".sqlite", ".pyc", ".o", ".a",
]);

// Safety caps so a huge repo can't blow up the scan (GitGuardian also bounds file/byte size).
const MAX_FILES = 5000;
const MAX_FILE_BYTES = 1_000_000; // 1 MB — bigger text files are almost always generated/data.
const MAX_HITS = 200;

/** A specific (known-format) detector: a regex whose match group IS the credential. */
type KnownRule = { rule: string; re: RegExp };

// Curated gitleaks-style "specific" detectors. Each is high-precision (a real prefix +
// fixed shape), so a match is treated as a live-format credential.
const KNOWN_RULES: KnownRule[] = [
  // AWS access key id.
  { rule: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  // GitHub personal access token (classic) and fine-grained PAT.
  { rule: "github-pat", re: /\bghp_[0-9A-Za-z]{36}\b/ },
  { rule: "github-fine-grained-pat", re: /\bgithub_pat_[0-9A-Za-z_]{82}\b/ },
  // Stripe live secret key. Checked BEFORE the OpenAI rule so `sk_live_…` never falls to OpenAI.
  { rule: "stripe-secret-key", re: /\bsk_live_[0-9A-Za-z]{24,}\b/ },
  // Slack token (bot/app/user/refresh/etc.).
  { rule: "slack-token", re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  // Google API key.
  { rule: "google-api-key", re: /\bAIza[0-9A-Za-z_\-]{35}\b/ },
  // OpenAI API key. NOTE: must NOT also match Stripe's `sk_live_` — the negative
  // lookahead drops the underscore-led Stripe shape so it stays a single classification.
  { rule: "openai-api-key", re: /\bsk-(?!live_)[A-Za-z0-9]{20,}\b/ },
  // PEM private key block (RSA/EC/DSA/OPENSSH/generic).
  { rule: "private-key-pem", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

// ONE generic detector (the long tail) — gated behind Shannon entropy so low-entropy
// example strings ("password: changeme123456") don't trip it. Capture group 2 = the value.
const GENERIC_RE = /(secret|token|api[_-]?key|password)\s*[:=]\s*['"]([^'"]{16,})['"]/gi;
const ENTROPY_FLOOR = 3.5; // bits/char — GitGuardian's generic detector uses ~3.5–4.5.

/** Shannon entropy in bits per character. Exported-shape pure helper used by the generic gate. */
export function shannonEntropy(value: string): number {
  if (!value) return 0;
  const counts = new Map<string, number>();
  for (const ch of value) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let bits = 0;
  for (const n of counts.values()) {
    const p = n / value.length;
    bits -= p * Math.log2(p);
  }
  return bits;
}

/** Redact a secret to first4 + "…" + last4 (never store/emit the raw value). */
function redact(secret: string): string {
  if (secret.length <= 8) return `${secret.slice(0, 2)}…`;
  return `${secret.slice(0, 4)}…${secret.slice(-4)}`;
}

/**
 * Pure (exported for unit tests): scan one file's text for secrets. Returns REDACTED
 * hits only — the raw secret never leaves this function. `filename` is recorded on each hit.
 */
export function scanTextForSecrets(text: string, filename: string): SecretHit[] {
  const hits: SecretHit[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > 5000) continue; // skip minified/data lines (a single huge token line)
    // Specific detectors first (one match per rule per line is enough to flag the file).
    for (const { rule, re } of KNOWN_RULES) {
      const m = re.exec(line);
      if (m) {
        hits.push({ file: filename, line: i + 1, rule, preview: redact(m[0]), knownFormat: true });
        if (hits.length >= MAX_HITS) return hits;
      }
    }
    // Generic detector (entropy-gated). Reset lastIndex each line (global regex reused).
    GENERIC_RE.lastIndex = 0;
    let g: RegExpExecArray | null;
    while ((g = GENERIC_RE.exec(line)) !== null) {
      const value = g[2];
      if (shannonEntropy(value) >= ENTROPY_FLOOR) {
        hits.push({ file: filename, line: i + 1, rule: "generic-high-entropy", preview: redact(value), knownFormat: false });
        if (hits.length >= MAX_HITS) return hits;
      }
    }
  }
  return hits;
}

/** Recursively collect candidate text files under `root`, applying the exclusion set + caps. */
function collectTextFiles(root: string): string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length && out.length < MAX_FILES) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (out.length >= MAX_FILES) break;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (EXCLUDED_DIRS.has(e.name)) continue;
        stack.push(full);
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (BINARY_EXTS.has(ext)) continue;
        out.push(full);
      }
    }
  }
  return out;
}

function blockedCard(c: Counter, why: string): GeneratedCard {
  return {
    id: c.next("TC-SECRET"),
    title: "Repo secrets scan — needs a repo to read",
    category: "secret_exposure",
    status: "blocked",
    risk: "low",
    goal: "Scan tracked source files for leaked credentials (the secrets check Aikido/GitGuardian lead with).",
    steps: ["Provide --repo pointing at the project source tree"],
    expectedEvidence: ["secret_scan_report"],
    dataNeeds: ["a local checkout of the repository (--repo)"],
    acceptanceCriteria: `BLOCKED: ${why}.`,
    exec: [],
  };
}

export function generateSecretsScan(scan: RepoScan | null, _crawl: RuntimeCrawl, _hints: AuditHints, c: Counter): GeneratedCard[] {
  const repoPath = scan?.detail?.repo_path;
  if (!repoPath) return [blockedCard(c, "no --repo was provided, so there are no tracked files to scan")];

  const hits: SecretHit[] = [];

  // 1) Walk text files and run the pattern set.
  const files = collectTextFiles(repoPath);
  for (const full of files) {
    if (hits.length >= MAX_HITS) break;
    let stat: fs.Stats;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (stat.size > MAX_FILE_BYTES) continue;
    let text: string;
    try {
      text = fs.readFileSync(full, "utf8");
    } catch {
      continue;
    }
    const rel = path.relative(repoPath, full) || path.basename(full);
    for (const hit of scanTextForSecrets(text, rel)) {
      hits.push(hit);
      if (hits.length >= MAX_HITS) break;
    }
  }

  // 2) A committed `.env` file is itself a leak surface (secrets belong in a gitignored env).
  const envPath = path.join(repoPath, ".env");
  let envCommitted = false;
  try {
    if (fs.statSync(envPath).isFile()) envCommitted = true;
  } catch {
    /* no .env at root — fine */
  }
  if (envCommitted && hits.length < MAX_HITS && !hits.some((h) => h.file === ".env")) {
    hits.push({ file: ".env", line: 1, rule: "committed-dotenv", preview: ".env…file", knownFormat: true });
  }

  // 3) A missing `.gitignore` entry covering `.env` means env secrets aren't ignored.
  let gitignore = "";
  try {
    gitignore = fs.readFileSync(path.join(repoPath, ".gitignore"), "utf8");
  } catch {
    /* treated as "no ignore rule" below */
  }
  const ignoresEnv = /^\s*\.?\/?(?:\*\*\/)?\.env(?:\*|\.\*)?\s*$/m.test(gitignore) || /(^|\s)\.env\*?(\s|$)/m.test(gitignore);
  if (!ignoresEnv && hits.length < MAX_HITS && !hits.some((h) => h.rule === "gitignore-missing-env")) {
    hits.push({ file: ".gitignore", line: 0, rule: "gitignore-missing-env", preview: "(no .env rule)", knownFormat: false });
  }

  return [
    {
      id: c.next("TC-SECRET"),
      title: "No exposed secrets in tracked files",
      category: "secret_exposure",
      status: "ready",
      risk: "high",
      goal: "A credential committed to tracked source ships straight to anyone with repo access and lives forever in git history — this is the table-stakes secrets check Aikido/GitGuardian lead with.",
      steps: [
        `Scan ${files.length} tracked text file${files.length === 1 ? "" : "s"} under the repo`,
        "Run the curated specific detectors (AWS/GitHub/Stripe/Slack/Google/OpenAI/PEM) + an entropy-gated generic rule",
        "Expect no live-format credential and no committed .env",
      ],
      expectedEvidence: ["secret_scan_report"],
      dataNeeds: [],
      acceptanceCriteria:
        "No tracked file contains a known-format credential and no committed .env is present. Patterns: gitleaks-style specific detectors + a Shannon-entropy-gated generic rule (GitGuardian's two-stage model). Secrets are reported REDACTED only.",
      exec: [
        {
          action: "secret_scan",
          hits,
        },
      ],
    },
  ];
}
