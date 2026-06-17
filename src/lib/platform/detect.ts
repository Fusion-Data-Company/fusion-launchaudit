import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import type { AuditHints } from "../generators/types.ts";

/**
 * Platform auto-detection. Reads the repo scan + the live crawl and classifies the
 * target into one of ten platform kinds, so the audit can run the matching check
 * set. Evidence-based and explainable: every detection reports the plain-language
 * signals that drove it and a confidence, so a wrong guess is visible, not silent.
 */
export type Platform =
  | "marketing_landing" | "web_app_saas" | "ecommerce" | "mobile_app" | "api_backend"
  | "ai_chatbot_voice" | "blog_cms" | "browser_extension" | "internal_tool_admin" | "sales_funnel";

export const PLATFORM_LABEL: Record<Platform, string> = {
  marketing_landing: "Marketing / landing site",
  web_app_saas: "Web app / SaaS",
  ecommerce: "E-commerce store",
  mobile_app: "Mobile app (iOS/Android)",
  api_backend: "API / backend",
  ai_chatbot_voice: "AI chatbot / voice",
  blog_cms: "Blog / CMS",
  browser_extension: "Browser extension",
  internal_tool_admin: "Internal tool / admin",
  sales_funnel: "Sales funnel",
};

export type PlatformDetection = { platform: Platform; confidence: "high" | "medium" | "low"; signals: string[]; runnerUp?: Platform };

type Hit = { platform: Platform; weight: number; why: string };

export function detectPlatform(scan: RepoScan | null, crawl: RuntimeCrawl, hints?: AuditHints): PlatformDetection {
  const routes = scan?.detail?.routes ?? [];
  const evidence = [scan?.repo_summary?.framework ?? "", ...(scan?.detail?.framework_evidence ?? [])].join(" ").toLowerCase();
  const paths = [...routes.map((r) => r.url_path), ...crawl.links.map((l) => l.href)].join(" ").toLowerCase();
  const title = (crawl.title ?? "").toLowerCase();
  const apiCount = scan?.repo_summary?.api_route_count ?? routes.filter((r) => r.kind === "api").length;
  const pageCount = (scan?.repo_summary?.route_count ?? routes.length) - apiCount;
  const has = (corpus: string, ...needles: string[]) => needles.find((n) => corpus.includes(n));
  const hits: Hit[] = [];
  const hit = (platform: Platform, weight: number, why: string | undefined) => { if (why) hits.push({ platform, weight, why: `${why}` }); };

  // Repo-fingerprint signals (strongest — a manifest or framework is decisive).
  hit("browser_extension", 5, has(evidence, "manifest_version", "browser extension", "chrome.runtime", "web_accessible_resources") && "an extension manifest / chrome.* APIs are present");
  hit("mobile_app", 5, has(evidence, "expo", "react-native", "react native", "app.json", "eas.json") && "an Expo / React Native mobile project");
  hit("ecommerce", 4, has(evidence, "shopify", "stripe", "medusa", "commerce", "woocommerce", "snipcart") && "an e-commerce/payments dependency");
  hit("blog_cms", 3, has(evidence, "wordpress", "ghost", "contentful", "sanity", "strapi", "@mdx", "astro:content") && "a CMS / content framework");
  hit("ai_chatbot_voice", 4, (has(evidence, "elevenlabs", "convai", "openai", "@anthropic", "langchain", "vercel/ai") || (hints?.elevenLabsAgents?.length ?? 0) > 0) && "an LLM/voice dependency or configured agent");

  // Route / URL-shape signals.
  hit("ecommerce", 3, has(paths, "/cart", "/checkout", "/product", "/products/", "/shop", "/basket", "/sku") && "cart / checkout / product routes");
  hit("blog_cms", 2, has(paths, "/blog", "/posts/", "/article", "/tag/", "/category/", "/author/") && "blog / article / tag routes");
  hit("sales_funnel", 2, has(paths, "/thank", "/thanks", "/success", "/confirmation", "/upsell", "/offer") && "a thank-you / upsell / offer step");
  hit("internal_tool_admin", 3, routes.filter((r) => r.privileged).length >= Math.max(2, routes.length * 0.4) && "admin/privileged routes dominate the surface");

  // Declared-hint signals (the dev's agent told us about the surface).
  const adminHinted = [...(hints?.protectedRoutes ?? []), ...(hints?.protectedApis ?? []).map((a) => a.path)].filter((p) => /(^|\/)(admin|superadmin|internal)(\/|$)/i.test(p)).length;
  hit("internal_tool_admin", 3, adminHinted >= 2 && `${adminHinted} admin/privileged routes declared in hints`);
  hit("web_app_saas", 2, (hints?.loginPath || adminHinted >= 1) && "a login path / protected routes are declared (authenticated app)");

  // API-vs-page balance.
  if (apiCount > 0 && pageCount <= 1) hit("api_backend", 4, `${apiCount} API routes and no real page surface`);
  if (crawl.has_password_field) {
    hit("web_app_saas", 2, "a login / password field (authenticated app)");
    hit("internal_tool_admin", 1, "a login (could be an internal tool)");
  }
  // A single page + a lead form + a CTA, no app shell → a conversion funnel/landing.
  if (crawl.form_count >= 1 && pageCount <= 3 && !crawl.has_password_field) {
    hit("sales_funnel", 2, "a lead form on a small, single-purpose site");
    hit("marketing_landing", 1, "a small brochure-style site with a form");
  }
  if (pageCount >= 1 && apiCount === 0 && !crawl.has_password_field && crawl.form_count === 0) {
    hit("marketing_landing", 2, "static marketing pages, no auth, no API");
  }

  // Tally.
  const score = new Map<Platform, { total: number; reasons: string[] }>();
  for (const h of hits) {
    const cur = score.get(h.platform) ?? { total: 0, reasons: [] };
    cur.total += h.weight; cur.reasons.push(h.why);
    score.set(h.platform, cur);
  }
  const ranked = [...score.entries()].sort((a, b) => b[1].total - a[1].total);
  if (ranked.length === 0) {
    return { platform: "marketing_landing", confidence: "low", signals: ["No strong platform signals found; defaulting to marketing/landing. Pass a hint to override."] };
  }
  const [topPlatform, top] = ranked[0];
  const second = ranked[1];
  const margin = top.total - (second?.[1].total ?? 0);
  const confidence = top.total >= 5 && margin >= 2 ? "high" : margin >= 2 || top.total >= 4 ? "medium" : "low";
  return { platform: topPlatform, confidence, signals: top.reasons, runnerUp: second?.[0] };
}
