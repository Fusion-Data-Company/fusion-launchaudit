import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * Sales-funnel check set. A funnel lives or dies on the conversion path working
 * end to end: the lead is captured, every CTA goes somewhere real, no step dead-
 * ends, the confirmation fires, payment/upsell load, tracking fires, and it's fast
 * on mobile. These are funnel-SPECIFIC checks layered on the shared base (perf,
 * responsive, security run for every platform). Non-destructive: we never auto-
 * submit a lead to a real endpoint (that would spam a CRM) — that check is opt-in.
 */
const PIXELS = ["googletagmanager.com", "gtag(", "google-analytics.com", "/analytics.js", "fbq(", "connect.facebook.net", "plausible.io", "posthog", "cdn.segment", "static.hotjar", "clarity.ms", "mixpanel"];
const PAYMENT = ["js.stripe.com", "stripe(", "paypal.com/sdk", "paypalobjects", "braintreegateway", "squareup", "checkout.com", "lemonsqueezy", "paddle.com", "/checkout"];
const THANKYOU = /(thank|thanks|success|confirmation|confirmed|welcome-?aboard)/i;
const PAYSTEP = /(checkout|payment|upsell|offer|order|cart|buy)/i;

const toPath = (origin: string, href: string) => (href.startsWith(origin) ? href.slice(origin.length) || "/" : href);

