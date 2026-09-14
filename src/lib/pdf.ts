/**
 * pdf.ts - a dependency-free PDF 1.4 writer for audit reports.
 *
 * What it does:
 *   - Letter pages (612 x 792 pt), configurable margins (default 54 pt).
 *   - Standard Type1 fonts only, no embedding: Helvetica, Helvetica-Bold,
 *     Helvetica-Oblique, Courier, Courier-Bold (WinAnsiEncoding).
 *   - Word-wrapped text with automatic page breaks, headings, spacing, rules,
 *     rectangles, tables with wrapped cells and a header row that repeats after
 *     every page break, best-effort keepTogether, and "footer | Page N of M".
 *   - Accurate wrapping: real Helvetica and Helvetica-Bold AFM widths for the
 *     printable ASCII range (32..126). Anything outside that range measures as
 *     500/1000 em (Courier is always 600).
 *   - Correct xref table: byte offsets are computed from the actual encoded
 *     length of every object, not from JS string lengths.
 *
 * What it does not do:
 *   - No Unicode beyond WinAnsi. Text is encoded as latin1; a few common
 *     punctuation code points (curly quotes, bullet, dashes, ellipsis, euro) are
 *     mapped to their WinAnsi bytes, everything else outside latin1 becomes "?".
 *   - No images, links, bookmarks, compression, or justified alignment.
 *   - Coordinates for rect() are top-left origin (y grows downward), matching
 *     the cursor model used everywhere else in this file. The conversion to
 *     PDF's bottom-left origin happens once, at emit time.
 */

import { Buffer } from "node:buffer";

export type RGB = [number, number, number];
export type FontName = "Helvetica" | "Helvetica-Bold" | "Helvetica-Oblique" | "Courier" | "Courier-Bold";
export type Align = "left" | "right";

export interface TextOptions {
  size?: number;
  font?: FontName;
  color?: RGB;
  x?: number;
  width?: number;
  lineHeight?: number;
  align?: Align;
}

export interface TableColumn {
  header: string;
  width: number;
  align?: Align;
}

export interface TableOptions {
  fontSize?: number;
  headerFill?: RGB;
  zebra?: boolean;
  x?: number;
}

export interface RectOptions {
  fill?: RGB;
  stroke?: RGB;
  lineWidth?: number;
}

export interface PdfDocOptions {
  title?: string;
  margin?: number;
}

export const PAGE_WIDTH = 612;
export const PAGE_HEIGHT = 792;

// Helvetica AFM advance widths for code points 32..126, in 1/1000 em.
const HELVETICA_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

// Helvetica-Bold AFM advance widths for code points 32..126, in 1/1000 em.
const HELVETICA_BOLD_WIDTHS = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

const FONT_RESOURCE: Record<FontName, string> = {
  "Helvetica": "F1",
  "Helvetica-Bold": "F2",
  "Helvetica-Oblique": "F3",
  "Courier": "F4",
  "Courier-Bold": "F5",
};
const FONT_ORDER: FontName[] = ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Courier", "Courier-Bold"];

// Unicode punctuation that WinAnsi can represent even though latin1 cannot.
const WINANSI_EXTRA: Record<number, number> = {
  0x20ac: 0x80, 0x2026: 0x85, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
  0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x2122: 0x99,
};

/** Width of a single character in 1/1000 em for the given font. */
function glyphWidth(code: number, font: FontName): number {
  if (font === "Courier" || font === "Courier-Bold") return 600;
  if (code < 32 || code > 126) return 500;
  return font === "Helvetica-Bold" ? HELVETICA_BOLD_WIDTHS[code - 32] : HELVETICA_WIDTHS[code - 32];
}

/** Measure a string in points. Exported so tests can check wrapping against it. */
export function measureText(str: string, font: FontName, size: number): number {
  let total = 0;
  for (let i = 0; i < str.length; i++) total += glyphWidth(str.charCodeAt(i), font);
  return (total / 1000) * size;
}

