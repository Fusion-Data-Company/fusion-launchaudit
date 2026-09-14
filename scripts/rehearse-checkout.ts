/**
 * One-command checkout rehearsal for 80/20 Launch Audit.
 *
 *   npm run rehearse:checkout -- --mode handler --base http://127.0.0.1:3003 --url https://fusiondataco.com --tier single
 *   npm run rehearse:checkout -- --mode live    --base https://80-20.dev      --url https://fusiondataco.com --tier single
 *
 * --mode handler (no Stripe key needed; what this repo can prove on a machine with no test key):
 *   --defer-url rehearses the pay-first path: the session carries no target_url, the webhook parks
 *   the order as awaiting_url, and the script names the site through /api/order-url exactly as
 *   the success page form does, before polling.
 *   1. writes a canonical Checkout Session fixture (the exact shape Stripe returns with
 *      payment_intent.latest_charge expanded: mode, status, payment_status, currency,
 *      amount_total for the tier, metadata.target_url + tier, customer_details.email, livemode
 *      false) into STRIPE_SESSION_FIXTURE_DIR, which the dev server's webhook reads instead of
 *      calling Stripe (non-production only),
 *   2. builds a checkout.session.completed event around it, signs it exactly the way Stripe does
 *      (Stripe-Signature: t=<unix>,v1=HMAC-SHA256(`${t}.${body}`, STRIPE_WEBHOOK_SECRET)),
 *   3. POSTs it to <base>/api/stripe-webhook and expects 2xx + status queued,
 *   4. polls <base>/api/order-status until the order is delivered (this poll is what runs the
 *      real audit against --url, exactly as the success page does),
 *   5. fetches the hosted report link and the PDF route, checks both open (200, %PDF),
 *   6. prints the email outcome (sent / skipped / error) and the captured .eml path when the dev
 *      server was started with MAIL_CAPTURE_DIR.
 *
 * --mode live (needs STRIPE_SECRET_KEY=sk_test_... and the STRIPE_PRICE_* test price ids in the
 *   env of the server at --base, plus the Stripe CLI or dashboard webhook forwarding to it):
 *   1. POSTs <base>/api/checkout with the tier + url + email and prints the Checkout URL,
 *   2. waits for you to pay with 4242 4242 4242 4242 (or pass --session cs_test_... to skip),
 *   3. polls <base>/api/order-status until delivered and verifies the same links as above.
 *
 * Both modes exit non-zero on the first failed step and print every step with its evidence.
 * Nothing here ever touches a live key: live mode refuses to run unless the key is sk_test_.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { signStripePayload } from "../src/lib/stripe.ts";
import { AUDIT_TIERS, isAuditTier } from "../src/lib/checkout-input.ts";

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) { const v = process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[++i] : "true"; args.set(a.slice(2), v); }
}
const mode = args.get("mode") ?? "handler";
const base = (args.get("base") ?? "http://127.0.0.1:3003").replace(/\/$/, "");
const targetUrl = args.get("url") ?? "https://fusiondataco.com";
const tier = args.get("tier") ?? "single";
const email = args.get("email") ?? "rob@fusiondataco.com";
const outDir = args.get("out") ?? "docs/proof/2026-09-14/handler-rehearsal";
const deferUrl = args.get("defer-url") === "true";
if (!isAuditTier(tier)) throw new Error(`--tier must be single | standard | pro (got ${tier})`);

const log: string[] = [];
function step(n: number, title: string, evidence: unknown) {
  const line = `STEP ${n}  ${title}\n        ${typeof evidence === "string" ? evidence : JSON.stringify(evidence)}`;
  console.log(line); log.push(line);
}
function fail(msg: string): never { console.error(`FAIL  ${msg}`); log.push(`FAIL  ${msg}`); void writeLog().then(() => process.exit(1)); throw new Error(msg); }
async function writeLog() { await fs.mkdir(outDir, { recursive: true }); await fs.writeFile(path.join(outDir, `rehearsal-${mode}.log`), log.join("\n") + "\n"); }

async function pollUntilDelivered(sessionId: string): Promise<Record<string, unknown>> {
  const deadline = Date.now() + 6 * 60_000;
  let last: Record<string, unknown> = {};
  while (Date.now() < deadline) {
    const r = await fetch(`${base}/api/order-status?session_id=${encodeURIComponent(sessionId)}`, { headers: { "cache-control": "no-store" } });
    last = (await r.json()) as Record<string, unknown>;
    const status = String(last.status ?? "");
    if (status === "delivered" || status === "blocked" || status === "refunded" || status === "disputed" || status === "payment_failed") return last;
    if (last.grade_error) console.log(`      (grade_error, retrying: ${last.grade_error})`);
    await new Promise((res) => setTimeout(res, 3000));
  }
  return last;
}

async function verifyLinks(status: Record<string, unknown>) {
  const reportUrl = String(status.report_url ?? "");
  const pdfUrl = String(status.report_pdf_url ?? "");
  if (!reportUrl) fail("no report_url on the delivered order");
  const r1 = await fetch(reportUrl);
  const b1 = Buffer.from(await r1.arrayBuffer());
  step(5, "hosted report link opens", { url: reportUrl, http: r1.status, content_type: r1.headers.get("content-type"), bytes: b1.length, is_pdf: b1.subarray(0, 5).toString() === "%PDF-" });
  if (r1.status !== 200) fail(`hosted link returned ${r1.status}`);
  const r2 = await fetch(pdfUrl);
  const b2 = Buffer.from(await r2.arrayBuffer());
  step(6, "PDF route opens", { url: pdfUrl, http: r2.status, content_type: r2.headers.get("content-type"), bytes: b2.length, is_pdf: b2.subarray(0, 5).toString() === "%PDF-" });
  if (r2.status !== 200 || b2.subarray(0, 5).toString() !== "%PDF-") fail("PDF route did not return a PDF");
  await fs.mkdir(outDir, { recursive: true });
  const pdfPath = path.join(outDir, `report-${tier}.pdf`);
  await fs.writeFile(pdfPath, b2);
  step(7, "PDF saved", { path: pdfPath, bytes: b2.length });
  const em = status.email_delivery as { status?: string; detail?: string | null } | null;
  step(8, "email outcome", em ?? "no delivery record");
}

async function handlerMode() {
  const fixtureDir = process.env.STRIPE_SESSION_FIXTURE_DIR;
  const whsec = process.env.STRIPE_WEBHOOK_SECRET;
  if (!fixtureDir || !whsec) fail("handler mode needs STRIPE_SESSION_FIXTURE_DIR and STRIPE_WEBHOOK_SECRET (the same values the dev server was started with)");
  const sessionId = `cs_test_rehearsal_${Date.now().toString(36)}`;
  const amount = AUDIT_TIERS[tier].amountCents;
  const now = Math.floor(Date.now() / 1000);
  const session = {
    id: sessionId, object: "checkout.session", livemode: false, mode: "payment", status: "complete", payment_status: "paid",
    currency: "usd", amount_subtotal: amount, amount_total: amount, created: now, expires_at: now + 86400,
    customer: null, customer_email: email, customer_details: { email, name: "Rob Yeager", address: null, phone: null, tax_exempt: "none", tax_ids: [] },
    metadata: deferUrl ? { tier } : { target_url: targetUrl, tier },
    payment_method_types: ["card", "link"], payment_intent: {
      id: `pi_rehearsal_${now}`, object: "payment_intent", livemode: false, status: "succeeded", amount, amount_received: amount, currency: "usd",
      metadata: deferUrl ? { tier } : { target_url: targetUrl, tier },
      latest_charge: { id: `ch_rehearsal_${now}`, object: "charge", livemode: false, paid: true, status: "succeeded", amount, amount_refunded: 0, disputed: false, refunded: false, created: now, currency: "usd", receipt_email: email },
    },
    success_url: `${base}/order/success?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${base}/#order`, url: null,
  };
  await fs.mkdir(fixtureDir!, { recursive: true });
  const fixturePath = path.join(fixtureDir!, `${sessionId}.json`);
  await fs.writeFile(fixturePath, JSON.stringify(session, null, 2));
  step(1, "canonical session fixture written (what Stripe would return on re-fetch)", { path: fixturePath, tier, amount_total: amount, target_url: targetUrl, email });

  const event = { id: `evt_rehearsal_${now}`, object: "event", api_version: "2026-02-25.clover", created: now, livemode: false, pending_webhooks: 1,
    request: { id: null, idempotency_key: null }, type: "checkout.session.completed",
    data: { object: { ...session, payment_intent: session.payment_intent.id } } };
  const body = JSON.stringify(event);
  const sig = signStripePayload(body, whsec!);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, "event.json"), JSON.stringify(event, null, 2));
  const r = await fetch(`${base}/api/stripe-webhook`, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": sig }, body });
  const ack = await r.json();
  step(2, "signed checkout.session.completed POSTed to /api/stripe-webhook", { http: r.status, stripe_signature: sig.slice(0, 40) + "...", ack });
  const expected = deferUrl ? "awaiting_url" : "queued";
  if (r.status !== 200 || (ack as { status?: string }).status !== expected) fail(`webhook did not record the order as ${expected}: ${r.status} ${JSON.stringify(ack)}`);

  const tampered = await fetch(`${base}/api/stripe-webhook`, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": sig }, body: body.replace("\"paid\"", "\"unpaid\"") });
  step(3, "same signature over a tampered body is rejected", { http: tampered.status, body: await tampered.json() });
  if (tampered.status !== 400) fail("a tampered body was accepted");

  if (deferUrl) {
    const before = await (await fetch(`${base}/api/order-status?session_id=${encodeURIComponent(sessionId)}`)).json() as Record<string, unknown>;
    step(3.5, "pay-first order is parked awaiting the URL (success page shows the URL form)", { status: before.status, target_url: before.target_url, tier_label: before.tier_label, amount_display: before.amount_display });
    if (before.status !== "awaiting_url") fail(`expected awaiting_url, got ${before.status}`);
    const named = await fetch(`${base}/api/order-url`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ session_id: sessionId, url: targetUrl, authorized: true }) });
    const namedBody = await named.json() as Record<string, unknown>;
    step(3.6, "site named through /api/order-url, exactly as the success page form does", { http: named.status, status: namedBody.status, target_url: namedBody.target_url });
    if (named.status !== 200 || namedBody.status !== "queued") fail(`order-url did not queue the order: ${named.status} ${JSON.stringify(namedBody)}`);
    const again = await fetch(`${base}/api/order-url`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ session_id: sessionId, url: "https://example.com", authorized: true }) });
    step(3.7, "a second URL for the same order is refused", { http: again.status });
    if (again.status !== 409) fail("the site URL could be changed after it was set");
  }
  const status = await pollUntilDelivered(sessionId);
  step(4, `audit ran against ${targetUrl} via /api/order-status`, { status: status.status, score: (status.grade as { score?: number } | null)?.score, findings: (status.grade as { findings?: unknown[] } | null)?.findings?.length, pages: (status.grade as { pages_scanned?: number } | null)?.pages_scanned, report_url: status.report_url, page: `${base}/order/success?session_id=${sessionId}` });
  if (status.status !== "delivered") fail(`order ended as ${status.status}: ${status.grade_error ?? status.blocked ?? ""}`);
  await verifyLinks(status);
  console.log(`\nSUCCESS  session ${sessionId}\n         success page: ${base}/order/success?session_id=${sessionId}`);
  log.push(`SUCCESS session ${sessionId}`);
  await writeLog();
}

async function liveMode() {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key.startsWith("sk_test_")) fail("live mode refuses to run without a Stripe TEST key (sk_test_...). Never rehearse on a live key.");
  let sessionId = args.get("session");
  if (!sessionId) {
    const r = await fetch(`${base}/api/checkout`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: targetUrl, email, tier, authorized: true }) });
    const d = (await r.json()) as { ok?: boolean; url?: string; session_id?: string; error?: string };
    step(1, "Checkout Session created through /api/checkout", { http: r.status, session_id: d.session_id, checkout_url: d.url, error: d.error });
    if (!d.ok || !d.session_id) fail(`checkout failed: ${d.error}`);
    sessionId = d.session_id;
    console.log(`\nPay here with 4242 4242 4242 4242, any future date, any CVC:\n${d.url}\n`);
  }
  const status = await pollUntilDelivered(sessionId!);
  step(4, "order status after payment", { status: status.status, score: (status.grade as { score?: number } | null)?.score, report_url: status.report_url });
  if (status.status !== "delivered") fail(`order ended as ${status.status}`);
  await verifyLinks(status);
  console.log(`\nSUCCESS  session ${sessionId}`);
  await writeLog();
}

if (mode === "handler") await handlerMode();
else if (mode === "live") await liveMode();
else fail(`unknown --mode ${mode}`);
