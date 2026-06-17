import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * Platform-specific check sets layered on the shared base (security/a11y/perf/SEO
 * run for every platform). Each platform gets its OWN concrete checks — we never
 * reuse a generic set. HTTP-based so they flow through the truth-protocol spine
 * (evidence + watchdog re-verify). Blocked-when-untestable, never a faked pass.
 */
const NONEXISTENT = "/launchaudit-404-probe-zzz";
const toPath = (origin: string, href: string) => (href.startsWith(origin) ? href.slice(origin.length) || "/" : href);
const originOf = (crawl: RuntimeCrawl) => { try { return new URL(crawl.app_url ?? "").origin; } catch { return ""; } };
const internalPaths = (crawl: RuntimeCrawl) => { const o = originOf(crawl); return crawl.links.filter((l) => l.href.startsWith(o)).map((l) => toPath(o, l.href)); };

// ---- API / backend -------------------------------------------------------
export function generateApiBackend(scan: RepoScan | null, _crawl: RuntimeCrawl, hints: AuditHints, c: Counter): GeneratedCard[] {
  const cards: GeneratedCard[] = [];
  const apis = [...(hints.protectedApis ?? []).map((a) => a.path), ...(scan?.detail?.routes ?? []).filter((r) => r.kind === "api").map((r) => r.url_path)].filter((p, i, a) => a.indexOf(p) === i);

  cards.push({
    id: c.next("TC-API"), title: "Unknown route returns a clean 404 (no soft-200, no 5xx)", category: "api_contract", status: "ready", risk: "medium",
    goal: "An API must answer an unknown path with 404 — not a 200 'soft 404' and not a 500.",
    steps: [`GET ${NONEXISTENT}`, "Expect 404"], expectedEvidence: ["http_transcript"], dataNeeds: [],
    acceptanceCriteria: `GET ${NONEXISTENT} returns 404. HTTP semantics (RFC 9110).`,
    exec: [{ action: "http", method: "GET", path: NONEXISTENT, expectStatusOneOf: [404] }],
  });
  cards.push({
    id: c.next("TC-API"), title: "Errors are JSON, not an HTML page or stack trace", category: "api_contract", status: "ready", risk: "high",
    goal: "An API's error responses should be machine-readable JSON, never an HTML error page or a raw stack trace.",
    steps: [`GET ${NONEXISTENT}`, "Body is not an HTML document and carries no stack trace"], expectedEvidence: ["http_transcript"], dataNeeds: [],
    acceptanceCriteria: "Error body is not <html>/<!DOCTYPE and has no stack trace. OWASP API8.",
    exec: [{ action: "http", method: "GET", path: NONEXISTENT, expectBodyExcludes: ["<!DOCTYPE", "<html", "    at ", "Traceback"] }],
  });
  if (apis[0]) {
    cards.push({
      id: c.next("TC-API"), title: `Wrong HTTP method is rejected: ${apis[0]}`, category: "api_contract", status: "ready", risk: "low",
      goal: "Calling an endpoint with an unsupported method should return 405/404, not silently 200.",
      steps: [`DELETE ${apis[0]}`, "Expect a rejection (not 2xx)"], expectedEvidence: ["http_transcript"], dataNeeds: [],
      acceptanceCriteria: `An unsupported method on ${apis[0]} is not accepted (no 2xx). RFC 9110.`,
      exec: [{ action: "http", method: "DELETE", path: apis[0], expectStatusNot: [200, 201, 202, 204] }],
    });
  } else {
    cards.push({ id: c.next("TC-API"), title: "Method-handling check needs a known API route", category: "api_contract", status: "blocked", risk: "low", goal: "Confirm wrong methods are rejected.", steps: ["Provide --repo or protected_apis so an API route is known", "Re-run"], expectedEvidence: ["http_transcript"], dataNeeds: ["a known API route"], acceptanceCriteria: "BLOCKED: no API route discovered to method-test.", exec: [] });
  }
  return cards;
}

