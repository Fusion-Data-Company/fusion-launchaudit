/**
 * The bonus "Google ranking" section appended to EVERY report, whatever the
 * platform. It is derived from the audit's own results (never invented): each
 * ranking-relevant check that passed becomes "what's helping", each that failed
 * becomes "what's hurting" + an exact fix, cited to Google Search Central /
 * web.dev. Plain language; one concrete line per factor, never a generalization.
 */
export type RankingCard = { category: string; status: string };
export type SeoRanking = {
  helps: string[];
  hurts: string[];
  fixes: Array<{ issue: string; fix: string; source: string }>;
};

// Documented Google ranking / page-experience factors mapped to our check categories.
const FACTORS: Record<string, { helps: string; hurts: string; fix: string; source: string }> = {
  seo: {
    helps: "Search engines can read your title, meta description, canonical, and Schema.org structured data.",
    hurts: "Missing title / meta / canonical / structured data weakens how you appear in search and rich results.",
    fix: "Add a descriptive <title> (50-60 chars), a meta description, a canonical link, and valid Schema.org JSON-LD for the page's main entity.",
    source: "Google Search Central — https://developers.google.com/search/docs",
  },
  performance: {
    helps: "Core Web Vitals are healthy — page experience is a confirmed Google ranking signal.",
    hurts: "Poor Core Web Vitals (LCP/CLS/INP) drag down page-experience ranking, especially on mobile.",
    fix: "Improve LCP (optimize the largest image/server response), CLS (set media dimensions), and INP (cut main-thread work). See web.dev/vitals.",
    source: "web.dev Core Web Vitals — https://web.dev/vitals/",
  },
  tls_hsts: {
    helps: "Served over HTTPS — HTTPS is a confirmed Google ranking signal.",
    hurts: "No HTTPS / HSTS — Google favors secure sites and browsers warn on http.",
    fix: "Serve the whole site over HTTPS, redirect http->https, and send Strict-Transport-Security.",
    source: "Google Search Central (HTTPS as a ranking signal) — https://developers.google.com/search/docs/crawling-indexing/site-move-https",
  },
  responsive_visual: {
    helps: "Mobile-friendly layout — Google indexes mobile-first.",
    hurts: "Mobile layout problems (overflow/zoom) hurt under mobile-first indexing.",
    fix: "Make the layout responsive: no horizontal overflow at 390px, a proper viewport meta, and tap targets >= 24px.",
    source: "Google Search Central (mobile-first indexing) — https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing",
  },
  content_integrity: {
    helps: "Real, finished content (no placeholder/unbound values) reads as a quality, helpful page.",
    hurts: "Placeholder/lorem or broken (undefined/NaN) content signals a low-quality page to the helpful-content system.",
    fix: "Replace placeholder copy and fix any unbound/undefined values rendered on the page before indexing.",
    source: "Google Search Central (helpful content) — https://developers.google.com/search/docs/fundamentals/creating-helpful-content",
  },
};

const RANKING_CATEGORIES = Object.keys(FACTORS);
const isPass = (s: string) => s === "passed" || s === "pass";

export function buildSeoRanking(cards: RankingCard[]): SeoRanking {
  const helps: string[] = [];
  const hurts: string[] = [];
  const fixes: SeoRanking["fixes"] = [];
  for (const cat of RANKING_CATEGORIES) {
    const relevant = cards.filter((c) => c.category === cat);
    if (relevant.length === 0) continue;
    const allPass = relevant.every((c) => isPass(c.status));
    const f = FACTORS[cat];
    if (allPass) {
      helps.push(f.helps);
    } else {
      hurts.push(f.hurts);
      fixes.push({ issue: f.hurts, fix: f.fix, source: f.source });
    }
  }
  if (helps.length === 0 && hurts.length === 0) {
    hurts.push("No ranking-relevant checks ran for this target — point the audit at the public, indexable pages to assess ranking.");
  }
  return { helps, hurts, fixes };
}
