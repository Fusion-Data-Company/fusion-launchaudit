import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * SEO + structured-data generator. Checks the home page's INITIAL server HTML
 * (what crawlers and social unfurlers actually read).
 *
 * Two honesty tiers, enforced by category + the classifier:
 *  - Universal page quality (title, mobile viewport) — every page needs these,
 *    so a miss is a real product_bug (medium).
 *  - Public/marketing surface (description, canonical, Open Graph, Schema.org
 *    JSON-LD, noindex) — these matter for a public page but not for an internal
 *    tool, so a miss is needs_verification, never a claimed bug. FDC build
 *    doctrine requires Schema.org on public pages, so it's worth surfacing.
 */
export function generateSeo(_scan: RepoScan | null, _crawl: RuntimeCrawl, _hints: AuditHints, c: Counter): GeneratedCard[] {
  const seo = (assert: Record<string, unknown>) => ({ action: "seo", path: "/", assert });
  const card = (title: string, risk: string, goal: string, criteria: string, assert: Record<string, unknown>): GeneratedCard => ({
    id: c.next("TC-SEO"), title, category: "seo", status: "ready", risk,
    goal, steps: ["GET the home page", "Parse the initial HTML head"], expectedEvidence: ["html"], dataNeeds: [],
    acceptanceCriteria: criteria, exec: [seo(assert)],
  });

  return [
    card("Page has a real <title>", "medium",
      "Every page needs a descriptive, non-default title — it's the search result and the browser tab.",
      "Home page <title> is present, >= 10 chars, and not a framework default.",
      { kind: "title_present", minLen: 10 }),
    card("Mobile viewport is set", "medium",
      "Without a viewport meta the page won't scale on phones.",
      'Home page has <meta name="viewport">.',
      { kind: "viewport_present" }),
    card("Meta description is set", "low",
      "The description is the snippet shown under the title in search results.",
      'Home page has a non-empty <meta name="description">.',
      { kind: "meta_present", name: "description", label: "meta description" }),
    card("Canonical URL is declared", "low",
      "A canonical link prevents duplicate-content ranking dilution.",
      'Home page has <link rel="canonical">.',
      { kind: "canonical_present" }),
    card("Open Graph title for link previews", "low",
      "og:title controls how the page looks when shared on social/chat.",
      "Home page has a non-empty og:title.",
      { kind: "og_present", property: "og:title" }),
    card("Open Graph image for link previews", "low",
      "og:image is the thumbnail shown when the link is shared.",
      "Home page has a non-empty og:image.",
      { kind: "og_present", property: "og:image" }),
    card("Schema.org structured data is valid", "low",
      "Structured data (JSON-LD) powers rich results and AI/search comprehension; FDC ships it on every public page.",
      "Home page has at least one valid application/ld+json block.",
      { kind: "jsonld_valid" }),
    card("Page is not accidentally noindex", "medium",
      "A noindex directive tells search engines to drop the page — a launch disaster if the page is meant to be public.",
      "Home page does not send a noindex directive (meta robots or X-Robots-Tag).",
      { kind: "not_noindex" }),
  ];
}
