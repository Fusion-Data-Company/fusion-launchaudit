/**
 * /api/checkout — POST { url, email, tier } → { url: <Stripe Checkout URL> }.
 * Creates a Stripe Checkout Session (payment mode) for a hosted Single Run audit.
 * The target URL goes through the same SSRF guard as the free grader.
 */
import { validateCheckoutInput, AUDIT_TIERS } from "../../src/lib/checkout-input.ts";
import { stripeRequest } from "../../src/lib/stripe.ts";
import { clientIp, consumeAttempt } from "../../src/lib/rate-limit.ts";

type Req = { method?: string; headers?: Record<string, string | string[] | undefined>; body?: unknown };
type Res = { status: (n: number) => Res; json: (b: unknown) => void };

const SITE = "https://80-20.dev";

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST a JSON body { url, email, tier }." }); return; }
  const rl = consumeAttempt({ scope: "checkout", key: clientIp(req.headers), limit: 6, windowMs: 10 * 60_000 });
  if (!rl.ok) { res.status(429).json({ error: `Too many checkout attempts. Try again in ${rl.retryAfterSec}s.` }); return; }
  const input = validateCheckoutInput(req.body);
  if (!input.ok) { res.status(400).json({ error: input.error }); return; }
  const { url, email, tier } = input.value;

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) { res.status(503).json({ error: "Ordering is temporarily unavailable (payments not configured)." }); return; }

  const tierInfo = AUDIT_TIERS[tier];
  const priceId = process.env[tierInfo.priceEnv];
  // Prefer the configured Price; fall back to inline price_data so a fresh Stripe
  // account still works before Prices are created in the dashboard.
  const lineItem = priceId
    ? { price: priceId, quantity: 1 }
    : {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: tierInfo.amountCents,
          product_data: { name: `80/20 Launch Audit — ${tierInfo.label}`, description: `Hosted deep audit of ${url}` },
        },
      };

  try {
    const session = await stripeRequest<{ id: string; url: string }>(secret, "/v1/checkout/sessions", {
      mode: "payment",
      // Card and Link only. Delayed-notification methods (Klarna, Afterpay, ACH, Cash App)
      // complete the session unpaid and settle later; the buyer would sit on the success
      // page with no report. The webhook handles async_payment_* anyway, belt and braces.
      payment_method_types: ["card", "link"],
      line_items: [lineItem],
      customer_email: email,
      metadata: { target_url: url, tier },
      payment_intent_data: { metadata: { target_url: url, tier } },
      success_url: `${SITE}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE}/#order`,
    });
    res.status(200).json({ ok: true, url: session.url, session_id: session.id });
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "Could not start checkout." });
  }
}
