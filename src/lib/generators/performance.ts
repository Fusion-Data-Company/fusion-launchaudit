import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * Core Web Vitals generator — a single cold-load smoke check of LCP/CLS/FCP/TTFB.
 * Honest by design: one headless run is not a lab benchmark, so it only flags the
 * "poor" range and the classifier downgrades a miss to needs_verification.
 */
export function generatePerformance(_scan: RepoScan | null, _crawl: RuntimeCrawl, _hints: AuditHints, c: Counter): GeneratedCard[] {
  return [
    {
      id: c.next("TC-PERF"),
      title: "Core Web Vitals are not in the poor range (cold load)",
      category: "performance",
      status: "ready",
      risk: "low",
      goal: "A page with poor LCP/CLS on first load loses real users and search ranking before it can prove its value.",
      steps: ["Load the home page cold", "Measure LCP, CLS, FCP, TTFB", "None in the poor range"],
      expectedEvidence: ["web_vitals"],
      dataNeeds: [],
      acceptanceCriteria: "No Core Web Vital is at or beyond Google's poor threshold on a cold headless load.",
      exec: [
        { action: "goto", path: "/" },
        { action: "web_vitals" },
      ],
    },
  ];
}
