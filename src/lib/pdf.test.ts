import { test } from "node:test";
import assert from "node:assert/strict";
import { PdfDoc, measureText, wrapText, pdfString } from "./pdf.ts";
import type { TableColumn } from "./pdf.ts";

const LONG =
  "The launch audit crawls every public route, scores it against the rulepack, and writes findings with a severity, " +
  "an evidence excerpt, and a fix plan. This paragraph exists to force word wrapping across several lines so the " +
  "layout engine has to break text, keep the left edge aligned, and never draw past the right margin of the page. " +
  "It repeats the same idea a few times to get long enough for the test to be meaningful without being clever.";

const COLUMNS: TableColumn[] = [
  { header: "Route", width: 150 },
  { header: "Severity", width: 70 },
  { header: "Finding", width: 214 },
  { header: "Score", width: 70, align: "right" },
];

export function buildSampleDoc(): PdfDoc {
  const doc = new PdfDoc({ title: "Sample Launch Audit" });
  doc.heading("Launch Audit Report", 1);
  doc.text("Prepared for example.com on 2026-09-14. Overall grade: B.", { size: 10, color: [0.3, 0.3, 0.35] });
  doc.rule();
  doc.heading("Summary", 2);
  doc.text(LONG);
  doc.space(8);
  doc.text(LONG, { size: 11, font: "Helvetica-Oblique", lineHeight: 15 });
  doc.heading("Findings by route", 2);
  doc.text("CRITICAL", { font: "Helvetica-Bold", color: [0.8, 0.1, 0.1] });
  doc.text("Warning", { font: "Helvetica-Bold", color: [0.85, 0.55, 0.05] });
  doc.heading("Full table (40 rows)", 3);
  const rows: string[][] = [];
  for (let i = 0; i < 40; i++) {
    const sev = ["critical", "high", "medium", "low"][i % 4];
    rows.push([
      `/products/category-${i}/detail-page-with-a-long-slug`,
      sev,
      i % 5 === 0
        ? "Missing canonical tag; duplicate content risk across paginated listings and filtered views (wraps to multiple lines)."
        : `Finding number ${i} on this route (short).`,
      String(100 - i),
    ]);
  }
  doc.table(COLUMNS, rows, { fontSize: 9, headerFill: [0.12, 0.12, 0.15], zebra: true });
  doc.keepTogether(() => {
    doc.heading("Closing notes", 2);
    doc.text("Parentheses (like these), a backslash \\ and a curly quote ’ all survive encoding.", { font: "Courier", size: 9 });
  });
  doc.pageNumbers("80/20 Launch Audit");
  return doc;
}

test("sample doc serializes to a PDF 1.4 file with header and EOF marker", () => {
  const buf = buildSampleDoc().toBuffer();
  assert.ok(Buffer.isBuffer(buf));
  assert.equal(buf.subarray(0, 8).toString("latin1"), "%PDF-1.4");
  assert.ok(buf.toString("latin1").endsWith("%%EOF"));
  assert.ok(buf.toString("latin1").includes("/Producer (80/20 Launch Audit)"));
  assert.ok(buf.toString("latin1").includes("/Title (Sample Launch Audit)"));
});

test("every xref offset points exactly at 'N 0 obj' for object N", () => {
  const buf = buildSampleDoc().toBuffer();
  const s = buf.toString("latin1");
  const m = /startxref\n(\d+)\n%%EOF$/.exec(s);
  assert.ok(m, "startxref line present");
  const xrefAt = Number(m[1]);
  assert.equal(buf.subarray(xrefAt, xrefAt + 4).toString("latin1"), "xref");
  const head = /^xref\n0 (\d+)\n/.exec(s.slice(xrefAt));
  assert.ok(head, "xref subsection header present");
  const count = Number(head[1]);
  const tableStart = xrefAt + head[0].length;
  assert.ok(count > 10);
  for (let n = 0; n < count; n++) {
    const entry = buf.subarray(tableStart + n * 20, tableStart + (n + 1) * 20).toString("latin1");
    assert.equal(entry.length, 20);
    const offset = Number(entry.slice(0, 10));
    const kind = entry[17];
    if (n === 0) { assert.equal(kind, "f"); continue; }
    assert.equal(kind, "n");
    const expect = `${n} 0 obj`;
    assert.equal(buf.subarray(offset, offset + expect.length).toString("latin1"), expect, `object ${n} offset`);
  }
  const trailer = /\/Size (\d+)/.exec(s.slice(xrefAt));
  assert.ok(trailer);
  assert.equal(Number(trailer[1]), count);
});

test("40-row table forces at least two pages and repeats the header row", () => {
  const doc = buildSampleDoc();
  assert.ok(doc.pageCount() >= 2, `expected >= 2 pages, got ${doc.pageCount()}`);
  const s = doc.toBuffer().toString("latin1");
  const headerHits = s.match(/\(Severity\) Tj/g) ?? [];
  assert.ok(headerHits.length >= 2, `header should repeat, saw ${headerHits.length}`);
  const pageLabels = s.match(/Page \d+ of \d+/g) ?? [];
  assert.equal(pageLabels.length, doc.pageCount());
  assert.ok(pageLabels.every((l) => l.endsWith(`of ${doc.pageCount()}`)));
  assert.equal((s.match(/\/Type \/Page\b/g) ?? []).length, doc.pageCount());
});

test("string escaping handles parentheses, backslashes, and non-WinAnsi characters", () => {
  assert.equal(pdfString("a(b)c\\d"), "a\\(b\\)c\\\\d");
  assert.equal(pdfString("café"), "café");
  assert.equal(pdfString("x’y"), "x\x92y");
  assert.equal(pdfString("中"), "?");
  assert.equal(pdfString("\u{1F600}"), "?");
  const doc = new PdfDoc();
  doc.text("see (this) and \\that\\");
  assert.ok(doc.toBuffer().toString("latin1").includes("(see \\(this\\) and \\\\that\\\\) Tj"));
});

test("wrapping never produces a line wider than the column", () => {
  const cases: Array<[string, number]> = [
    [LONG, 214 - 8],
    [LONG, 60],
    ["Supercalifragilisticexpialidocious-and-then-some-more-characters", 40],
    ["short", 500],
    ["a b c d e f g h i j k l m n o p", 12],
  ];
  for (const font of ["Helvetica", "Helvetica-Bold", "Courier"] as const) {
    for (const [text, width] of cases) {
      const lines = wrapText(text, font, 9, width);
      assert.ok(lines.length >= 1);
      assert.equal(lines.join(" ").replace(/\s+/g, ""), text.replace(/\s+/g, ""), "no characters lost");
      for (const line of lines) {
        const w = measureText(line, font, 9);
        const singleGlyph = line.length === 1;
        assert.ok(w <= width || singleGlyph, `"${line}" is ${w.toFixed(2)} > ${width} in ${font}`);
      }
    }
  }
  assert.equal(measureText("Hello", "Helvetica", 10), (722 + 556 + 222 + 222 + 556) / 100);
  assert.equal(measureText("abc", "Courier", 10), 18);
});
