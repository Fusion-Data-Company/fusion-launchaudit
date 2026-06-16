import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeWebVitals } from "./web-vitals-audit.ts";

test("healthy vitals pass", () => {
  assert.doesNotThrow(() => summarizeWebVitals({ lcp: 1800, cls: 0.02, fcp: 1200, ttfb: 400 }));
});

test("a poor LCP fails and is reported in seconds", () => {
  assert.throws(() => summarizeWebVitals({ lcp: 5200, cls: 0.02, fcp: 1200, ttfb: 400 }), /LCP 5\.2s/);
});

test("a poor CLS fails", () => {
  assert.throws(() => summarizeWebVitals({ lcp: 1800, cls: 0.4, fcp: 1200, ttfb: 400 }), /CLS/);
});

test("borderline (needs-improvement) values do NOT fail — only the poor range does", () => {
  // LCP 3.2s and CLS 0.15 are 'needs improvement', below the poor boundary.
  assert.doesNotThrow(() => summarizeWebVitals({ lcp: 3200, cls: 0.15, fcp: 2500, ttfb: 1500 }));
});