/** Greedy word wrap. Words wider than the column are broken by character. */
export function wrapText(str: string, font: FontName, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const para of str.replace(/\t/g, "    ").split("\n")) {
    const words = para.split(" ").filter((w) => w.length > 0);
    if (words.length === 0) { lines.push(""); continue; }
    let line = "";
    const push = (w: string) => {
      const candidate = line ? `${line} ${w}` : w;
      if (measureText(candidate, font, size) <= width) { line = candidate; return; }
      if (line) lines.push(line);
      line = "";
      if (measureText(w, font, size) <= width) { line = w; return; }
      for (const ch of w) {
        if (measureText(line + ch, font, size) <= width || line === "") line += ch;
        else { lines.push(line); line = ch; }
      }
    };
    for (const w of words) push(w);
    lines.push(line);
  }
  return lines;
}

/** Encode to WinAnsi bytes (as a latin1 JS string) and escape for a PDF literal. */
export function pdfString(str: string): string {
  let out = "";
  for (const ch of str) {
    const cp = ch.codePointAt(0) ?? 63;
    let code: number;
    if (cp < 128) code = cp;
    else if (cp >= 160 && cp <= 255) code = cp;
    else code = WINANSI_EXTRA[cp] ?? 63;
    const c = String.fromCharCode(code);
    if (c === "(" || c === ")" || c === "\\") out += "\\" + c;
    else if (code === 13) out += "\\r";
    else if (code === 10) out += "\\n";
    else out += c;
  }
  return out;
}

const num = (n: number): string => {
  const s = n.toFixed(3);
  return s.replace(/\.?0+$/, "") || "0";
};
const rgb = (c: RGB): string => `${num(c[0])} ${num(c[1])} ${num(c[2])}`;

interface Snapshot { pageIndex: number; opsLen: number; y: number }

export class PdfDoc {
  readonly margin: number;
  private readonly title: string;
  private pages: string[][] = [];
  /** Cursor: distance from the page top to the top of the next line box. */
  private y = 0;
  private footer: string | null = null;

  constructor(opts: PdfDocOptions = {}) {
    this.margin = opts.margin ?? 54;
    this.title = opts.title ?? "Launch Audit Report";
    this.newPage();
  }

  get contentWidth(): number { return PAGE_WIDTH - this.margin * 2; }
  get cursorY(): number { return this.y; }
  pageCount(): number { return this.pages.length; }

  newPage(): void {
    this.pages.push([]);
    this.y = this.margin;
  }

  private ops(): string[] { return this.pages[this.pages.length - 1]; }
  private bottom(): number { return PAGE_HEIGHT - this.margin; }
  private ensure(height: number): void {
    if (this.y + height > this.bottom() && this.y > this.margin) this.newPage();
  }

  /** Emit one already-wrapped line. yTop is top-left origin. */
  private drawLine(line: string, x: number, yTop: number, font: FontName, size: number, color: RGB, width: number, align: Align): void {
    if (line.length === 0) return;
    let x0 = x;
    if (align === "right") x0 = x + width - measureText(line, font, size);
    const baseline = PAGE_HEIGHT - (yTop + size * 0.85);
    this.ops().push(`BT /${FONT_RESOURCE[font]} ${num(size)} Tf ${rgb(color)} rg ${num(x0)} ${num(baseline)} Td (${pdfString(line)}) Tj ET`);
  }

  /** Wrapped paragraph with automatic page breaks. */
  text(str: string, opts: TextOptions = {}): void {
    const size = opts.size ?? 10;
    const font = opts.font ?? "Helvetica";
    const color = opts.color ?? [0, 0, 0];
    const x = opts.x ?? this.margin;
    const width = opts.width ?? PAGE_WIDTH - this.margin - x;
    const lineHeight = opts.lineHeight ?? size * 1.35;
    const align = opts.align ?? "left";
    for (const line of wrapText(str, font, size, width)) {
      this.ensure(lineHeight);
      this.drawLine(line, x, this.y, font, size, color, width, align);
      this.y += lineHeight;
    }
  }

