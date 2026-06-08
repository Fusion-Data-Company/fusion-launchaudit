import type { RepoScan } from "../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../runner/crawler.ts";
import { Counter, type AuditHints, type GeneratedCard } from "./generators/types.ts";
import { generateFrontend } from "./generators/frontend.ts";
import { generateBackend } from "./generators/backend.ts";
import { generateAdminRbac } from "./generators/admin-rbac.ts";
import { generateMiddleware } from "./generators/middleware.ts";

export type { GeneratedCard, AuditHints } from "./generators/types.ts";

/** Compose the deep taxonomy: front end, back end, admin/RBAC, middleware. */
export function generateTestCards(scan: RepoScan | null, crawl: RuntimeCrawl, hints: AuditHints = {}): GeneratedCard[] {
  const c = new Counter();
  const cards: GeneratedCard[] = [
    ...generateFrontend(scan, crawl, hints, c),
    ...generateBackend(scan, crawl, hints, c),
    ...generateAdminRbac(scan, crawl, hints, c),
    ...generateMiddleware(scan, crawl, hints, c),
  ];

  if (crawl.has_password_field && !(hints.roles?.admin || hints.roles?.user)) {
    cards.push({
      id: c.next("TC-ADM"), title: "Authenticated-role coverage", category: "auth", status: "blocked", risk: "critical",
      goal: "Login detected. Full role-based admin checks need test credentials captured locally.",
      steps: ["Provide test creds", "Re-run"], expectedEvidence: ["trace"], dataNeeds: ["test account credentials (kept local)"],
      acceptanceCriteria: "BLOCKED until auth capture — declared, not skipped.", exec: [],
    });
  }
  if (scan && scan.repo_summary.env_keys_missing.length > 0) {
    const missing = scan.repo_summary.env_keys_missing.slice(0, 6);
    cards.push({
      id: c.next("TC-BE"), title: `Integrations blocked by missing env keys (${missing.length})`, category: "integration_side_effects", status: "blocked", risk: "high",
      goal: "Code references env keys absent locally; dependent integrations can't be verified.",
      steps: ["Provide sandbox values", "Re-run"], expectedEvidence: ["env map"], dataNeeds: missing,
      acceptanceCriteria: `BLOCKED: ${missing.join(", ")} unset.`, exec: [],
    });
  }
  return cards;
}
