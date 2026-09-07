import { test } from "node:test";
import assert from "node:assert/strict";
import { internalLinks, PAGE_BUDGET } from "./deep-grade.ts";

test("internalLinks keeps same-origin page links only, deduped, no fragments", () => {
  const base = new URL("https://example.com/");
  const html = `
    <a href="/pricing">a</a> <a href="/pricing#top">b</a> <a href="https://example.com/about">c</a>
    <a href="https://other.com/x">d</a> <a href="mailto:hi@example.com">e</a> <a href="/logo.png">f</a>
    <a href='/docs/'>g</a> <a href="#">h</a> <a href="javascript:void(0)">i</a>`;
  assert.deepEqual(internalLinks(html, base), [
    "https://example.com/pricing",
    "https://example.com/about",
    "https://example.com/docs/",
  ]);
});

test("internalLinks honours the max", () => {
  const html = Array.from({ length: 30 }, (_, i) => `<a href="/p${i}">x</a>`).join("");
  assert.equal(internalLinks(html, new URL("https://example.com"), 5).length, 5);
  assert.ok(PAGE_BUDGET >= 5);
});