// ---- Marketing / landing -------------------------------------------------
export function generateMarketing(_scan: RepoScan | null, crawl: RuntimeCrawl, _hints: AuditHints, c: Counter): GeneratedCard[] {
  const cards: GeneratedCard[] = [];
  cards.push({
    id: c.next("TC-MKT"), title: "Unknown URL shows a real 404 (not a soft-200)", category: "core_workflow", status: "ready", risk: "medium",
    goal: "A missing page must return 404 so search engines don't index junk URLs as real pages.",
    steps: [`GET ${NONEXISTENT}`, "Expect 404"], expectedEvidence: ["http_transcript"], dataNeeds: [],
    acceptanceCriteria: `GET ${NONEXISTENT} returns 404, not a 200 soft-404. Google Search Central (soft 404s).`,
    exec: [{ action: "http", method: "GET", path: NONEXISTENT, expectStatusOneOf: [404] }],
  });
  cards.push({
    id: c.next("TC-MKT"), title: "Landing page has a clear call-to-action", category: "core_workflow", status: "ready", risk: "high",
    goal: "A landing page with no button/CTA can't convert. There must be at least one actionable element.",
    steps: ["Load /", "A button or primary link is present and visible"], expectedEvidence: ["screenshot"], dataNeeds: [],
    acceptanceCriteria: "The landing page renders at least one visible button/CTA.",
    exec: [{ action: "goto", path: "/" }, { action: "expect_visible", selector: "a[href], button, [role=button]" }],
  });
  const contact = internalPaths(crawl).find((p) => /(contact|get-?started|signup|demo|book|quote)/i.test(p));
  if (contact) {
    cards.push({ id: c.next("TC-MKT"), title: `Conversion path loads: ${contact}`, category: "core_workflow", status: "ready", risk: "high", goal: "The page the main CTA points to must actually load.", steps: [`GET ${contact}`, "Expect 200"], expectedEvidence: ["http_transcript"], dataNeeds: [], acceptanceCriteria: `${contact} returns 200.`, exec: [{ action: "http", method: "GET", path: contact, expectStatusOneOf: [200] }] });
  } else {
    cards.push({ id: c.next("TC-MKT"), title: "No clear conversion path (contact/signup/demo) found", category: "core_workflow", status: "blocked", risk: "medium", goal: "Confirm the CTA destination loads.", steps: ["Link a contact/signup/demo page from the landing page", "Re-run"], expectedEvidence: ["http_transcript"], dataNeeds: ["a conversion page link"], acceptanceCriteria: "BLOCKED: no conversion path discovered to verify.", exec: [] });
  }
  return cards;
}

// ---- Blog / CMS ----------------------------------------------------------
export function generateBlogCms(_scan: RepoScan | null, crawl: RuntimeCrawl, _hints: AuditHints, c: Counter): GeneratedCard[] {
  const cards: GeneratedCard[] = [];
  cards.push({
    id: c.next("TC-BLOG"), title: "robots.txt is served", category: "seo", status: "ready", risk: "low",
    goal: "A content site needs a robots.txt so crawlers know what to index.",
    steps: ["GET /robots.txt", "Expect 200"], expectedEvidence: ["http_transcript"], dataNeeds: [],
    acceptanceCriteria: "/robots.txt returns 200. Google Search Central.",
    exec: [{ action: "http", method: "GET", path: "/robots.txt", expectStatusOneOf: [200] }],
  });
  cards.push({
    id: c.next("TC-BLOG"), title: "XML sitemap is served and well-formed", category: "seo", status: "ready", risk: "medium",
    goal: "A sitemap helps search engines discover every post.",
    steps: ["GET /sitemap.xml", "Expect 200 with a urlset/sitemapindex"], expectedEvidence: ["http_transcript"], dataNeeds: [],
    acceptanceCriteria: "/sitemap.xml returns 200 and contains <urlset> or <sitemapindex>. sitemaps.org.",
    exec: [{ action: "http", method: "GET", path: "/sitemap.xml", expectStatusOneOf: [200], expectBodyIncludesAny: { needles: ["<urlset", "<sitemapindex"], label: "a sitemap urlset/sitemapindex" } }],
  });
  cards.push({
    id: c.next("TC-BLOG"), title: "Missing post returns 404 (no soft-200)", category: "seo", status: "ready", risk: "medium",
    goal: "A non-existent article must 404 so deleted/typo URLs aren't indexed as live pages.",
    steps: [`GET /blog${NONEXISTENT}`, "Expect 404"], expectedEvidence: ["http_transcript"], dataNeeds: [],
    acceptanceCriteria: `A missing post path returns 404. Google Search Central (soft 404s).`,
    exec: [{ action: "http", method: "GET", path: `/blog${NONEXISTENT}`, expectStatusOneOf: [404] }],
  });
  const post = internalPaths(crawl).find((p) => /(\/blog\/|\/posts?\/|\/article)/i.test(p));
  if (post) {
    cards.push({ id: c.next("TC-BLOG"), title: `A post page loads: ${post}`, category: "seo", status: "ready", risk: "medium", goal: "Article pages must render for readers and crawlers.", steps: [`GET ${post}`, "Expect 200"], expectedEvidence: ["http_transcript"], dataNeeds: [], acceptanceCriteria: `${post} returns 200.`, exec: [{ action: "http", method: "GET", path: post, expectStatusOneOf: [200] }] });
  }
  return cards;
}

