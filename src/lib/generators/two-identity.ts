import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * Two-identity metamorphic authorization (the wedge, made deeper). Instead of only
 * asking "is anon blocked?" (a single-shot status check), this runs the SAME protected
 * resource as admin → anon → user and asserts the privilege GRADIENT: a lower-privilege
 * identity must be denied or see strictly LESS content than a higher one. The relation
 * needs no "right answer" (no oracle), so it works on any app — the recipe RESTler/SMRL
 * proved catches real IDOR/BOLA. Read-only (GET) — it never mutates the target.
 *
 * Requires a captured admin session (to establish the baseline). No admin creds → BLOCKED,
 * declared honestly, never a faked pass.
 */
export function generateTwoIdentity(scan: RepoScan | null, _crawl: RuntimeCrawl, hints: AuditHints, c: Counter): GeneratedCard[] {
  const adminCookie = hints.roles?.admin?.cookie;
  const userCookie = hints.roles?.user?.cookie;

  const routes = new Set<string>();
  for (const r of hints.protectedRoutes ?? []) routes.add(r);
  for (const r of scan?.detail?.routes ?? []) if (r.kind === "page" && r.privileged) routes.add(r.url_path);
  // Extend the metamorphic gradient to privileged JSON APIs — the surface where BOLA/BFLA
  // actually live. GET-only, so it stays read-only/non-destructive on the API too.
  for (const a of hints.protectedApis ?? []) if (!a.method || a.method === "GET") routes.add(a.path);
  for (const r of scan?.detail?.routes ?? []) if (r.kind === "api" && r.privileged && r.methods.includes("GET")) routes.add(r.url_path);
  if (routes.size === 0) return [];

  if (!adminCookie) {
    return [{
      id: c.next("TC-GRAD"), title: "Privilege-gradient check needs a captured admin session", category: "privilege_gradient", status: "blocked", risk: "critical",
      goal: "Prove a lower-privilege identity can never see as much as an admin on a protected resource (the metamorphic authz relation).",
      steps: ["Provide admin_creds (and ideally user_creds) + login_path in the hints file", "Re-run"],
      expectedEvidence: ["http_transcript"], dataNeeds: ["an admin test account (kept local)"],
      acceptanceCriteria: "BLOCKED: no admin role captured — the two-identity gradient can't be established without a privileged baseline. (WSTG-ATHZ / SMRL)", exec: [],
    }];
  }

  const lower: Array<{ role: string; cookie?: string }> = [{ role: "anonymous" }];
  if (userCookie) lower.push({ role: "user", cookie: userCookie });

  const cards: GeneratedCard[] = [];
  for (const route of [...routes].slice(0, 8)) {
    cards.push({
      id: c.next("TC-GRAD"), title: `Privilege gradient holds: ${route}`, category: "privilege_gradient", status: "ready", risk: "critical",
      goal: "On a protected resource the admin can read, a lower-privilege identity must be denied or see strictly less — never the same content.",
      steps: [`GET ${route} as admin (baseline)`, `GET ${route} as anonymous${userCookie ? " and as a normal user" : ""}`, "Assert each lower identity is denied or sees strictly less than admin"],
      expectedEvidence: ["http_transcript"], dataNeeds: [],
      acceptanceCriteria: `As admin, ${route} returns protected content; anon${userCookie ? "/user" : ""} are denied or receive strictly less. Lower-privilege ⊄ higher-privilege (SMRL metamorphic relation).`,
      exec: [{ action: "two_identity", path: route, adminCookie, lower }],
    });
  }
  return cards;
}
