import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * The differentiator TestSprite is shallow on: privileged-surface access control.
 * For every admin route/API we check it is blocked for anonymous AND for a
 * normal authenticated user, and (positive control) reachable for an admin.
 */
export function generateAdminRbac(scan: RepoScan | null, crawl: RuntimeCrawl, hints: AuditHints, c: Counter): GeneratedCard[] {
  const cards: GeneratedCard[] = [];
  const userCookie = hints.roles?.user?.cookie;
  const adminCookie = hints.roles?.admin?.cookie;

  for (const route of hints.protectedRoutes ?? []) {
    cards.push({
      id: c.next("TC-ADM"), title: `Admin route blocks anonymous access: ${route}`, category: "roles_permissions", status: "ready", risk: "critical",
      goal: "An unauthenticated visitor cannot reach an admin page by typing its URL.",
      steps: [`GET ${route} with no session`, "Confirm redirect to login or 401/403"],
      expectedEvidence: ["network_log"], dataNeeds: [],
      acceptanceCriteria: `Anonymous GET ${route} is blocked (redirect/401/403), never 200.`,
      exec: [{ action: "http", path: route, expectBlocked: true }],
    });

    if (userCookie) {
      cards.push({
        id: c.next("TC-ADM"), title: `Admin route blocks normal users: ${route}`, category: "roles_permissions", status: "ready", risk: "critical",
        goal: "A logged-in non-admin user cannot reach an admin page by direct URL.",
        steps: [`GET ${route} as a normal user`, "Confirm blocked"],
        expectedEvidence: ["network_log"], dataNeeds: ["normal-user session (captured locally)"],
        acceptanceCriteria: `GET ${route} with a normal-user session is blocked, never 200.`,
        exec: [{ action: "http", path: route, cookie: userCookie, expectBlocked: true }],
      });
    }

    if (adminCookie) {
      cards.push({
        id: c.next("TC-ADM"), title: `Admin route reachable for admins: ${route}`, category: "roles_permissions", status: "ready", risk: "medium",
        goal: "Positive control — an admin session CAN reach the admin page (so guards aren't just blocking everyone).",
        steps: [`GET ${route} as admin`, "Confirm 200"],
        expectedEvidence: ["network_log"], dataNeeds: ["admin session (captured locally)"],
        acceptanceCriteria: `GET ${route} with an admin session returns 200.`,
        exec: [{ action: "http", path: route, cookie: adminCookie, expectStatusOneOf: [200] }],
      });
    }
  }

  for (const api of hints.protectedApis ?? []) {
    const apiMethod = (api.method ?? "POST").toUpperCase();
    // OPTIONS/HEAD are CORS-preflight / metadata verbs, never privileged actions —
    // a 200 to them is a normal preflight, not an exposure. Don't authz-test them.
    if (apiMethod === "OPTIONS" || apiMethod === "HEAD") continue;
    cards.push({
      id: c.next("TC-ADM"), title: `Admin API rejects unauthenticated calls: ${api.method ?? "POST"} ${api.path}`, category: "roles_permissions", status: "ready", risk: "critical",
      goal: "A privileged API action cannot be called without a session — the guard is server-side, not UI-hidden.",
      steps: [`${api.method ?? "POST"} ${api.path} with no session`, "Confirm blocked"],
      expectedEvidence: ["network_log"], dataNeeds: [],
      acceptanceCriteria: `${api.method ?? "POST"} ${api.path} with no session is blocked (401/403/redirect), never 200.`,
      exec: [{ action: "http", method: api.method ?? "POST", path: api.path, expectBlocked: true }],
    });

    if (userCookie) {
      cards.push({
        id: c.next("TC-ADM"), title: `Admin API rejects normal users: ${api.method ?? "POST"} ${api.path}`, category: "roles_permissions", status: "ready", risk: "critical",
        goal: "A normal user cannot invoke a privileged API even with a valid session.",
        steps: [`${api.method ?? "POST"} ${api.path} as a normal user`, "Confirm blocked"],
        expectedEvidence: ["network_log"], dataNeeds: ["normal-user session"],
        acceptanceCriteria: `${api.method ?? "POST"} ${api.path} as a normal user is blocked, never 200.`,
        exec: [{ action: "http", method: api.method ?? "POST", path: api.path, cookie: userCookie, expectBlocked: true }],
      });
    }
  }

  return cards;
}