const PAYMENT = ["js.stripe.com", "stripe(", "paypal.com/sdk", "paypalobjects", "braintreegateway", "squareup", "checkout.com", "paddle.com"];

// ---- E-commerce ----------------------------------------------------------
export function generateEcommerce(_scan: RepoScan | null, crawl: RuntimeCrawl, _hints: AuditHints, c: Counter): GeneratedCard[] {
  const cards: GeneratedCard[] = [];
  const paths = internalPaths(crawl);
  const product = paths.find((p) => /(\/product|\/shop|\/store|\/api\/products)/i.test(p));
  const checkout = paths.find((p) => /(\/checkout|\/cart|\/bag|\/basket)/i.test(p));

  if (product) {
    cards.push({ id: c.next("TC-ECOM"), title: `Product / catalog page loads: ${product}`, category: "core_workflow", status: "ready", risk: "high", goal: "If shoppers can't see products, there's no store.", steps: [`GET ${product}`, "Expect 200"], expectedEvidence: ["http_transcript"], dataNeeds: [], acceptanceCriteria: `${product} returns 200.`, exec: [{ action: "http", method: "GET", path: product, expectStatusOneOf: [200] }] });
  } else {
    cards.push({ id: c.next("TC-ECOM"), title: "No product/catalog page found", category: "core_workflow", status: "blocked", risk: "high", goal: "Confirm products are reachable.", steps: ["Link the product/catalog page", "Re-run"], expectedEvidence: ["http_transcript"], dataNeeds: ["a product/catalog URL"], acceptanceCriteria: "BLOCKED: no product/catalog page discovered.", exec: [] });
  }
  if (checkout) {
    cards.push({ id: c.next("TC-ECOM"), title: `Checkout loads with a real payment provider: ${checkout}`, category: "integration_side_effects", status: "ready", risk: "critical", goal: "A broken checkout is lost revenue at the final step; it must load and carry a payment provider.", steps: [`GET ${checkout}`, "Expect 200 with a payment provider script"], expectedEvidence: ["http_transcript"], dataNeeds: [], acceptanceCriteria: `${checkout} returns 200 and includes a payment provider (Stripe/PayPal/etc.).`, exec: [{ action: "http", method: "GET", path: checkout, expectStatusOneOf: [200], expectBodyIncludesAny: { needles: PAYMENT, label: "a payment provider script (Stripe/PayPal/Braintree/Square/Paddle)" } }] });
  } else {
    cards.push({ id: c.next("TC-ECOM"), title: "No cart/checkout step found", category: "integration_side_effects", status: "blocked", risk: "critical", goal: "Confirm checkout + payment work.", steps: ["Link the cart/checkout page", "Re-run"], expectedEvidence: ["http_transcript"], dataNeeds: ["a cart/checkout URL"], acceptanceCriteria: "BLOCKED: no cart/checkout step discovered.", exec: [] });
  }
  cards.push({ id: c.next("TC-ECOM"), title: "Missing product returns 404 (no soft-200)", category: "core_workflow", status: "ready", risk: "medium", goal: "Out-of-stock/removed products must 404 so dead SKUs aren't indexed.", steps: [`GET /products${NONEXISTENT}`, "Expect 404"], expectedEvidence: ["http_transcript"], dataNeeds: [], acceptanceCriteria: "A missing product path returns 404.", exec: [{ action: "http", method: "GET", path: `/products${NONEXISTENT}`, expectStatusOneOf: [404] }] });
  return cards;
}

