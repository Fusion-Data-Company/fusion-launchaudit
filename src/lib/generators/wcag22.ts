import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * WCAG 2.2 AA depth — the success criteria axe-core can't fully auto-detect, which is
 * why a passing axe run is NOT a passing page. Three additions:
 *   • Reflow (SC 1.4.10): no 2-D scrolling at 320 CSS px (content reflows to one column).
 *   • Target size (SC 2.5.8): interactive controls are at least 24×24 CSS px.
 *   • Focus order (SC 2.4.3): no positive tabindex overriding the natural order (a smell).
 *
 * Legal driver: the EU Accessibility Act took effect 28 Jun 2025 (penalties up to 4% of
 * global turnover); EN 301 549 tracks WCAG. Reflow + target size are deterministic here
 * (confirmed bugs); focus order is surfaced honestly as a question (needs_verification).
 */
export function generateWcag22(_scan: RepoScan | null, _crawl: RuntimeCrawl, _hints: AuditHints, c: Counter): GeneratedCard[] {
  return [
    {
      id: c.next("TC-W22"), title: "Content reflows at 320px with no horizontal scroll (WCAG 2.2 1.4.10)", category: "wcag22", status: "ready", risk: "medium",
      goal: "At 320 CSS px, a user must not have to scroll in two dimensions — content reflows to a single column.",
      steps: ["Set viewport to 320×800", "Load the home page", "Assert the document has no horizontal overflow"],
      expectedEvidence: ["screenshot"], dataNeeds: [],
      acceptanceCriteria: "At 320px width the page does not overflow horizontally (WCAG 2.2 SC 1.4.10 Reflow).",
      exec: [{ action: "set_viewport", width: 320, height: 800 }, { action: "goto", path: "/" }, { action: "expect_no_horizontal_overflow" }],
    },
    {
      id: c.next("TC-W22"), title: "Interactive targets are at least 24×24px (WCAG 2.2 2.5.8)", category: "wcag22", status: "ready", risk: "medium",
      goal: "Buttons and controls must be large enough to hit reliably — at least 24×24 CSS px.",
      steps: ["Set a mobile viewport", "Load the home page", "Measure buttons/submit-inputs/[role=button]/select — none below 24×24px"],
      expectedEvidence: ["screenshot"], dataNeeds: [],
      acceptanceCriteria: "No interactive control (button, submit input, role=button/menuitem/tab, select) is smaller than 24×24px (WCAG 2.2 SC 2.5.8). Inline text links are exempt.",
      exec: [{ action: "set_viewport", width: 390, height: 844 }, { action: "goto", path: "/" }, { action: "wcag22", check: "target_size" }],
    },
    {
      id: c.next("TC-W22"), title: "No positive tabindex overriding focus order (WCAG 2.2 2.4.3)", category: "focus_order", status: "ready", risk: "low",
      goal: "A positive tabindex forces an unnatural focus order that trips keyboard and screen-reader users.",
      steps: ["Load the home page", "Scan for elements with tabindex > 0"],
      expectedEvidence: ["screenshot"], dataNeeds: [],
      acceptanceCriteria: "No element uses a positive tabindex (a focus-order hazard under WCAG 2.2 SC 2.4.3). Reported for review, not a hard fail.",
      exec: [{ action: "goto", path: "/" }, { action: "wcag22", check: "focus_order" }],
    },
  ];
}
