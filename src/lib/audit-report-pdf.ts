/**
 * The PDF report for a paid audit: the same numbers the success page renders,
 * laid out for a buyer to file, forward or print. Built on src/lib/pdf.ts
 * (dependency-free), so it runs inside a Vercel function with no Chromium.
 *
 * Layout: cover block (score, band, target, order line) -> what this audit
 * covers -> findings table worst first -> the fix for every finding that has
 * one -> Lighthouse strip when present -> what happens next -> where the
 * report lives. Plain hyphens, straight quotes.
 */
import { PdfDoc, type RGB } from "./pdf.ts";
import type { DeepGrade } from "./deep-grade.ts";
import type { Finding, InstantGrade } from "./instant-grade.ts";
import { formatUsd } from "./checkout-input.ts";

export type ReportOrder = {
  id: string;
  tier: string;
  tierLabel: string;
  amountCents: number;
  email: string;
  targetUrl: string;
  createdAt: string;
  completedAt: string | null;
  includes: string;
  next: string;
  handsOn: boolean;
};

export type ReportInput = {
  grade: (InstantGrade | DeepGrade) & { ok: true };
  order: ReportOrder;
  links: { page: string; report: string };
  /** Overrides the cover eyebrow, e.g. "Sample report" for /demo. */
  eyebrow?: string;
};

const INK: RGB = [0.08, 0.08, 0.1];
const MUTED: RGB = [0.38, 0.39, 0.44];
const RULE: RGB = [0.82, 0.83, 0.86];
const BAND: Record<string, RGB> = { green: [0.09, 0.55, 0.32], yellow: [0.72, 0.5, 0.05], red: [0.75, 0.16, 0.2] };
const BAND_LABEL: Record<string, string> = { green: "Launch ready", yellow: "Needs work", red: "Not ready" };
const SEV_COLOR: Record<string, RGB> = { critical: [0.75, 0.12, 0.18], high: [0.8, 0.3, 0.1], medium: [0.65, 0.45, 0.05], low: [0.2, 0.4, 0.65] };
const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function hostOf(url: string): string { try { return new URL(url).host; } catch { return url; } }
function safeName(s: string): string { return s.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "site"; }
export function reportFilename(host: string): string { return `8020-launch-audit-${safeName(host)}.pdf`; }

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

function sorted(findings: Finding[]): Finding[] {
  return findings.slice().sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9));
}

