import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * Served-response info disclosure (no browser — anonymous GET + regex over the
 * delivered body). Distinct from secrets-scan (which reads the *repo*) and from
 * security.ts SECRET_FILES (which probes *file paths*): this catches secrets/PII
 * that leak in the body a real visitor receives.
 *
 * Two honesty tiers (the label carries the tier; classify.ts reads it):
 *  - "served credential" → a live-FORMAT key/token in delivered output → product_bug.
 *  - "info leak" (JWT / internal IP / S3 URL) → could be an intentional public
 *    token or example → needs_verification, never an over-claimed bug.
 * Sources: OWASP WSTG-IDNT/ATHN + CWE-200 (information exposure); key formats from
 * the gitleaks/GitGuardian rule families.
 */

// Ordered credential-FIRST so the most severe match surfaces on a body with several.
const CREDENTIAL_PATTERNS = [
  { label: "an AWS access key id (served credential)", pattern: "AKIA[0-9A-Z]{16}" },
  { label: "a private key block (served credential)", pattern: "-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----" },
  { label: "a Stripe live secret key (served credential)", pattern: "sk_live_[0-9A-Za-z]{16,}" },
  { label: "a Google API key (served credential)", pattern: "AIza[0-9A-Za-z_\\-]{35}" },
  { label: "a Slack token (served credential)", pattern: "xox[baprs]-[0-9A-Za-z\\-]{10,}" },
];
const INFO_PATTERNS = [
  { label: "a JSON Web Token (info leak)", pattern: "eyJ[A-Za-z0-9_\\-]{8,}\\.[A-Za-z0-9_\\-]{8,}\\.[A-Za-z0-9_\\-]{8,}" },
  { label: "an internal RFC1918 IP address (info leak)", pattern: "\\b(?:10\\.|192\\.168\\.|172\\.(?:1[6-9]|2[0-9]|3[01])\\.)[0-9]{1,3}\\.[0-9]{1,3}\\b" },
  { label: "an S3 bucket URL (info leak)", pattern: "[a-z0-9.\\-]+\\.s3\\.amazonaws\\.com" },
];

export function generateInfoDisclosure(_scan: RepoScan | null, _crawl: RuntimeCrawl, hints: AuditHints, c: Counter): GeneratedCard[] {
  const paths = hints.securityPaths ?? ["/"];
  return paths.map((p) => ({
    id: c.next("TC-INFO"),
    title: `No secrets or internal data in the page body: ${p}`,
    category: "info_disclosure",
    status: "ready",
    risk: "high",
    goal: "A served page/endpoint must not leak live credentials, tokens, private keys, or internal infrastructure markers in the body a visitor receives.",
    steps: [`GET ${p}`, "Body carries no AWS/Google/Slack/Stripe key, no private key, no JWT, no internal IP, no S3 URL"],
    expectedEvidence: ["network_log"],
    dataNeeds: [],
    acceptanceCriteria: `${p} body exposes no credential, token, private key, internal IP, or S3 URL.`,
    exec: [{ action: "http", path: p, expectBodyExcludesRegex: [...CREDENTIAL_PATTERNS, ...INFO_PATTERNS] }],
  }));
}