// ---- Web app / SaaS ------------------------------------------------------
export function generateWebApp(scan: RepoScan | null, crawl: RuntimeCrawl, hints: AuditHints, c: Counter): GeneratedCard[] {
  const cards: GeneratedCard[] = [];
  const login = hints.loginPath ?? internalPaths(crawl).find((p) => /(\/login|\/signin|\/sign-in)/i.test(p));
  const protectedRoute = (hints.protectedRoutes ?? [])[0] ?? (scan?.detail?.routes ?? []).find((r) => r.kind === "page" && r.privileged)?.url_path;

  if (login) {
    cards.push({ id: c.next("TC-APP"), title: `Login page loads: ${login}`, category: "auth", status: "ready", risk: "high", goal: "The sign-in entry point must load — no app without a way in.", steps: [`GET ${login}`, "Expect 200"], expectedEvidence: ["http_transcript"], dataNeeds: [], acceptanceCriteria: `${login} returns 200.`, exec: [{ action: "http", method: "GET", path: login, expectStatusOneOf: [200] }] });
  } else {
    cards.push({ id: c.next("TC-APP"), title: "No login page found", category: "auth", status: "blocked", risk: "high", goal: "Confirm the auth entry point.", steps: ["Declare login_path in hints or link /login", "Re-run"], expectedEvidence: ["http_transcript"], dataNeeds: ["the login path"], acceptanceCriteria: "BLOCKED: no login page discovered.", exec: [] });
  }
  if (protectedRoute) {
    cards.push({ id: c.next("TC-APP"), title: `Protected route requires sign-in (anonymous blocked): ${protectedRoute}`, category: "auth", status: "ready", risk: "critical", goal: "An app route behind auth must redirect/refuse an anonymous visitor — never render the app to the public.", steps: [`GET ${protectedRoute} with no session`, "Expect a redirect/401/403"], expectedEvidence: ["http_transcript"], dataNeeds: [], acceptanceCriteria: `Anonymous GET ${protectedRoute} is blocked (redirect/401/403). OWASP WSTG authentication.`, exec: [{ action: "http", method: "GET", path: protectedRoute, expectBlocked: true }] });
  } else {
    cards.push({ id: c.next("TC-APP"), title: "No protected app route declared", category: "auth", status: "blocked", risk: "high", goal: "Confirm protected routes require auth.", steps: ["Declare protected_routes in hints", "Re-run"], expectedEvidence: ["http_transcript"], dataNeeds: ["a protected route"], acceptanceCriteria: "BLOCKED: no protected app route to test anonymous access against.", exec: [] });
  }
  return cards;
}

// ---- Internal tool / admin ----------------------------------------------
export function generateInternalTool(scan: RepoScan | null, crawl: RuntimeCrawl, hints: AuditHints, c: Counter): GeneratedCard[] {
  const cards: GeneratedCard[] = [];
  const protectedRoute = (hints.protectedRoutes ?? [])[0] ?? (scan?.detail?.routes ?? []).find((r) => r.privileged)?.url_path;
  const signup = internalPaths(crawl).find((p) => /(\/signup|\/sign-up|\/register|\/join)/i.test(p));

  if (protectedRoute) {
    cards.push({ id: c.next("TC-INT"), title: `Internal surface is not public (anonymous blocked): ${protectedRoute}`, category: "roles_permissions", status: "ready", risk: "critical", goal: "An internal tool must not serve its surface to anonymous visitors — every privileged route refuses the public.", steps: [`GET ${protectedRoute} with no session`, "Expect a redirect/401/403"], expectedEvidence: ["http_transcript"], dataNeeds: [], acceptanceCriteria: `Anonymous GET ${protectedRoute} is blocked. OWASP WSTG authorization.`, exec: [{ action: "http", method: "GET", path: protectedRoute, expectBlocked: true }] });
  } else {
    cards.push({ id: c.next("TC-INT"), title: "No internal/admin route declared to gate-check", category: "roles_permissions", status: "blocked", risk: "high", goal: "Confirm the internal surface is gated.", steps: ["Declare protected_routes in hints", "Re-run"], expectedEvidence: ["http_transcript"], dataNeeds: ["an internal/admin route"], acceptanceCriteria: "BLOCKED: no internal/admin route to test.", exec: [] });
  }
  if (signup) {
    cards.push({ id: c.next("TC-INT"), title: `No public self-registration: ${signup}`, category: "roles_permissions", status: "ready", risk: "high", goal: "Internal tools should not let the public create accounts — open registration on an internal tool is an exposure.", steps: [`GET ${signup} with no session`, "Expect it to NOT serve an open signup (blocked/404)"], expectedEvidence: ["http_transcript"], dataNeeds: [], acceptanceCriteria: `${signup} is not an open public signup (blocked or 404). Confirm if intentional.`, exec: [{ action: "http", method: "GET", path: signup, expectBlocked: true }] });
  }
  return cards;
}
