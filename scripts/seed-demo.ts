/**
 * Seed the public /demo report with ONE REAL run of the paid generator against
 * https://fusiondataco.com (Rob Yeager, Fusion Data Company, rob@fusiondataco.com
 * as the example buyer). Persists to Postgres (demo_reports) when POSTGRES_URL is
 * available and always writes the committed snapshot public/demo/fusiondataco.json,
 * which /api/demo serves when the database is absent. Also renders the same PDF
 * the buyer would get and, when BLOB_READ_WRITE_TOKEN exists, uploads it so the
 * demo page can offer the real file.
 *
 *   npm run demo:seed
 */
import fs from "node:fs/promises";
import { loadLocalEnv } from "../runner/blob-store.ts";
import { getSqlClient } from "../src/lib/db.ts";
import { parseTargetUrl } from "../src/lib/instant-grade.ts";
import { runDeepGrade } from "../src/lib/deep-grade.ts";
import { demoReportsSchemaSql } from "../src/lib/storage-contract.ts";
import { renderAuditReportPdf, reportFilename } from "../src/lib/audit-report-pdf.ts";
import { AUDIT_TIERS } from "../src/lib/checkout-input.ts";

loadLocalEnv();
const DEMO_URL = "https://fusiondataco.com";
const BUYER = { name: "Rob Yeager", company: "Fusion Data Company", email: "rob@fusiondataco.com" };
const parsed = parseTargetUrl(DEMO_URL);
if (!parsed.ok) throw new Error(parsed.error);

console.log(`Running the real generator (runDeepGrade) against ${DEMO_URL} ...`);
const started = Date.now();
const grade = await runDeepGrade(parsed.url);
if (!grade.ok) throw new Error(`Generator did not produce a grade: ${grade.error}`);
console.log(`  done in ${((Date.now() - started) / 1000).toFixed(1)}s: score ${grade.score}/100 (${grade.band}), ${grade.findings.length} findings, ${grade.pages_scanned} pages, ${grade.checks_run} check groups, lighthouse ${grade.lighthouse ? "yes" : "no (PAGESPEED_API_KEY unset)"}`);

const id = "demo_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const createdAt = new Date().toISOString();
const info = AUDIT_TIERS.single;
const pdf = renderAuditReportPdf({
  grade,
  order: { id, tier: "single", tierLabel: info.label, amountCents: info.amountCents, email: BUYER.email, targetUrl: DEMO_URL, createdAt, completedAt: createdAt, includes: info.includes, next: info.next, handsOn: false },
  links: { page: "https://80-20.dev/demo", report: "https://80-20.dev/demo/8020-launch-audit-fusiondataco.com.pdf" },
  eyebrow: "80/20 LAUNCH AUDIT  |  SAMPLE REPORT (REAL RUN)",
});
await fs.mkdir("public/demo", { recursive: true });
const pdfFile = `public/demo/${reportFilename("fusiondataco.com")}`;
await fs.writeFile(pdfFile, pdf);
console.log(`  PDF written: ${pdfFile} (${pdf.length} bytes)`);

let pdfUrl: string | null = `https://80-20.dev/demo/${reportFilename("fusiondataco.com")}`;
if (process.env.BLOB_READ_WRITE_TOKEN) {
  try {
    const blob = await import("@vercel/blob");
    const r = await blob.put(`launchaudit/demo/${reportFilename("fusiondataco.com")}`, pdf, { access: "public", addRandomSuffix: true, contentType: "application/pdf", token: process.env.BLOB_READ_WRITE_TOKEN });
    console.log(`  Blob copy: ${r.url}`);
  } catch (e) { console.log(`  Blob upload skipped: ${e instanceof Error ? e.message : String(e)}`); }
}

const report = { id, url: DEMO_URL, tier: "single", grade_json: grade, pdf_url: pdfUrl, buyer_name: BUYER.name, buyer_company: BUYER.company, buyer_email: BUYER.email, created_at: createdAt };
await fs.writeFile("public/demo/fusiondataco.json", JSON.stringify({ seeded: true, generated_by: "scripts/seed-demo.ts", report }, null, 2) + "\n");
console.log("  snapshot written: public/demo/fusiondataco.json");

const sql = await getSqlClient();
if (sql) {
  for (const stmt of demoReportsSchemaSql.split(";").map((s) => s.trim()).filter(Boolean)) await sql(stmt);
  await sql(`insert into demo_reports (id, url, tier, grade_json, pdf_url, buyer_name, buyer_company, buyer_email, created_at) values ($1,$2,'single',$3::jsonb,$4,$5,$6,$7,$8)`,
    [id, DEMO_URL, JSON.stringify(grade), pdfUrl, BUYER.name, BUYER.company, BUYER.email, createdAt]);
  const n = await sql(`select count(*)::int as n from demo_reports where url = $1`, [DEMO_URL]);
  console.log(`  Postgres: inserted ${id}; demo_reports rows for ${DEMO_URL}: ${(n[0] as { n: number }).n}`);
} else {
  console.log("  Postgres: not configured, snapshot only");
}
console.log("Seed complete.");
