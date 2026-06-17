import type { RepoScan } from "../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../runner/crawler.ts";
import { Counter, type AuditHints, type GeneratedCard } from "./generators/types.ts";
import { generateFrontend } from "./generators/frontend.ts";
import { generateBackend } from "./generators/backend.ts";
import { generateAdminRbac } from "./generators/admin-rbac.ts";
import { generateMiddleware } from "./generators/middleware.ts";
import { generateSecurity } from "./generators/security.ts";
import { generateWriteAuthz } from "./generators/write-authz.ts";
import { generateElevenLabs } from "./generators/elevenlabs.ts";
import { generateSeo } from "./generators/seo.ts";
import { generateContentIntegrity } from "./generators/content-integrity.ts";
import { generateAccessibility } from "./generators/accessibility.ts";
import { generatePerformance } from "./generators/performance.ts";
import { generateObjectAuthz } from "./generators/object-authz.ts";
import { generateMutationAuthz } from "./generators/mutation-authz.ts";
import { generateCors } from "./generators/cors.ts";
import { generateCookieSecurity } from "./generators/cookie-security.ts";
import { generateMassAssignment } from "./generators/mass-assignment.ts";
import { generateTlsHsts } from "./generators/tls-hsts.ts";
import { generateInjection } from "./generators/injection.ts";

export type { GeneratedCard, AuditHints } from "./generators/types.ts";

/**
 * Turn the repo scan's discovered routes into audit hints so `--repo` ALONE
 * fires admin/RBAC + backend checks — no hand-authored hints file required.
 * This is what makes the engine's repo-awareness real instead of a claim.
 */
function deriveHintsFromScan(scan: RepoScan | null, hints: AuditHints): AuditHints {
  const routes = scan?.detail?.routes;
  if (!routes || routes.length === 0) return hints;

  const merged: AuditHints = {
    ...hints,
    protectedRoutes: [...(hints.protectedRoutes ?? [])],
    protectedApis: [...(hints.protectedApis ?? [])],
    postEndpoints: [...(hints.postEndpoints ?? [])],
  };
  const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  const apiSeen = new Set(merged.protectedApis!.map((a) => `${a.method ?? "POST"} ${a.path}`));
  const postSeen = new Set(merged.postEndpoints!.map((e) => e.path));

  for (const r of routes) {
    if (r.kind === "page" && r.privileged && !merged.protectedRoutes!.includes(r.url_path)) {
      merged.protectedRoutes!.push(r.url_path);
    }
    if (r.kind === "api") {
      const methods = r.methods.length ? r.methods : ["POST"];
      // Privileged APIs: every method must reject anonymous callers (server-side guard).
      if (r.privileged) {
        for (const method of methods) {
          const key = `${method} ${r.url_path}`;
          if (!apiSeen.has(key)) { merged.protectedApis!.push({ path: r.url_path, method }); apiSeen.add(key); }
        }
      }
      // Any mutating endpoint: malformed input must 4xx (not 5xx) and not leak a stack trace.
      if (methods.some((m) => MUTATING.has(m)) && !postSeen.has(r.url_path)) {
        merged.postEndpoints!.push({ path: r.url_path });
        postSeen.add(r.url_path);
      }
    }
  }
  return merged;
}

/** Compose the deep taxonomy: front end, back end, admin/RBAC, middleware, write-authz, ElevenLabs. */
export function generateTestCards(scan: RepoScan | null, crawl: RuntimeCrawl, hints: AuditHints = {}): GeneratedCard[] {
  hints = deriveHintsFromScan(scan, hints);
  const c = new Counter();
  const cards: GeneratedCard[] = [
    ...generateFrontend(scan, crawl, hints, c),
    ...generateBackend(scan, crawl, hints, c),
    ...generateAdminRbac(scan, crawl, hints, c),
    ...generateMiddleware(scan, crawl, hints, c),
    ...generateSecurity(scan, crawl, hints, c),
    ...generateWriteAuthz(scan, crawl, hints, c),
    ...generateElevenLabs(scan, crawl, hints, c),
    ...generateSeo(scan, crawl, hints, c),
    ...generateContentIntegrity(scan, crawl, hints, c),
    ...generateAccessibility(scan, crawl, hints, c),
    ...generatePerformance(scan, crawl, hints, c),
    ...generateObjectAuthz(scan, crawl, hints, c),
    ...generateMutationAuthz(scan, crawl, hints, c),
    ...generateCors(scan, crawl, hints, c),
    ...generateCookieSecurity(scan, crawl, hints, c),
    ...generateMassAssignment(scan, crawl, hints, c),
    ...generateTlsHsts(scan, crawl, hints, c),
    ...generateInjection(scan, crawl, hints, c),
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
