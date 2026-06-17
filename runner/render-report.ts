/**
 * Self-contained HTML report — no server, no backend. Writes a single .html
 * file the customer can open or hand to a client. Used by standalone audits
 * that run entirely inside the customer's own Claude Code.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { buildSeoRanking } from "../src/lib/report/seo-report.ts";

export type ReportCard = {
  id: string;
  title: string;
  category: string;
  status: string;
  risk: string;
  plainTitle?: string;
  plainDetail?: string;
  acceptanceCriteria?: string;
  /** Evidence links — local relative paths (e.g. evidence/TC-1.png) or presigned blob URLs. */
  evidence?: Array<{ label: string; href: string }>;
};

export type ReportData = {
  name: string;
  appUrl: string;
  readiness: number;
  passed: number;
  failed: number;
  blocked: number;
  cards: ReportCard[];
  findings: Array<{ title: string; summary: string; severity: string }>;
  generatedAt: string;
};

const esc = (v: unknown) =>
  String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export async function renderReport(data: ReportData, outDir: string): Promise<string> {
  const total = data.passed + data.failed + data.blocked;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const stamp = data.generatedAt.replace(/[:.]/g, "-").slice(0, 19);

  const rows = data.cards
    .map((c) => {
      const cls = c.status === "passed" ? "p" : c.status === "failed" ? "f" : "w";
      const mark = c.status === "passed" ? "✓" : c.status === "failed" ? "✕" : "!";
      const evidence = (c.evidence ?? [])
        .map((e) => `<a class="ev" href="${esc(e.href)}" target="_blank" rel="noopener">${esc(e.label)}</a>`)
        .join("");
      return `<tr>
        <td style="width:34px"><div class="st ${cls}">${mark}</div></td>
        <td><div class="ttl">${esc(c.plainTitle ?? c.title)}</div><div class="desc">${esc(c.plainDetail ?? c.acceptanceCriteria ?? "")}</div>${evidence ? `<div class="ev-row">${evidence}</div>` : ""}</td>
        <td class="cat">${esc(c.category)}</td>
      </tr>`;
    })
    .join("");

  const seo = buildSeoRanking(data.cards);
  const seoBlock = `
    ${seo.helps.length ? `<p style="padding:0 40px;color:var(--soft);font-size:13.5px;margin-bottom:8px"><strong style="color:var(--pass)">Helping your ranking:</strong></p><ul style="margin:0 40px 14px;padding-left:18px;color:var(--soft);font-size:13.5px">${seo.helps.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
    ${seo.hurts.length ? `<p style="padding:0 40px;color:var(--soft);font-size:13.5px;margin-bottom:8px"><strong style="color:var(--fail)">Hurting your ranking:</strong></p><ul style="margin:0 40px 14px;padding-left:18px;color:var(--soft);font-size:13.5px">${seo.hurts.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
    ${seo.fixes.length ? `<p style="padding:0 40px;color:var(--soft);font-size:13.5px;margin-bottom:8px"><strong>Exact fixes:</strong></p>${seo.fixes.map((f) => `<div class="finding" style="border-left-color:var(--accent)"><p>${esc(f.fix)}</p><p style="font-size:11.5px;color:var(--faint);margin-top:6px">Source: ${esc(f.source)}</p></div>`).join("")}` : ""}`;

  const findingBlocks = data.findings.length
    ? data.findings
        .map(
          (f) =>
            `<div class="finding"><h3>${esc(f.severity.toUpperCase())} — ${esc(f.title)}</h3><p>${esc(f.summary)}</p></div>`,
        )
        .join("")
    : `<p class="muted">No problems found. Every executed check passed.</p>`;

  const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(data.name)} — Launch Audit Report</title>
<style>
  :root{--paper:#faf8f4;--panel:#fff;--ink:#16140f;--soft:#5d574c;--faint:#9a9082;--line:#e7e1d6;--accent:#1f6feb;--pass:#0f8b53;--warn:#b6791b;--fail:#c23b46}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--paper);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;-webkit-font-smoothing:antialiased;line-height:1.5;padding:40px 0}
  .sheet{max-width:840px;margin:0 auto;background:var(--panel);border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:0 30px 70px -40px rgba(20,18,12,.5)}
  .mast{display:flex;justify-content:space-between;align-items:flex-start;padding:34px 40px;border-bottom:3px solid var(--ink)}
  .brand{display:flex;gap:11px;align-items:center;font-weight:700;font-size:16px}
  .mark{width:30px;height:30px;border-radius:8px;background:var(--ink);color:var(--paper);display:grid;place-items:center;font-weight:800}
  .meta{text-align:right;color:var(--soft);font-size:12.5px;line-height:1.7;font-family:ui-monospace,monospace}
  .hero{display:grid;grid-template-columns:auto 1fr;gap:40px;padding:36px 40px;align-items:center;border-bottom:1px solid var(--line)}
  .score{font-size:80px;font-weight:800;letter-spacing:-.04em;line-height:.9}
  .score sup{font-size:24px;color:var(--faint);font-weight:600}
  .slbl{font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--pass);margin-top:6px}
  h1{font-size:26px;font-weight:700;letter-spacing:-.02em}
  .url{color:var(--soft);font-size:14px;margin-top:4px;font-family:ui-monospace,monospace}
  .bar{display:flex;height:9px;border-radius:5px;overflow:hidden;margin-top:22px;border:1px solid var(--line)}
  .bar i{display:block;height:100%}
  .legend{display:flex;gap:22px;margin-top:13px;font-size:13.5px;color:var(--soft)}
  .legend i{width:9px;height:9px;border-radius:3px;display:inline-block;margin-right:7px}
  h2{font-size:12px;text-transform:uppercase;letter-spacing:.14em;color:var(--faint);padding:28px 40px 10px;font-family:ui-monospace,monospace}
  table{width:100%;border-collapse:collapse}
  td{padding:16px 40px;border-bottom:1px solid var(--line);vertical-align:middle}
  tr:last-child td{border-bottom:0}
  .st{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;font-weight:700}
  .st.p{background:#eaf6ef;color:var(--pass)}.st.f{background:#fbeaec;color:var(--fail)}.st.w{background:#fbf2e2;color:var(--warn)}
  .ttl{font-weight:600;font-size:15.5px}.desc{color:var(--soft);font-size:13.5px;margin-top:2px}
  .cat{font-family:ui-monospace,monospace;font-size:12px;color:var(--faint);text-align:right}
  .finding{margin:0 40px 12px;border:1px solid var(--line);border-left:4px solid var(--fail);border-radius:8px;padding:14px 16px}
  .finding h3{font-size:14px}.finding p{color:var(--soft);font-size:13.5px;margin-top:5px}
  .muted{color:var(--faint);padding:0 40px;font-size:14px}
  .ev-row{display:flex;gap:8px;margin-top:7px}
  .ev{font-family:ui-monospace,monospace;font-size:11px;color:var(--accent);text-decoration:none;border:1px solid var(--line);border-radius:5px;padding:2px 8px}
  .ev:hover{border-color:var(--accent)}
  .foot{padding:24px 40px 30px;color:var(--faint);font-size:11.5px;display:flex;justify-content:space-between;border-top:1px solid var(--line);margin-top:20px}
</style></head><body>
<div class="sheet">
  <div class="mast">
    <div class="brand"><div class="mark">L</div><div>LaunchAudit<div style="color:var(--faint);font-size:12px;font-weight:500">Launch Readiness Report</div></div></div>
    <div class="meta">${esc(new Date(data.generatedAt).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}))}<br/>${esc(data.appUrl)}</div>
  </div>
  <div class="hero">
    <div style="text-align:center"><div class="score">${esc(data.readiness)}<sup>/100</sup></div><div class="slbl">${data.readiness>=80?"Launch ready":data.readiness>=50?"Needs work":"Not ready"}</div></div>
    <div>
      <h1>${esc(data.name)}</h1>
      <div class="url">${esc(data.appUrl)}</div>
      <div class="bar"><i style="width:${pct(data.passed)}%;background:#0f8b53"></i><i style="width:${pct(data.failed)}%;background:#c23b46"></i><i style="width:${pct(data.blocked)}%;background:#b6791b"></i></div>
      <div class="legend"><span><i style="background:#0f8b53"></i>${data.passed} passed</span><span><i style="background:#c23b46"></i>${data.failed} failed</span><span><i style="background:#b6791b"></i>${data.blocked} need attention</span></div>
    </div>
  </div>
  <h2>What we checked</h2>
  <table>${rows}</table>
  <h2>Problems to fix</h2>
  ${findingBlocks}
  <h2>Google ranking (SEO bonus)</h2>
  ${seoBlock}
  <div class="foot"><span>Generated by LaunchAudit — ran in your own Claude Code, on your own account</span><span>fusiondataco.com</span></div>
</div>
</body></html>`;

  await fs.mkdir(outDir, { recursive: true });
  const file = path.join(outDir, `launch-audit-${stamp}.html`);
  await fs.writeFile(file, html);
  await fs.writeFile(path.join(outDir, `launch-audit-${stamp}.json`), JSON.stringify(data, null, 2));
  return file;
}

// Plain-English translation of technical categories for non-developers.
export function humanize(card: { category: string; title: string; status: string }): { plainTitle: string; plainDetail: string } {
  const map: Record<string, { t: string; d: string }> = {
    responsive_visual: { t: "Works on phones", d: "No sideways scrolling on a normal phone screen." },
    console_network: { t: "No hidden errors", d: "Nothing broken running in the background when pages load." },
    core_workflow: { t: "Pages load correctly", d: "Key pages open cleanly for a real visitor." },
    forms_validation: { t: "Forms work", d: "Visitors can fill out and submit your forms." },
    auth: { t: "Login works", d: "Sign-in and account areas behave correctly." },
    api_contract: { t: "Behind-the-scenes services respond", d: "The data your site depends on is reachable." },
    integration_side_effects: { t: "Connected services", d: "Third-party tools (payments, email) are wired up." },
    state_persistence: { t: "Your settings stick", d: "Choices are remembered after reloading." },
    roles_permissions: { t: "Admin access is locked down", d: "Only admins can reach admin pages and actions — not regular users or the public." },
    write_authz: { t: "Strangers can't change your data", d: "Logged-out visitors can't create, edit, or delete through your privileged write APIs." },
    write_authz_unverified: { t: "Open write endpoints to confirm", d: "A write API accepted an anonymous request — confirm it's meant to be public (like a contact form) or needs a login." },
    security_headers: { t: "Browser protections are on", d: "The site sends the headers that stop clickjacking, MIME-sniffing, and stack leaks." },
    secrets_exposure: { t: "No secrets are downloadable", d: "Config files, keys, and version-control data aren't publicly served." },
    seo: { t: "Search & sharing ready", d: "The page has a real title, mobile viewport, and the meta/structured data search engines and link previews need." },
  };
  const m = map[card.category] ?? { t: card.title, d: "" };
  return { plainTitle: m.t, plainDetail: m.d };
}
