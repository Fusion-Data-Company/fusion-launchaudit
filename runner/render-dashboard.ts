/**
 * Self-contained, LOCAL command-center dashboard for a single audit run.
 *
 * Reuses the real dashboard UI (public/index.html + app.css + app.js) verbatim,
 * fed by an offline fetch shim that resolves the dashboard's data calls from an
 * embedded payload. No backend, no server, the data never leaves the machine.
 * The audit auto-opens this so the user SEES their results in the UI we designed
 * (the same one in the hero video) instead of a dead file path.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ReportData } from "./render-report.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type HistoryRow = { ts: string; readiness: number; passed: number; failed: number; blocked: number };

function toPayload(d: ReportData, history: HistoryRow[]) {
  const test_cards = d.cards.map((c) => ({
    id: c.id,
    title: c.title,
    category: c.category,
    status: c.status,
    risk: c.risk || "medium",
    goal: "",
    steps: [],
    expectedEvidence: [],
    dataNeeds: [],
    acceptanceCriteria: c.acceptanceCriteria || c.plainDetail || "",
    evidence: c.evidence || [],
  }));
  const findings = d.findings.map((f) => ({
    id: f.id || f.title,
    type: f.severity === "needs verification" ? "needs_verification" : "product_bug",
    severity: f.severity,
    title: f.title,
    testCardId: f.id || "",
    summary: f.summary,
    evidenceRefs: [],
  }));
  const repair_tasks = d.findings
    .filter((f) => f.fixPrompt)
    .map((f) => ({
      finding_id: f.id || f.title,
      severity: f.severity,
      title: f.title,
      why_it_matters: f.summary,
      evidence_refs: [],
      likely_files: [],
      reproduction_steps: [],
      expected_behavior: "",
      verification_command: "",
      agent_prompt: f.fixPrompt,
    }));
  return {
    campaign: {
      id: "local",
      name: d.name,
      status: "report_ready",
      readinessScore: d.readiness,
      appUrl: d.appUrl,
      repoPath: "",
      depth: "Full launch audit",
      runner: { status: "local", host: "your machine", version: "80/20 Launch Audit", lastSync: "just now" },
      environment: { framework: "", supportTier: "local", auth: "captured locally", scripts: [], unsupportedGaps: [] },
    },
    test_cards,
    findings,
    repair_tasks,
    run_stats: {
      executedCardIds: d.cards.map((c) => c.id),
      artifacts: d.cards.reduce((n, c) => n + (c.evidence ? c.evidence.length : 0), 0),
    },
    persistence: { mode: "local" },
    history,
    // command-center-only sections — empty for a single local audit:
    stages: [],
    runner_tools: [],
    competitive_scorecard: [],
    flagship_features: [],
    traffic_insights: [],
    heal_events: [],
    model_provider_slots: [],
    model_routes: [],
    model_task_contracts: [],
    storage_readiness: [],
    database_tables: [],
    blob_artifacts: [],
    storage_schema_sql: "",
  };
}

export async function renderDashboard(d: ReportData, outDir: string): Promise<string> {
  const logoSvg = await fs.readFile(path.join(repoRoot, "public/favicon.svg"), "utf8").catch(() => "");
  const [indexHtml, appCss, appJs] = await Promise.all([
    fs.readFile(path.join(repoRoot, "public/index.html"), "utf8"),
    fs.readFile(path.join(repoRoot, "public/assets/app.css"), "utf8"),
    fs.readFile(path.join(repoRoot, "public/assets/app.js"), "utf8"),
  ]);

  // Track the project across runs — a local history file the dashboard can show.
  await fs.mkdir(outDir, { recursive: true });
  const histFile = path.join(outDir, "history.json");
  let history: HistoryRow[] = [];
  try {
    history = JSON.parse(await fs.readFile(histFile, "utf8"));
  } catch {
    /* first run */
  }
  history.push({ ts: d.generatedAt, readiness: d.readiness, passed: d.passed, failed: d.failed, blocked: d.blocked });
  history = history.slice(-30);
  await fs.writeFile(histFile, JSON.stringify(history, null, 2));

  const payload = toPayload(d, history);

  const localCss = `
    /* local-audit mode: hide backend-only nav + controls (no server here) */
    body.local-mode [data-nav="projects"], body.local-mode [data-nav="runner"], body.local-mode [data-nav="models"], body.local-mode [data-nav="reports"],
    body.local-mode #new-campaign-btn, body.local-mode #export-report-btn, body.local-mode #run-audit-btn, body.local-mode #campaign-switcher, body.local-mode #sample-data-badge { display:none !important; }
    .la-localchip{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--accent-ink,#c9ccff);border:1px solid rgba(124,131,255,.3);background:rgba(124,131,255,.08);border-radius:999px;padding:3px 10px;margin-left:8px}
  `;

  const preScript = `<script>
  (function(){
    var P = ${JSON.stringify(payload)};
    window.__LAUNCHAUDIT_LOCAL__ = P;
    // localStorage can throw on file:// — provide an in-memory fallback so the UI never breaks.
    try { window.localStorage.getItem("__la_probe"); } catch (e) {
      var mem = {};
      try { Object.defineProperty(window, "localStorage", { value: {
        getItem: function(k){ return Object.prototype.hasOwnProperty.call(mem,k) ? mem[k] : null; },
        setItem: function(k,v){ mem[k] = String(v); },
        removeItem: function(k){ delete mem[k]; },
        clear: function(){ mem = {}; }
      }}); } catch (_) {}
    }
    // Offline fetch shim: the dashboard's /api/* data calls resolve from the embedded payload.
    var realFetch = window.fetch ? window.fetch.bind(window) : null;
    window.fetch = function(input, init){
      var u = (typeof input === "string") ? input : (input && input.url) || "";
      function J(o){ return Promise.resolve(new Response(JSON.stringify(o), { status:200, headers:{ "content-type":"application/json" } })); }
      if (u.indexOf("/api/campaigns") !== -1) return J([{ id:P.campaign.id, name:P.campaign.name, status:P.campaign.status, readinessScore:P.campaign.readinessScore, appUrl:P.campaign.appUrl }]);
      if (u.indexOf("/api/campaign") !== -1) return J(P);
      if (u.indexOf("/api/") !== -1) return J({});
      return realFetch ? realFetch(input, init) : J({});
    };
    document.addEventListener("DOMContentLoaded", function(){
      document.body.classList.add("local-mode");
      var sub = document.getElementById("campaign-subline");
      if (sub && !sub.querySelector(".la-localchip")) {
        var chip = document.createElement("span");
        chip.className = "la-localchip";
        chip.textContent = "Local audit · on your machine";
        sub.appendChild(chip);
      }
    });
  })();
  </script>`;

  const html = indexHtml
    .replace(/<link rel="icon"[^>]*>/g, "")
    .replace(/<link rel="apple-touch-icon"[^>]*>/g, "")
    .replace(/\/logo-80-20\.png/g, logoSvg ? "data:image/svg+xml;base64," + Buffer.from(logoSvg).toString("base64") : "")
    .replace('<link rel="stylesheet" href="/assets/app.css" />', `<style>\n${appCss}\n${localCss}\n</style>`)
    .replace(
      '<script type="module" src="/assets/app.js"></script>',
      `${preScript}\n<script type="module">\n${appJs}\n</script>`,
    );

  const file = path.join(outDir, "dashboard.html");
  await fs.writeFile(file, html);
  return file;
}