  heading(str: string, level: 1 | 2 | 3 = 1): void {
    const size = level === 1 ? 20 : level === 2 ? 14 : 11;
    const before = level === 1 ? 14 : level === 2 ? 10 : 8;
    const after = level === 1 ? 6 : level === 2 ? 5 : 4;
    const color: RGB = level === 1 ? [0.08, 0.08, 0.1] : [0.15, 0.15, 0.18];
    this.keepTogether(() => {
      this.space(before);
      this.text(str, { size, font: "Helvetica-Bold", color, lineHeight: size * 1.25 });
      this.space(after);
    });
  }

  /** Vertical gap. Never pushes the cursor past the bottom margin. */
  space(pt: number): void {
    this.y = Math.min(this.y + pt, this.bottom());
  }

  rule(color: RGB = [0.8, 0.8, 0.82], lineWidth = 0.5): void {
    this.ensure(6);
    const yPdf = PAGE_HEIGHT - (this.y + 3);
    this.ops().push(`${rgb(color)} RG ${num(lineWidth)} w ${num(this.margin)} ${num(yPdf)} m ${num(PAGE_WIDTH - this.margin)} ${num(yPdf)} l S`);
    this.y += 6;
  }

  /** Rectangle at top-left origin (x, y), on the current page. Does not move the cursor. */
  rect(x: number, y: number, w: number, h: number, opts: RectOptions = {}): void {
    const yPdf = PAGE_HEIGHT - y - h;
    const parts: string[] = [];
    if (opts.fill) parts.push(`${rgb(opts.fill)} rg`);
    if (opts.stroke) parts.push(`${rgb(opts.stroke)} RG ${num(opts.lineWidth ?? 0.5)} w`);
    const op = opts.fill && opts.stroke ? "B" : opts.stroke ? "S" : "f";
    if (!opts.fill && !opts.stroke) return;
    parts.push(`${num(x)} ${num(yPdf)} ${num(w)} ${num(h)} re ${op}`);
    this.ops().push(parts.join(" "));
  }

  /**
   * Table with wrapped cells. The header row is redrawn at the top of every
   * page the table spills onto. Cell text is clipped to the column by wrapping.
   */
  table(columns: TableColumn[], rows: string[][], opts: TableOptions = {}): void {
    const size = opts.fontSize ?? 9;
    const lh = size * 1.3;
    const pad = 4;
    const x0 = opts.x ?? this.margin;
    const headerFill = opts.headerFill ?? [0.12, 0.12, 0.15];
    const headerLum = 0.2126 * headerFill[0] + 0.7152 * headerFill[1] + 0.0722 * headerFill[2];
    const headerText: RGB = headerLum < 0.5 ? [1, 1, 1] : [0.05, 0.05, 0.05];
    const totalWidth = columns.reduce((s, c) => s + c.width, 0);

    const wrapRow = (cells: string[], font: FontName) =>
      columns.map((c, i) => wrapText(cells[i] ?? "", font, size, Math.max(1, c.width - pad * 2)));
    const rowHeight = (lines: string[][]) => Math.max(1, ...lines.map((l) => l.length)) * lh + pad * 2;

    const drawRow = (lines: string[][], font: FontName, color: RGB, fill: RGB | null): void => {
      const h = rowHeight(lines);
      if (fill) this.rect(x0, this.y, totalWidth, h, { fill });
      let cx = x0;
      columns.forEach((c, i) => {
        lines[i].forEach((line, li) => {
          this.drawLine(line, cx + pad, this.y + pad + li * lh, font, size, color, c.width - pad * 2, c.align ?? "left");
        });
        cx += c.width;
      });
      this.y += h;
      const yPdf = PAGE_HEIGHT - this.y;
      this.ops().push(`0.85 0.85 0.87 RG 0.4 w ${num(x0)} ${num(yPdf)} m ${num(x0 + totalWidth)} ${num(yPdf)} l S`);
    };

    const headerLines = wrapRow(columns.map((c) => c.header), "Helvetica-Bold");
    const drawHeader = () => drawRow(headerLines, "Helvetica-Bold", headerText, headerFill);

    this.ensure(rowHeight(headerLines) + lh * 2);
    drawHeader();
    rows.forEach((row, ri) => {
      const lines = wrapRow(row, "Helvetica");
      const h = rowHeight(lines);
      if (this.y + h > this.bottom()) {
        this.newPage();
        drawHeader();
      }
      const fill: RGB | null = opts.zebra && ri % 2 === 1 ? [0.95, 0.95, 0.96] : null;
      drawRow(lines, "Helvetica", [0.1, 0.1, 0.12], fill);
    });
    this.y += 4;
  }

