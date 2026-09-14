import { test } from "node:test";
import assert from "node:assert/strict";
import { renderAuditReportPdf, reportFilename } from "./audit-report-pdf.ts";

const grade = {
  ok: true as const, kind: "deep" as const, url: "https://fusiondataco.com", score: 71, band: "yellow" as const, passed: 28,
  summary: "Audited 6 pages on fusiondataco.com: 4 issues (1 critical/high).",
  note: "Single Run: a site-wide, URL-only audit.",
  pages_scanned: 6, pages: ["https://fusiondataco.com", "https://fusiondataco.com/about"], checks_run: 33,
  lighthouse: { performance: 82, accessibility: 95, best_practices: 100, seo: 92, lcp_ms: 3600, cls: 0.04, inp_ms: null, source: "lab" as const },
  findings: [
    { title: "Missing Content-Security-Policy", severity: "high" as const, category: "Security headers", detail: "No CSP header on any page. (Parentheses) and \\backslashes are fine.", fix: "Add to vercel.json headers:\n  { \"key\": \"Content-Security-Policy\", \"value\": \"default-src 'self'\" }" },
    { title: "Images without alt text", severity: "low" as const, category: "Accessibility", detail: "3 images on /about have no alt attribute." },
    { title: "Placeholder copy shipped", severity: "medium" as const, category: "Content", detail: "Lorem ipsum found on /pricing.", fix: "Replace the lorem ipsum block in app/pricing/page.tsx." },
  ],
};
const order = { id: "pa_test1", tier: "single", tierLabel: "Single Run", amountCents: 7900, email: "rob@fusiondataco.com", targetUrl: "https://fusiondataco.com", createdAt: "2026-09-14T08:00:00Z", completedAt: "2026-09-14T08:01:00Z", includes: "Automated site-wide URL audit.", next: "Nothing you need to do.", handsOn: false };

test("renderAuditReportPdf produces a valid multi-section PDF with the score, findings and fixes", () => {
  const pdf = renderAuditReportPdf({ grade, order, links: { page: "https://80-20.dev/order/success?session_id=cs_x", report: "https://80-20.dev/api/order-report?session_id=cs_x" } });
  const s = pdf.toString("latin1");
  assert.ok(s.startsWith("%PDF-1.4"));
  assert.ok(s.trimEnd().endsWith("%%EOF"));
  for (const needle of ["fusiondataco.com", "(71)", "Needs work", "Missing Content-Security-Policy", "Paste-ready fixes", "Lighthouse and Core Web Vitals", "What happens next", "Order pa_test1"]) {
    assert.ok(s.includes(needle), `expected PDF text to include ${needle}`);
  }
  assert.ok(pdf.length > 4000);
});

test("a clean grade renders the honest empty state, and the filename is safe", () => {
  const pdf = renderAuditReportPdf({ grade: { ...grade, findings: [], score: 100, band: "green", lighthouse: null }, order, links: { page: "p", report: "r" } });
  assert.ok(pdf.toString("latin1").includes("Nothing to fix at the URL level"));
  assert.equal(reportFilename("www.Example.com:8443"), "8020-launch-audit-www.example.com-8443.pdf");
});
