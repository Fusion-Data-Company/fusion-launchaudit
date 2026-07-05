/**
 * Self-contained HTML report — no server, no backend. Writes a single .html
 * file the customer can open or hand to a client. Used by standalone audits
 * that run entirely inside the customer's own Claude Code.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { buildSeoRanking } from "../src/lib/report/seo-report.ts";
import { fixTheseThree, type Finding } from "../src/lib/report/fixes.ts";

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
  findings: Array<{ id?: string; title: string; category?: string; summary: string; severity: string; fixPrompt?: string }>;
  generatedAt: string;
};

// Single-pass HTML escape (covers &, <, >, ", ') — one scan, order-independent, no
// per-char replaceAll chain. Enough for text nodes + quoted attributes in this report.
const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);

// The Launch Gate — a literal PASS/FAIL over the security/authorization wedge,
// sitting above the 0–100 score (Sonar's quality-gate move, on our wedge). It
// fails ONLY on confirmed product bugs in security/authz categories (never on
// needs_verification / needs_input — honest), or when readiness is below the bar.
const GATE_CATEGORIES = new Set([
  "roles_permissions", "auth", "object_authz", "mutation_authz", "mass_assignment",
  "write_authz", "cors", "cookie_security", "tls_hsts", "injection",
  "security_headers", "secrets_exposure", "secret_exposure", "dependency_cve",
]);

export type GateVerdict = { pass: boolean; blockers: ReportData["findings"]; coverageGaps: string[]; readiness: number; threshold: number; reason: string };

export function launchGate(data: ReportData, threshold = 80): GateVerdict {
  const confirmed = (sev: string) => {
    const s = sev.toLowerCase();
    // "tooling" = our own scanner hiccup (e.g. OSV/network) — never the app's fault,
    // so it can never block a launch, same as needs-verification / needs-input / blocked.
    return s !== "needs verification" && s !== "needs input" && s !== "blocked" && s !== "tooling";
  };
  const blockers = data.findings.filter((f) => f.category != null && GATE_CATEGORIES.has(f.category) && confirmed(f.severity));
  // Coverage gaps: security/authz checks we could not RUN (blocked for lack of creds,
  // https, a lockfile, …). Readiness excludes blocked, so we surface these here to keep
  // the score honest — a clean number over partial wedge coverage is stated as partial.
  const coverageGaps = data.cards
    .filter((c) => c.status === "blocked" && GATE_CATEGORIES.has(c.category))
    .map((c) => c.plainTitle ?? c.title);
  const pass = blockers.length === 0 && data.readiness >= threshold;
  const base = blockers.length
    ? `${blockers.length} confirmed security/authorization ${blockers.length === 1 ? "issue" : "issues"} must be fixed before launch`
    : data.readiness < threshold
      ? `readiness ${data.readiness} is below the ${threshold}/100 launch threshold`
      : `no confirmed security/authorization issues and readiness is at or above ${threshold}/100`;
  const reason = coverageGaps.length
    ? `${base} — NOTE: ${coverageGaps.length} security/authorization check${coverageGaps.length === 1 ? "" : "s"} could not run (partial coverage); provide the missing input to verify them`
    : base;
  return { pass, blockers, coverageGaps, readiness: data.readiness, threshold, reason };
}

export async function renderReport(data: ReportData, outDir: string): Promise<string> {
  const total = data.passed + data.failed + data.blocked;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const stamp = data.generatedAt.replace(/[:.]/g, "-").slice(0, 19);
  const gate = launchGate(data);

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

  const fixBlock = (f: ReportData["findings"][number]) =>
    f.fixPrompt ? `<details class="fix"><summary>Paste-ready fix for your AI builder</summary><pre>${esc(f.fixPrompt)}</pre></details>` : "";

  const findingBlocks = data.findings.length
    ? data.findings
        .map(
          (f) =>
            `<div class="finding"><h3>${esc(f.severity.toUpperCase())} — ${esc(f.title)}</h3><p>${esc(f.summary)}</p>${fixBlock(f)}</div>`,
        )
        .join("")
    : `<p class="muted">No problems found. Every executed check passed.</p>`;

  // Fix these 3 first — the launch-blockers, leading the report.
  const top3 = fixTheseThree(data.findings as Finding[]);
  const fixThree = top3.length
    ? `<ol class="top3">${top3.map((f) => `<li><div class="t3t">${esc(f.title)} <span class="t3s">${esc(f.severity)}</span></div>${f.fixPrompt ? `<details class="fix"><summary>Paste-ready fix</summary><pre>${esc(f.fixPrompt)}</pre></details>` : ""}</li>`).join("")}</ol>`
    : `<p class="muted">Nothing blocking — no failures to prioritize.</p>`;

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
  .gate{display:flex;align-items:center;gap:14px;padding:14px 40px;border-bottom:1px solid var(--line);font-size:14px}
  .gate-pass{background:#eaf6ef}.gate-fail{background:#fbeaec}
  .gate-badge{font-family:ui-monospace,monospace;font-weight:800;letter-spacing:.1em;border:2px solid currentColor;border-radius:6px;padding:3px 10px;font-size:13px}
  .gate-pass .gate-badge{color:var(--pass)}.gate-fail .gate-badge{color:var(--fail)}
  .gate-txt{color:var(--ink)}
  .top3{margin:0 40px 8px;padding-left:20px}.top3 li{margin-bottom:12px}
  .t3t{font-weight:600;font-size:15px}.t3s{font-family:ui-monospace,monospace;font-size:10.5px;text-transform:uppercase;color:var(--fail);border:1px solid var(--line);border-radius:4px;padding:1px 6px;margin-left:6px}
  .fix{margin-top:7px}.fix summary{cursor:pointer;font-size:12.5px;color:var(--accent);font-family:ui-monospace,monospace}
  .fix pre{white-space:pre-wrap;background:#f4f1ea;border:1px solid var(--line);border-radius:7px;padding:11px 13px;margin-top:7px;font-size:12.5px;line-height:1.5;font-family:ui-monospace,monospace;color:var(--ink)}
</style></head><body>
<div class="sheet">
  <div class="mast">
    <div class="brand"><div class="mark">L</div><div>LaunchAudit<div style="color:var(--faint);font-size:12px;font-weight:500">Launch Readiness Report</div></div></div>
    <div class="meta">${esc(new Date(data.generatedAt).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}))}<br/>${esc(data.appUrl)}</div>
  </div>
  <div class="gate ${gate.pass ? "gate-pass" : "gate-fail"}">
    <span class="gate-badge">${gate.pass ? "PASS" : "FAIL"}</span>
    <span class="gate-txt"><strong>Launch Gate</strong> — ${esc(gate.reason)}.</span>
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
  <h2>Fix these 3 first</h2>
  ${fixThree}
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
  await fs.writeFile(path.join(outDir, `launch-audit-${stamp}.json`), JSON.stringify({ ...data, launch_gate: gate }, null, 2));
  return file;
}

/**
 * Client-facing one-pager: the plain-English summary a non-developer reads — score,
 * verdict, the top 3 to fix in plain language, what's working, and the SEO headline.
 * NO per-check table and NO paste-ready prompts (those live in the builder report).
 */