export function renderAuditReportPdf(input: ReportInput): Buffer {
  const { grade, order, links } = input;
  const host = hostOf(grade.url);
  const doc = new PdfDoc({ title: `80/20 Launch Audit - ${host}`, margin: 50 });
  const W = doc.contentWidth;
  const findings = sorted(grade.findings);
  const counts = { critical: 0, high: 0, medium: 0, low: 0 } as Record<string, number>;
  for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  const deep = "kind" in grade && grade.kind === "deep" ? grade : null;

  // ---- cover block -------------------------------------------------------
  doc.text(input.eyebrow ?? "80/20 LAUNCH AUDIT  |  HOSTED REPORT", { size: 9, font: "Helvetica-Bold", color: MUTED, lineHeight: 12 });
  doc.space(6);
  doc.text(host, { size: 24, font: "Helvetica-Bold", color: INK, lineHeight: 28 });
  doc.text(grade.url, { size: 10, font: "Courier", color: MUTED, lineHeight: 14 });
  doc.space(10);

  // score box
  const boxTop = doc.cursorY;
  const boxH = 92;
  doc.rect(doc.margin, boxTop, W, boxH, { fill: [0.965, 0.965, 0.975], stroke: RULE, lineWidth: 0.6 });
  const bandColor = BAND[grade.band] ?? INK;
  doc.rect(doc.margin, boxTop, 6, boxH, { fill: bandColor });
  // text inside the box: score on the left, meta on the right
  const scoreX = doc.margin + 22;
  const metaX = doc.margin + 170;
  const saveY = doc.cursorY;
  // score
  doc.space(14);
  doc.text(`${grade.score}`, { size: 44, font: "Helvetica-Bold", color: bandColor, x: scoreX, width: 130, lineHeight: 44 });
  doc.text(`/ 100  ${BAND_LABEL[grade.band] ?? grade.band}`, { size: 10, font: "Helvetica-Bold", color: bandColor, x: scoreX, width: 140, lineHeight: 14 });
  // reset cursor to top of box and write meta column
  (doc as unknown as { y: number }).y = saveY + 14;
  const metaW = W - (metaX - doc.margin) - 14;
  const metaLines = [
    `${order.tierLabel}  |  ${formatUsd(order.amountCents)}  |  Order ${order.id}`,
    `Paid ${fmtDate(order.createdAt)}${order.completedAt ? `  |  Audited ${fmtDate(order.completedAt)}` : ""}`,
    deep ? `${deep.pages_scanned} page${deep.pages_scanned === 1 ? "" : "s"} scanned  |  ${deep.checks_run} check groups  |  ${grade.passed} passed` : `${grade.passed} checks passed`,
    `Findings: ${findings.length}  (${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low)`,
  ];
  for (const line of metaLines) doc.text(line, { size: 9.5, font: "Helvetica", color: INK, x: metaX, width: metaW, lineHeight: 15 });
  (doc as unknown as { y: number }).y = boxTop + boxH + 14;

  doc.text(grade.summary, { size: 11, font: "Helvetica", color: INK, lineHeight: 15 });
  doc.space(6);

  // ---- what this audit covers ------------------------------------------
  doc.heading("What this audit covers", 2);
  doc.text(order.includes, { size: 9.5, color: INK, lineHeight: 13.5 });
  doc.space(2);
  doc.text(grade.note, { size: 9, color: MUTED, lineHeight: 12.5 });
  if (deep && deep.pages.length) {
    doc.space(4);
    doc.text("Pages audited: " + deep.pages.join("   "), { size: 8.5, font: "Courier", color: MUTED, lineHeight: 11.5 });
  }
  doc.space(8);

  // ---- findings table ----------------------------------------------------
  doc.heading(findings.length ? `Findings, worst first (${findings.length})` : "Findings", 2);
  if (!findings.length) {
    doc.text("Nothing to fix at the URL level. Every check that can be answered from outside the app came back clean. That is the honest limit of a URL-only audit: it says nothing yet about broken access control, your admin API, or what your server hands a stranger who asks directly.", { size: 10, color: INK, lineHeight: 14 });
  } else {
    const rows = findings.map((f) => [f.severity.toUpperCase(), f.category || "", `${f.title}\n${f.detail}`]);
    doc.table(
      [{ header: "Severity", width: 62 }, { header: "Category", width: 96 }, { header: "What we found, and why it costs you", width: W - 62 - 96 }],
      rows,
      { fontSize: 8.5, headerFill: [0.12, 0.12, 0.16], zebra: true },
    );
  }

  // ---- fixes ------------------------------------------------------------
  const withFix = findings.filter((f) => f.fix && f.fix.trim());
  if (withFix.length) {
    doc.space(10);
    doc.heading("Paste-ready fixes", 2);
    doc.text("Each block below is written for a coding agent (Claude Code, Cursor, Codex). Paste it as-is; it names the file, the change and how to verify it.", { size: 9.5, color: MUTED, lineHeight: 13 });
    doc.space(4);
    withFix.forEach((f, i) => {
      doc.keepTogether(() => {
        doc.space(6);
        doc.text(`${i + 1}. ${f.title}`, { size: 10, font: "Helvetica-Bold", color: SEV_COLOR[f.severity] ?? INK, lineHeight: 13 });
        doc.text(`${f.severity.toUpperCase()}  |  ${f.category}`, { size: 8, font: "Helvetica", color: MUTED, lineHeight: 11 });
      });
      doc.text(f.fix!.replace(/\t/g, "  "), { size: 8, font: "Courier", color: INK, lineHeight: 10.5 });
    });
  }

  // ---- lighthouse -------------------------------------------------------
  const lh = deep?.lighthouse;
  if (lh && (lh.performance != null || lh.accessibility != null || lh.seo != null)) {
    doc.space(10);
    doc.heading("Lighthouse and Core Web Vitals", 2);
    const v = (n: number | null) => (n == null ? "-" : String(n));
    doc.table(
      [{ header: "Performance", width: W / 6, align: "right" }, { header: "Accessibility", width: W / 6, align: "right" }, { header: "Best practices", width: W / 6, align: "right" }, { header: "SEO", width: W / 6, align: "right" }, { header: "LCP", width: W / 6, align: "right" }, { header: "CLS", width: W / 6, align: "right" }],
      [[v(lh.performance), v(lh.accessibility), v(lh.best_practices), v(lh.seo), lh.lcp_ms == null ? "-" : `${(lh.lcp_ms / 1000).toFixed(1)}s`, lh.cls == null ? "-" : lh.cls.toFixed(2)]],
      { fontSize: 9, headerFill: [0.12, 0.12, 0.16] },
    );
    doc.text(`Source: ${lh.source === "field" ? "field data (real users)" : lh.source === "lab" ? "lab run" : "none"}.`, { size: 8.5, color: MUTED, lineHeight: 12 });
  }

  // ---- next + where it lives ------------------------------------------
  doc.space(12);
  doc.heading("What happens next", 2);
  doc.text(order.next, { size: 9.5, color: INK, lineHeight: 13.5 });
  doc.space(8);
  doc.heading("Where this report lives", 2);
  doc.text("Order page (re-renders the report any time):", { size: 9, color: MUTED, lineHeight: 12 });
  doc.text(links.page, { size: 8.5, font: "Courier", color: INK, lineHeight: 11.5 });
  doc.text("This PDF:", { size: 9, color: MUTED, lineHeight: 12 });
  doc.text(links.report, { size: 8.5, font: "Courier", color: INK, lineHeight: 11.5 });
  doc.space(6);
  doc.text(`Prepared for ${order.email} by Fusion Data Company. Questions: rob@fusiondataco.com. Refund policy: https://80-20.dev/refunds`, { size: 8.5, color: MUTED, lineHeight: 12 });

  doc.pageNumbers(`80/20 Launch Audit  |  ${host}  |  Order ${order.id}`);
  return doc.toBuffer();
}