  /**
   * Best effort: run fn; if it caused a page break and did not start at the
   * top of a page, roll back, start a fresh page, and run it again.
   */
  keepTogether(fn: () => void): void {
    const snap: Snapshot = { pageIndex: this.pages.length, opsLen: this.ops().length, y: this.y };
    fn();
    if (this.pages.length > snap.pageIndex && snap.y > this.margin) {
      this.pages.length = snap.pageIndex;
      this.ops().length = snap.opsLen;
      this.y = snap.y;
      this.newPage();
      fn();
    }
  }

  /** Render "footerText  |  Page N of M" on every page when the document is serialized. */
  pageNumbers(footerText: string): void {
    this.footer = footerText;
  }

  private footerOps(pageIndex: number): string {
    if (this.footer === null) return "";
    const label = `${this.footer}  |  Page ${pageIndex + 1} of ${this.pages.length}`;
    const size = 8;
    const w = measureText(label, "Helvetica", size);
    const x = PAGE_WIDTH - this.margin - w;
    const y = this.margin - 20;
    return `BT /F1 ${num(size)} Tf 0.45 0.45 0.5 rg ${num(x)} ${num(y)} Td (${pdfString(label)}) Tj ET`;
  }

  /** Serialize to a complete PDF 1.4 file with a byte-accurate xref table. */
  toBuffer(): Buffer {
    const chunks: Buffer[] = [];
    const offsets: number[] = [];
    let position = 0;
    const write = (s: string | Buffer): void => {
      const b = typeof s === "string" ? Buffer.from(s, "latin1") : s;
      chunks.push(b);
      position += b.length;
    };
    const obj = (n: number, body: string | Buffer): void => {
      offsets[n] = position;
      write(`${n} 0 obj\n`);
      write(body);
      write("\nendobj\n");
    };

    const fontCount = FONT_ORDER.length;
    const firstFontObj = 4;
    const firstPageObj = firstFontObj + fontCount;
    const pageObjIds = this.pages.map((_, i) => firstPageObj + i * 2);
    const total = firstPageObj + this.pages.length * 2 - 1;

    write("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
    obj(2, `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${this.pages.length} >>`);
    const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    obj(3, `<< /Producer (80/20 Launch Audit) /Title (${pdfString(this.title)}) /CreationDate (D:${stamp}Z) >>`);
    FONT_ORDER.forEach((name, i) => {
      obj(firstFontObj + i, `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`);
    });
    const fontDict = FONT_ORDER.map((name, i) => `/${FONT_RESOURCE[name]} ${firstFontObj + i} 0 R`).join(" ");

    this.pages.forEach((ops, i) => {
      const pageId = pageObjIds[i];
      const contentId = pageId + 1;
      const stream = Buffer.from([...ops, this.footerOps(i)].filter((s) => s.length > 0).join("\n"), "latin1");
      obj(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << ${fontDict} >> >> /Contents ${contentId} 0 R >>`);
      obj(contentId, Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, "latin1"), stream, Buffer.from("\nendstream", "latin1")]));
    });

    const xrefOffset = position;
    write(`xref\n0 ${total + 1}\n`);
    write("0000000000 65535 f \n");
    for (let n = 1; n <= total; n++) write(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
    write(`trailer\n<< /Size ${total + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
    return Buffer.concat(chunks);
  }
}