export function generateFunnel(_scan: RepoScan | null, crawl: RuntimeCrawl, hints: AuditHints, c: Counter): GeneratedCard[] {
  const cards: GeneratedCard[] = [];
  const origin = (() => { try { return new URL(crawl.app_url ?? "").origin; } catch { return ""; } })();
  const internal = crawl.links.filter((l) => l.href.startsWith(origin)).map((l) => toPath(origin, l.href)).filter((p, i, a) => a.indexOf(p) === i).slice(0, 12);

  // 1. Every CTA routes somewhere real (no dead link / 404).
  if (internal.length > 0) {
    cards.push({
      id: c.next("TC-FUN"), title: "Every CTA / step link routes (no dead end)", category: "funnel", status: "ready", risk: "critical",
      goal: "A dead CTA or a 404 mid-funnel kills the conversion right there. Every internal link the funnel offers must resolve.",
      steps: internal.map((p) => `GET ${p} → not 404/410/5xx`), expectedEvidence: ["http_transcript"], dataNeeds: [],
      acceptanceCriteria: "No internal funnel link returns 404/410/5xx.",
      exec: internal.map((p) => ({ action: "http", method: "GET", path: p, expectStatusNot: [404, 410, 500, 502, 503] })),
    });
  } else {
    cards.push({ id: c.next("TC-FUN"), title: "CTA routing needs discoverable links", category: "funnel", status: "blocked", risk: "high", goal: "Verify every CTA routes.", steps: ["Ensure the landing page exposes its CTAs as links", "Re-run"], expectedEvidence: ["http_transcript"], dataNeeds: ["the funnel's CTA links"], acceptanceCriteria: "BLOCKED: no internal CTA links found to follow.", exec: [] });
  }

  // 2. Thank-you / confirmation step fires.
  const thanks = internal.find((p) => THANKYOU.test(p));
  if (thanks) {
    cards.push({ id: c.next("TC-FUN"), title: `Thank-you / confirmation step loads: ${thanks}`, category: "funnel", status: "ready", risk: "high", goal: "After conversion, the confirmation page must actually load — a blank/500 thank-you page erodes trust and breaks tracking.", steps: [`GET ${thanks} → 200`], expectedEvidence: ["http_transcript"], dataNeeds: [], acceptanceCriteria: `${thanks} returns 200.`, exec: [{ action: "http", method: "GET", path: thanks, expectStatusOneOf: [200] }] });
  } else {
    cards.push({ id: c.next("TC-FUN"), title: "No thank-you / confirmation step found", category: "funnel", status: "blocked", risk: "high", goal: "Confirm the post-conversion confirmation fires.", steps: ["Declare the confirmation path in hints (e.g. /thank-you) or link it from the funnel", "Re-run"], expectedEvidence: ["http_transcript"], dataNeeds: ["the confirmation/thank-you path"], acceptanceCriteria: "BLOCKED: no thank-you/confirmation step discovered.", exec: [] });
  }

  // 3. Lead is actually captured — opt-in only (auto-submitting to a live endpoint would spam the CRM).
  cards.push({ id: c.next("TC-FUN"), title: "Lead form actually saves the lead", category: "funnel", status: "blocked", risk: "critical", goal: "The whole point of the funnel: a submitted lead must persist. Verifying it means submitting a test lead, which on a live funnel would pollute the real CRM.", steps: ["Point the audit at a staging funnel, or provide a safe test submit endpoint", "Confirm the test lead persists (and remove it) — pair with the Database component check"], expectedEvidence: ["http_transcript", "db_row"], dataNeeds: ["a safe (staging) lead endpoint"], acceptanceCriteria: "BLOCKED by default: lead-save is verified only against a safe/staging endpoint to avoid spamming a production CRM. The form's presence + submit success is the proxy; persistence is confirmed via the Database component.", exec: [] });

  // 4. Tracking pixels fire (the funnel must be able to measure conversions).
  cards.push({ id: c.next("TC-FUN"), title: "Conversion tracking / pixel is present", category: "funnel", status: "ready", risk: "high", goal: "A funnel with no analytics/pixel is flying blind — you can't see what converts or retarget. At least one tracking tag must load.", steps: ["GET / → page includes a known analytics/pixel snippet"], expectedEvidence: ["http_transcript"], dataNeeds: [], acceptanceCriteria: "Home page includes at least one analytics/pixel (GA/GTM, Meta Pixel, Plausible, PostHog, Segment, Hotjar, Clarity, Mixpanel).", exec: [{ action: "http", method: "GET", path: "/", expectBodyIncludesAny: { needles: PIXELS, label: "a conversion-tracking pixel/analytics tag" } }] });

  // 5. Payment + upsell step loads with a payment provider.
  const payStep = internal.find((p) => PAYSTEP.test(p));
  if (payStep) {
    cards.push({ id: c.next("TC-FUN"), title: `Payment / upsell step loads: ${payStep}`, category: "funnel", status: "ready", risk: "critical", goal: "If the funnel takes money, the payment/upsell step must load and carry a real payment provider — a broken checkout is lost revenue at the last step.", steps: [`GET ${payStep} → 200 with a payment provider script`], expectedEvidence: ["http_transcript"], dataNeeds: [], acceptanceCriteria: `${payStep} returns 200 and includes a payment provider (Stripe/PayPal/etc.).`, exec: [{ action: "http", method: "GET", path: payStep, expectStatusOneOf: [200], expectBodyIncludesAny: { needles: PAYMENT, label: "a payment provider script (Stripe/PayPal/Braintree/Square/Paddle/…)" } }] });
  } else {
    cards.push({ id: c.next("TC-FUN"), title: "No payment / upsell step found", category: "funnel", status: "blocked", risk: "medium", goal: "Confirm payment + upsell work.", steps: ["If the funnel takes payment, link/declare the checkout/upsell step", "Re-run"], expectedEvidence: ["http_transcript"], dataNeeds: ["the checkout/upsell path"], acceptanceCriteria: "BLOCKED: no checkout/payment/upsell step discovered (a lead-only funnel may not have one).", exec: [] });
  }

  // 6. Fast on mobile — the funnel's entry must not be sluggish on a phone.
  cards.push({ id: c.next("TC-FUN"), title: "Funnel landing is fast and fits on mobile", category: "funnel", status: "ready", risk: "high", goal: "Most funnel traffic is mobile/paid; a slow or overflowing landing page bleeds conversions before the offer is even read.", steps: ["Load / at 390px", "No horizontal overflow", "Core Web Vitals not in the poor range"], expectedEvidence: ["screenshot", "trace"], dataNeeds: [], acceptanceCriteria: "At 390px the landing page has no horizontal overflow and no poor-range Core Web Vital.", exec: [{ action: "set_viewport", width: 390, height: 844 }, { action: "goto", path: "/" }, { action: "expect_no_horizontal_overflow" }, { action: "web_vitals" }] });

  return cards;
}
