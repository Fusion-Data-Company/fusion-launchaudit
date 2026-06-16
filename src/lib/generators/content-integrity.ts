import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * Content-integrity / fake-data generator — checks the rendered home page for the
 * placeholder and unbound-data defects that say "this isn't finished" louder than
 * any bug: lorem filler, `undefined`/`NaN` leaking to the screen, hardcoded
 * localhost URLs on a deployed site, and obvious placeholder markers.
 *
 * This is the class LaunchAudit itself once shipped (seeded demo data unlabeled),
 * so owning it is both a differentiator and a matter of self-respect.
 */
function isLocalTarget(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?/i.test(url);
}

export function generateContentIntegrity(_scan: RepoScan | null, crawl: RuntimeCrawl, _hints: AuditHints, c: Counter): GeneratedCard[] {
  const content = (assert: Record<string, unknown>) => ({ action: "content", path: "/", assert });
  const card = (title: string, risk: string, goal: string, criteria: string, assert: Record<string, unknown>): GeneratedCard => ({
    id: c.next("TC-CI"), title, category: "content_integrity", status: "ready", risk,
    goal, steps: ["GET the home page", "Scan the rendered content"], expectedEvidence: ["html"], dataNeeds: [],
    acceptanceCriteria: criteria, exec: [content(assert)],
  });

  const cards: GeneratedCard[] = [
    card("No lorem/placeholder copy on the page", "medium",
      "Lorem ipsum filler means real copy was never written — an instant 'unfinished' tell to any visitor.",
      "Rendered home page contains no 'lorem ipsum' text.",
      { kind: "no_lorem" }),
    card("No unbound undefined/NaN values rendered", "high",
      "A literal 'undefined' or 'NaN' on the page is a data field that failed to populate — broken wiring leaking to the UI.",
      "Rendered home page shows no standalone undefined/NaN values.",
      { kind: "no_unbound_values" }),
    card("No obvious placeholder markers", "low",
      "Markers like 'your company name' or 'email@example.com' suggest stub content left in place.",
      "Rendered home page contains no known placeholder markers (verify any hit is intentional).",
      { kind: "no_placeholder_markers" }),
  ];

  // A deployed page that hardcodes localhost is a real launch defect; on a local
  // dev target the same string is expected, so only run this off-localhost.
  if (crawl.app_url && !isLocalTarget(crawl.app_url)) {
    cards.push(card("No hardcoded localhost references", "medium",
      "A deployed page referencing http://localhost will break for every real visitor — a copied-from-dev URL.",
      "Rendered home page has no http://localhost or 127.0.0.1 references.",
      { kind: "no_localhost_refs" }));
  }

  return cards;
}
