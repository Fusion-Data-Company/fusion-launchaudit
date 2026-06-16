/**
 * Accessibility auditing via axe-core — a real WCAG engine, not a handful of
 * regexes. Injected into the live page and run against the rendered DOM, so it
 * catches the issues that only exist after hydration (focus order, contrast,
 * ARIA, labels). Default floor is "serious": we report serious/critical
 * violations as real defects and leave minor/moderate as noise to avoid crying
 * wolf — accuracy over volume.
 */
import type { Page } from "playwright";
import axe from "axe-core";

export type AxeViolation = { id: string; impact?: string | null; help?: string; nodes?: unknown[] };

const IMPACT_ORDER: Record<string, number> = { minor: 1, moderate: 2, serious: 3, critical: 4 };

/** Pure: throw a plain-English reason if any violation is at or above the floor. */
export function summarizeAxeViolations(violations: AxeViolation[], impactFloor: string = "serious"): void {
  const floor = IMPACT_ORDER[impactFloor] ?? 3;
  const bad = violations.filter((v) => (IMPACT_ORDER[v.impact ?? ""] ?? 0) >= floor);
  if (bad.length === 0) return;
  const totalNodes = bad.reduce((n, v) => n + (v.nodes?.length ?? 0), 0);
  const top = bad
    .slice(0, 3)
    .map((v) => `${v.id} (${v.impact}, ${v.nodes?.length ?? 0} element(s)): ${v.help ?? ""}`.trim());
  throw new Error(
    `${bad.length} accessibility violation type(s) at or above "${impactFloor}" across ${totalNodes} element(s): ${top.join("; ")}`,
  );
}

/** Inject axe into the current page, run the WCAG 2.0/2.1 A+AA rules, and assert. */
export async function runAxeOnPage(page: Page, impactFloor: string = "serious"): Promise<void> {
  await page.evaluate(axe.source);
  const results = (await page.evaluate(async () => {
    // @ts-expect-error axe is injected into the page context above.
    return await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] });
  })) as { violations: AxeViolation[] };
  summarizeAxeViolations(results.violations, impactFloor);
}
