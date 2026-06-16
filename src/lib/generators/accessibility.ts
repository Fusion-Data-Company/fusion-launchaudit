import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * Accessibility generator — runs axe-core (WCAG 2.0/2.1 A + AA) against the
 * rendered home page. Reports serious/critical violations only; minor/moderate
 * are left out to keep signal high. This is a category most functional-QA tools
 * skip and FDC build doctrine expects (alt text, labels, contrast, ARIA).
 */
export function generateAccessibility(_scan: RepoScan | null, _crawl: RuntimeCrawl, _hints: AuditHints, c: Counter): GeneratedCard[] {
  return [
    {
      id: c.next("TC-A11Y"),
      title: "Home page has no serious/critical accessibility violations",
      category: "accessibility",
      status: "ready",
      risk: "medium",
      goal: "Serious or critical WCAG violations (missing labels, low contrast, broken ARIA, no alt text) lock real users out and carry legal risk.",
      steps: ["Load the home page", "Run axe-core (WCAG 2.0/2.1 A+AA)", "No serious/critical violations"],
      expectedEvidence: ["axe_report"],
      dataNeeds: [],
      acceptanceCriteria: "Home page reports zero axe violations at impact serious or critical.",
      exec: [
        { action: "goto", path: "/" },
        { action: "axe", impactFloor: "serious" },
      ],
    },
  ];
}