export async function renderClientReport(data: ReportData, outDir: string): Promise<string> {
  const stamp = data.generatedAt.replace(/[:.]/g, "-").slice(0, 19);
  const verdict = data.readiness >= 80 ? "Launch ready" : data.readiness >= 50 ? "Needs work before launch" : "Not ready to launch";
  const gate = launchGate(data);
  const top3 = fixTheseThree(data.findings as Finding[]);
  const seo = buildSeoRanking(data.cards);
  const top3Html = top3.length
    ? `<ol>${top3.map((f) => `<li><strong>${esc(f.title)}</strong> — ${esc(f.summary.split(" [")[0])}</li>`).join("")}</ol>`
    : `<p class="muted">Nothing is blocking launch.</p>`;
  const seoHtml = [...seo.hurts.slice(0, 4)].map((h) => `<li>${esc(h)}</li>`).join("") || `<li>No ranking issues found on the pages we checked.</li>`;

  const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(data.name)} — Launch Summary</title>
<style>
  body{background:#faf8f4;color:#16140f;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.55;padding:40px 0}
  .sheet{max-width:680px;margin:0 auto;background:#fff;border:1px solid #e7e1d6;border-radius:18px;padding:40px;box-shadow:0 30px 70px -40px rgba(20,18,12,.5)}
  .top{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #16140f;padding-bottom:18px;margin-bottom:22px}
  .score{font-size:64px;font-weight:800;letter-spacing:-.04em;line-height:.9}.score sup{font-size:20px;color:#9a9082}
  h1{font-size:22px;margin:0 0 2px}.url{color:#5d574c;font-size:13px;font-family:ui-monospace,monospace}
  .verdict{font-weight:700;font-size:14px;color:${data.readiness >= 80 ? "#0f8b53" : data.readiness >= 50 ? "#b6791b" : "#c23b46"}}
  h2{font-size:12px;text-transform:uppercase;letter-spacing:.14em;color:#9a9082;margin:24px 0 8px;font-family:ui-monospace,monospace}
  ol,ul{padding-left:20px;color:#3a352c;font-size:14.5px}li{margin-bottom:7px}
  .counts{display:flex;gap:20px;font-size:14px;color:#5d574c;margin-top:6px}
  .muted{color:#9a9082}.foot{margin-top:26px;padding-top:16px;border-top:1px solid #e7e1d6;color:#9a9082;font-size:11.5px}
</style></head><body><div class="sheet">
  <div class="top"><div><h1>${esc(data.name)}</h1><div class="url">${esc(data.appUrl)}</div></div>
    <div style="text-align:center"><div class="score">${esc(data.readiness)}<sup>/100</sup></div><div class="verdict">${verdict}</div></div></div>
  <div class="counts"><span>✅ ${data.passed} working</span><span>❌ ${data.failed} to fix</span><span>⚠️ ${data.blocked} need attention</span></div>
  <p style="margin-top:14px;font-size:14px"><strong style="font-family:ui-monospace,monospace;border:2px solid ${gate.pass ? "#0f8b53" : "#c23b46"};color:${gate.pass ? "#0f8b53" : "#c23b46"};border-radius:6px;padding:2px 9px;letter-spacing:.08em">${gate.pass ? "PASS" : "FAIL"}</strong> &nbsp;Launch gate: ${esc(gate.reason)}.</p>
  <h2>Fix these 3 first</h2>
  ${top3Html}
  <h2>Getting found on Google</h2>
  <ul>${seoHtml}</ul>
  <div class="foot">Plain-English summary. Your developer has the full technical report with exact fixes. — LaunchAudit, fusiondataco.com</div>
</div></body></html>`;

  await fs.mkdir(outDir, { recursive: true });
  const file = path.join(outDir, `launch-audit-${stamp}-client.html`);
  await fs.writeFile(file, html);
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
