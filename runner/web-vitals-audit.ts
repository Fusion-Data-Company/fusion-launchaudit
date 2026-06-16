/**
 * Core Web Vitals — a single cold-load measurement in headless Chromium. This is
 * a smoke signal, NOT a lab benchmark: one run, no throttling, no field data. So
 * the thresholds here are the "poor" boundaries (catastrophic, not borderline),
 * and the classifier reports a miss as needs_verification, never a claimed bug.
 * Honest by construction.
 */
import type { Page } from "playwright";

export type WebVitals = { lcp: number; cls: number; fcp: number; ttfb: number };

// Google's "poor" thresholds (ms / unitless). We only flag at or beyond these.
export const POOR = { lcp: 4000, cls: 0.25, fcp: 3000, ttfb: 1800 };

/** Pure: throw a plain-English reason if any metric is at/beyond the poor boundary. */
export function summarizeWebVitals(m: WebVitals): void {
  const bad: string[] = [];
  if (m.lcp >= POOR.lcp) bad.push(`LCP ${(m.lcp / 1000).toFixed(1)}s (poor >= ${POOR.lcp / 1000}s)`);
  if (m.cls >= POOR.cls) bad.push(`CLS ${m.cls.toFixed(2)} (poor >= ${POOR.cls})`);
  if (m.fcp >= POOR.fcp) bad.push(`FCP ${(m.fcp / 1000).toFixed(1)}s (poor >= ${POOR.fcp / 1000}s)`);
  if (m.ttfb >= POOR.ttfb) bad.push(`TTFB ${(m.ttfb / 1000).toFixed(1)}s (poor >= ${POOR.ttfb / 1000}s)`);
  if (bad.length) throw new Error(`Core Web Vitals in the poor range on a cold load: ${bad.join(", ")}`);
}

/** Collect approximate CWV from the already-loaded page, then assert. */
export async function runWebVitalsOnPage(page: Page): Promise<void> {
  const metrics = (await page.evaluate(async () => {
    return await new Promise<WebVitals>((resolve) => {
      let lcp = 0;
      let cls = 0;
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            const t = (e as PerformanceEntry & { renderTime?: number; loadTime?: number }).renderTime
              || (e as PerformanceEntry & { loadTime?: number }).loadTime
              || e.startTime;
            if (t > lcp) lcp = t;
          }
        }).observe({ type: "largest-contentful-paint", buffered: true });
      } catch { /* unsupported */ }
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            const ls = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
            if (!ls.hadRecentInput) cls += ls.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
      } catch { /* unsupported */ }
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const paint = performance.getEntriesByType("paint").find((p) => p.name === "first-contentful-paint");
      setTimeout(() => resolve({
        lcp: Math.round(lcp),
        cls: Number(cls.toFixed(3)),
        fcp: Math.round(paint?.startTime ?? 0),
        ttfb: Math.round(nav?.responseStart ?? 0),
      }), 2500);
    });
  })) as WebVitals;
  summarizeWebVitals(metrics);
}
