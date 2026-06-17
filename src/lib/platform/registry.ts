import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "../generators/types.ts";
import type { Platform } from "./detect.ts";
import { generateFunnel } from "../generators/funnel.ts";
import { generateApiBackend, generateMarketing, generateBlogCms } from "../generators/platform-checks.ts";

/**
 * Platform routing registry. Every audit runs the shared base check set (security,
 * a11y, perf, SEO, etc. — wired in card-generator). On top of that, the detected
 * platform's specific check set runs from here. Each platform gets its OWN list —
 * we never reuse a generic set across platforms; thin sets get filled from the
 * catalog over time (docs/research/test-catalog/ROLLUP.md).
 */
export type PlatformGenerator = (scan: RepoScan | null, crawl: RuntimeCrawl, hints: AuditHints, c: Counter) => GeneratedCard[];

export const PLATFORM_GENERATORS: Record<Platform, PlatformGenerator[]> = {
  marketing_landing: [generateMarketing],
  web_app_saas: [],
  ecommerce: [],
  mobile_app: [],
  api_backend: [generateApiBackend],
  ai_chatbot_voice: [],
  blog_cms: [generateBlogCms],
  browser_extension: [],
  internal_tool_admin: [],
  sales_funnel: [generateFunnel],
};

/** Run the platform-specific check set for a detected platform (empty until filled). */
export function generatePlatformCards(platform: Platform, scan: RepoScan | null, crawl: RuntimeCrawl, hints: AuditHints, c: Counter): GeneratedCard[] {
  return (PLATFORM_GENERATORS[platform] ?? []).flatMap((gen) => gen(scan, crawl, hints, c));
}
