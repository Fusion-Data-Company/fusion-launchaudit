const categoryLabels = {
  auth: "Auth",
  core_workflow: "Core workflow",
  roles_permissions: "Roles",
  forms_validation: "Forms",
  state_persistence: "Persistence",
  responsive_visual: "Responsive",
  accessibility: "A11y",
  performance: "Performance",
  api_contract: "API",
  console_network: "Console/network",
  error_empty_states: "Error states",
  integration_side_effects: "Integrations",
};

const severityTone = {
  critical: "badge-critical",
  high: "badge-high",
  medium: "badge-medium",
  low: "badge-low",
};

const statusTone = {
  ready: "badge-muted",
  running: "badge-info",
  passed: "badge-success",
  failed: "badge-high",
  blocked: "badge-medium",
  configurable: "badge-info",
  needs_secret: "badge-medium",
  planned: "badge-muted",
  implemented: "badge-success",
  designed: "badge-info",
  next: "badge-medium",
  missing_secret: "badge-medium",
  seeded_only: "badge-muted",
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const badge = (label, tone = "badge-muted") => `<span class="badge ${tone}">${escapeHtml(label)}</span>`;

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("launch-audit-theme", theme);
  const toggle = document.getElementById("theme-toggle");
  if (toggle) toggle.textContent = theme === "dark" ? "Light" : "Dark";
}

function renderMetrics(campaign, testCards, findings, runStats) {
  const passed = testCards.filter((card) => card.status === "passed").length;
  const failed = testCards.filter((card) => card.status === "failed").length;
  const blocked = testCards.filter((card) => card.status === "blocked").length;
  const ready = testCards.filter((card) => card.status === "ready").length;
  const critical = findings.filter((f) => f.severity === "critical" || f.severity === "high").length;
  const live = Boolean(runStats);
  const metrics = [
    ["Readiness", `${campaign.readinessScore}/100`, "Score", live ? `Computed from ${runStats.executedCardIds.length} executed cards` : "Seeded demo value"],
    ["Tests", `${passed} pass / ${failed} fail`, "Cards", `${blocked} blocked · ${ready} awaiting execution`],
    ["Findings", String(findings.length), "Risk", findings.length === 0 ? "No open findings" : `${critical} high/critical severity`],
    ["Artifacts", live ? String(runStats.artifacts) : "0", "Proof", live ? `${runStats.runs} recorded runs with evidence` : "No runs executed yet"],
  ];

  document.getElementById("metrics").innerHTML = metrics
    .map(
      ([label, value, meta, detail]) => `
        <article class="metric-card">
          <div class="metric-top"><span>${escapeHtml(label)}</span><b>${escapeHtml(meta)}</b></div>
          <strong>${escapeHtml(value)}</strong>
          <p>${escapeHtml(detail)}</p>
        </article>`,
    )
    .join("");
}

function renderStages(stages) {
  document.getElementById("stages").innerHTML = stages
    .map(
      (stage, index) => `
        <div class="stage">
          <div class="stage-line">
            <div class="stage-dot stage-${stage.status}">${stage.status === "complete" ? "✓" : index + 1}</div>
            <div class="stage-rule"></div>
          </div>
          <div class="stage-label">${escapeHtml(stage.label)}</div>
          <div class="stage-detail">${escapeHtml(stage.detail)}</div>
        </div>`,
    )
    .join("");
}

function renderContext(campaign, runnerTools) {
  document.getElementById("context-contract").innerHTML = `
    <div class="code-box"><span>Runtime URL</span><code>${escapeHtml(campaign.appUrl)}</code></div>
    <div class="code-box"><span>Repo path</span><code>${escapeHtml(campaign.repoPath)}</code></div>
    <div class="mini-grid">
      <div><span>Support tier</span><strong>${escapeHtml(campaign.environment.supportTier)}</strong></div>
      <div><span>Auth</span><strong>${escapeHtml(campaign.environment.auth)}</strong></div>
    </div>
    <div>
      <div class="section-label">MCP tool surface</div>
      <div class="tool-grid">${runnerTools.map((tool) => `<code>${escapeHtml(tool.name)}</code>`).join("")}</div>
    </div>
    <div>
      <div class="section-label">Unsupported gaps declared</div>
      <div class="tool-grid">${campaign.environment.unsupportedGaps.map((gap) => `<code>${escapeHtml(gap)}</code>`).join("")}</div>
    </div>`;
}

let executedCardIds = new Set();
let currentCampaign = null;

function emptyState(title, body, command) {
  return `
    <div class="empty-state">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(body)}</p>
      ${command ? `<code>${escapeHtml(command)}</code>` : ""}
    </div>`;
}

function renderTestCards(testCards) {
  if (testCards.length === 0) {
    const cmd = `node --experimental-strip-types runner/audit.ts --name "${currentCampaign?.name ?? "My audit"}" --app-url ${currentCampaign?.appUrl ?? "https://your.app"} --repo /path/to/repo`;
    document.getElementById("test-cards").innerHTML = emptyState(
      "No test cards yet — run the audit",
      "From the fusion-launchaudit repo on your machine (with LAUNCHAUDIT_API_URL pointed here), one command scans, generates, executes, and syncs:",
      cmd,
    );
    return;
  }
  document.getElementById("test-cards").innerHTML = testCards
    .map(
      (card) => `
        <article class="test-card">
          <div class="test-card-top">
            <div>
              <div class="badge-row">
                <span class="mono-id">${escapeHtml(card.id)}</span>
                ${badge(categoryLabels[card.category] || card.category)}
                ${badge(card.risk, severityTone[card.risk])}
                ${badge(card.status, statusTone[card.status])}
                ${executedCardIds.has(card.id) ? badge("executed · live", "badge-success") : badge("not yet run", "badge-muted")}
              </div>
              <h3>${escapeHtml(card.title)}</h3>
            </div>
            <span class="arrow">→</span>
          </div>
          <p>${escapeHtml(card.goal)}</p>
          <div class="test-detail-grid">
            <div><span>Evidence gate</span><p>${escapeHtml(card.expectedEvidence.join(", "))}</p></div>
            <div><span>Acceptance</span><p>${escapeHtml(card.acceptanceCriteria)}</p></div>
          </div>
        </article>`,
    )
    .join("");
}

function renderInspector(campaign, findings, repairTasks) {
  if (findings.length === 0) {
    document.getElementById("findings").innerHTML = emptyState("No findings", "Failures from executed cards land here automatically with evidence attached.", null);
  }
  if (repairTasks.length === 0) {
    document.getElementById("repair-panel").innerHTML = `<div class="panel-title-line"><h2>Repair packet</h2><span class="accent-dot cayenne"></span></div>` + emptyState("No repair packets", "Every product-bug finding generates a coding-agent-ready repair packet.", null);
  }
  document.getElementById("runner-truth").innerHTML = `
    <div><span>Host</span><strong>${escapeHtml(campaign.runner.host)}</strong></div>
    <div><span>Version</span><strong>${escapeHtml(campaign.runner.version)}</strong></div>
    <div><span>Last sync</span><strong>${escapeHtml(campaign.runner.lastSync)}</strong></div>`;

  if (findings.length > 0) document.getElementById("findings").innerHTML = findings
    .map(
      (finding) => `
        <article class="finding-card">
          <div class="badge-row">${badge(finding.severity, severityTone[finding.severity])}${badge(finding.type.replaceAll("_", " "))}</div>
          <h3>${escapeHtml(finding.title)}</h3>
          <p>${escapeHtml(finding.summary)}</p>
        </article>`,
    )
    .join("");

  const task = repairTasks[0];
  document.getElementById("repair-panel").innerHTML = `
    <div class="panel-title-line"><h2>Repair packet</h2><span class="accent-dot cayenne"></span></div>
    <h3>${escapeHtml(task.title)}</h3>
    <p>${escapeHtml(task.why_it_matters)}</p>
    <div class="repair-box"><span>Likely files</span>${task.likely_files.map((file) => `<code>${escapeHtml(file)}</code>`).join("")}</div>
    <div class="verify-box"><span>Verification</span><code>${escapeHtml(task.verification_command)}</code></div>`;
}

function renderScorecard(scorecard) {
  document.getElementById("scorecard").innerHTML = scorecard
    .map(
      (item) => `
        <article class="scorecard-card">
          <div class="scorecard-top">
            <h3>${escapeHtml(item.category)}</h3>
            ${badge(item.status, statusTone[item.status] || "badge-muted")}
          </div>
          <div class="scorecard-row">
            <span>Baseline</span>
            <p>${escapeHtml(item.testspriteBaseline)}</p>
          </div>
          <div class="scorecard-row">
            <span>Fusion advantage</span>
            <p>${escapeHtml(item.fusionAdvantage)}</p>
          </div>
          <div class="scorecard-row">
            <span>Proof gate</span>
            <p>${escapeHtml(item.proofGate)}</p>
          </div>
        </article>`,
    )
    .join("");
}

function renderModelRouting(routes, providers) {
  const providerById = Object.fromEntries(providers.map((provider) => [provider.id, provider]));

  document.getElementById("model-routes").innerHTML = routes
    .map((route) => {
      const provider = providerById[route.providerSlotId];
      const fallback = providerById[route.fallbackProviderSlotId];

      return `
        <article class="model-route-card">
          <div class="scorecard-top">
            <div>
              <span class="mono-id">${escapeHtml(route.task.replaceAll("_", " "))}</span>
              <h3>${escapeHtml(route.label)}</h3>
            </div>
            ${badge(provider?.kind || "unknown", "badge-info")}
          </div>
          <div class="model-route-main">
            <div>
              <span>Primary</span>
              <strong>${escapeHtml(provider?.label || route.providerSlotId)}</strong>
              <code>${escapeHtml(route.model)}</code>
            </div>
            <div>
              <span>Fallback</span>
              <strong>${escapeHtml(fallback?.label || route.fallbackProviderSlotId)}</strong>
              <code>${escapeHtml(`temp ${route.temperature} / ${route.maxTokens} tokens`)}</code>
            </div>
          </div>
          <div class="scorecard-row">
            <span>Quality gate</span>
            <p>${escapeHtml(route.qualityGate)}</p>
          </div>
        </article>`;
    })
    .join("");
}

function renderProviderSlots(providers) {
  document.getElementById("provider-slots").innerHTML = providers
    .map(
      (provider) => `
        <article class="provider-card">
          <div class="scorecard-top">
            <h3>${escapeHtml(provider.label)}</h3>
            ${badge(provider.status.replaceAll("_", " "), statusTone[provider.status] || "badge-muted")}
          </div>
          <div class="provider-meta">
            <div><span>Kind</span><strong>${escapeHtml(provider.kind.replaceAll("_", " "))}</strong></div>
            <div><span>Secret</span><code>${escapeHtml(provider.secretEnv)}</code></div>
          </div>
          <div class="scorecard-row">
            <span>Endpoint</span>
            <p>${escapeHtml(provider.endpoint)}</p>
          </div>
          <div class="scorecard-row">
            <span>Guardrail</span>
            <p>${escapeHtml(provider.guardrail)}</p>
          </div>
          <div class="badge-row">${provider.bestFor.map((task) => badge(task.replaceAll("_", " "))).join("")}</div>
        </article>`,
    )
    .join("");
}

function renderStorage(readiness, tables, artifacts) {
  document.getElementById("storage-readiness").innerHTML = readiness
    .map(
      (item) => `
        <article class="storage-card">
          <div class="scorecard-top">
            <div>
              <span class="mono-id">${escapeHtml(item.subsystem)}</span>
              <h3>${escapeHtml(item.label)}</h3>
            </div>
            ${badge(item.status.replaceAll("_", " "), statusTone[item.status] || "badge-muted")}
          </div>
          <p>${escapeHtml(item.purpose)}</p>
          <div class="scorecard-row">
            <span>Required env</span>
            <p>${escapeHtml(item.requiredEnv.join(", "))}</p>
          </div>
          <div class="scorecard-row">
            <span>Production gate</span>
            <p>${escapeHtml(item.productionGate)}</p>
          </div>
        </article>`,
    )
    .join("");

  document.getElementById("database-tables").innerHTML = tables
    .map(
      (table) => `
        <article class="contract-row">
          <div>
            <h3>${escapeHtml(table.table)}</h3>
            <p>${escapeHtml(table.purpose)}</p>
          </div>
          ${badge(table.requiredForV1 ? "v1" : "later", table.requiredForV1 ? "badge-info" : "badge-muted")}
        </article>`,
    )
    .join("");

  document.getElementById("blob-artifacts").innerHTML = artifacts
    .map(
      (artifact) => `
        <article class="contract-row">
          <div>
            <h3>${escapeHtml(artifact.artifactType.replaceAll("_", " "))}</h3>
            <p>${escapeHtml(artifact.pathTemplate)}</p>
          </div>
          ${badge(artifact.access, artifact.access === "private" ? "badge-medium" : "badge-info")}
        </article>`,
    )
    .join("");
}

function renderFlagshipFeatures(features) {
  document.getElementById("flagship-features").innerHTML = features
    .map(
      (feature) => `
        <article class="flagship-card">
          <div class="scorecard-top">
            <h3>${escapeHtml(feature.name)}</h3>
            ${badge(feature.sourceInspiredBy, "badge-info")}
          </div>
          <p>${escapeHtml(feature.fusionVersion)}</p>
          <div class="scorecard-row">
            <span>Why it matters</span>
            <p>${escapeHtml(feature.whyItMatters)}</p>
          </div>
          <div class="scorecard-row">
            <span>Proof gate</span>
            <p>${escapeHtml(feature.proofGate)}</p>
          </div>
          <div class="badge-row">${feature.evidence.map((item) => badge(item)).join("")}</div>
        </article>`,
    )
    .join("");
}

function renderTrafficInsights(items) {
  document.getElementById("traffic-insights").innerHTML = items
    .map(
      (item) => `
        <article class="traffic-row">
          <div>
            <div class="badge-row">${badge(item.method, "badge-info")}${badge(item.risk, item.risk === "clean" ? "badge-success" : item.risk === "slow" ? "badge-medium" : "badge-high")}</div>
            <code>${escapeHtml(item.url)}</code>
          </div>
          <strong>${escapeHtml(item.status || "blocked")}</strong>
          <span>${escapeHtml(item.durationMs)}ms</span>
        </article>`,
    )
    .join("");
}

function renderHealEvents(items) {
  document.getElementById("heal-events").innerHTML = items
    .map(
      (item) => `
        <article class="traffic-row heal-row">
          <div>
            <div class="badge-row">${badge(item.testCardId, "badge-info")}${badge(item.disposition, item.disposition === "approved" ? "badge-success" : "badge-medium")}</div>
            <p>${escapeHtml(item.event)}</p>
            <small>${escapeHtml(item.auditNote)}</small>
          </div>
          <strong>${Math.round(item.confidence * 100)}%</strong>
        </article>`,
    )
    .join("");
}

function selectedCampaignId() {
  return localStorage.getItem("launch-audit-campaign") || "";
}

async function loadCampaign(campaignId = selectedCampaignId()) {
  const response = await fetch(`/api/campaign${campaignId ? `?id=${encodeURIComponent(campaignId)}` : ""}`);
  if (!response.ok && response.status !== 404) throw new Error(`Campaign API failed: ${response.status}`);
  const data = await response.json();
  currentCampaign = data.campaign;
  const title = document.getElementById("campaign-title");
  if (title) title.textContent = data.campaign.name;
  document.title = `${data.campaign.name} — Fusion LaunchAudit`;
  executedCardIds = new Set(data.run_stats?.executedCardIds ?? []);
  renderMetrics(data.campaign, data.test_cards, data.findings, data.run_stats);
  renderStages(data.stages);
  renderContext(data.campaign, data.runner_tools);
  renderTestCards(data.test_cards);
  renderInspector(data.campaign, data.findings, data.repair_tasks);
  renderScorecard(data.competitive_scorecard);
  renderFlagshipFeatures(data.flagship_features);
  renderModelRouting(data.model_routes || [], data.model_provider_slots || []);
  renderProviderSlots(data.model_provider_slots || []);
  renderStorage(data.storage_readiness || [], data.database_tables || [], data.blob_artifacts || []);
  renderTrafficInsights(data.traffic_insights);
  renderHealEvents(data.heal_events);
  renderPersistence(data.persistence);
  return data;
}

const savedTheme = localStorage.getItem("launch-audit-theme");
setTheme(savedTheme === "light" ? "light" : "dark");

document.getElementById("theme-toggle").addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});


/* ============================================================
   MOTION LAYER — staggered reveals + animated counters.
   GPU-only (transform/opacity). Skips everything when the
   user prefers reduced motion.
   ============================================================ */

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function initReveals() {
  if (prefersReducedMotion) return;

  const groups = [
    ".metric-card",
    ".stage",
    ".test-card",
    ".finding-card",
    ".score-card, .scorecard-grid > *",
    ".feature-card",
    ".slot-card",
    ".route-row",
    ".storage-row",
    ".traffic-row",
    ".panel, .repair-panel",
  ];

  const seen = new Set();
  for (const selector of groups) {
    const nodes = [...document.querySelectorAll(selector)].filter((node) => !seen.has(node));
    nodes.forEach((node, index) => {
      seen.add(node);
      node.classList.add("reveal");
      node.style.setProperty("--reveal-delay", `${Math.min(index, 8) * 60}ms`);
    });
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "0px 0px -40px 0px", threshold: 0.08 },
  );

  for (const node of seen) observer.observe(node);
}

function initCounters() {
  if (prefersReducedMotion) return;

  for (const node of document.querySelectorAll(".metric-card strong")) {
    const original = node.textContent;
    const match = original.match(/^(\d+)/);
    if (!match) continue;
    const target = Number(match[1]);
    if (target === 0) continue;

    const start = performance.now();
    const duration = 1100;
    const ease = (t) => 1 - Math.pow(1 - t, 3);

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const value = Math.round(ease(progress) * target);
      node.textContent = original.replace(/^(\d+)/, String(value));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

function initMotion() {
  initReveals();
  initCounters();
}


/* ============================================================
   VIEW ROUTER — hash-based navigation. Six real destinations:
   #/campaigns #/projects #/runner #/evidence #/reports #/models
   ============================================================ */

const VIEW_NAMES = ["campaigns", "projects", "runner", "evidence", "reports", "models"];

function currentView() {
  const candidate = window.location.hash.replace(/^#\/?/, "");
  return VIEW_NAMES.includes(candidate) ? candidate : "campaigns";
}

function applyView() {
  const view = currentView();

  for (const node of document.querySelectorAll("[data-view]")) {
    const views = node.dataset.view.split(" ");
    const show = views.includes(view);
    node.hidden = !show;
    if (show) {
      node.classList.remove("view-enter");
      void node.offsetWidth; // restart entrance animation
      node.classList.add("view-enter");
      for (const child of node.querySelectorAll(".reveal")) child.classList.add("in-view");
      if (node.classList.contains("reveal")) node.classList.add("in-view");
    }
  }

  for (const link of document.querySelectorAll("#main-nav .nav-item")) {
    link.classList.toggle("nav-active", link.dataset.nav === view);
  }

  const inspector = document.querySelector(".inspector");
  const inspectorVisible = [...inspector.querySelectorAll("[data-view]")].some((node) => !node.hidden);
  inspector.hidden = !inspectorVisible;
  document.querySelector(".content-grid").classList.toggle("no-inspector", !inspectorVisible);

  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

function initRouter() {
  window.addEventListener("hashchange", applyView);
  applyView();
}

function renderPersistence(persistence) {
  const badge = document.getElementById("persistence-status");
  if (!badge || !persistence) return;
  const live = persistence.mode === "postgres";
  badge.textContent = live ? "postgres live" : "seeded mode";
  badge.classList.remove("badge-medium", "badge-success", "badge-muted");
  badge.classList.add(live ? "badge-success" : "badge-medium");
  badge.title = persistence.detail || "";
}



/* ============================================================
   CAMPAIGN SWITCHER + CREATION
   ============================================================ */

async function initCampaignSwitcher(data) {
  const switcher = document.getElementById("campaign-switcher");
  if (data.persistence?.mode !== "postgres") {
    switcher.hidden = true;
    return;
  }
  try {
    const response = await fetch("/api/campaigns");
    if (!response.ok) return;
    const { campaigns } = await response.json();
    if (!campaigns || campaigns.length === 0) return;
    const current = currentCampaign?.id;
    switcher.innerHTML = campaigns
      .map((c) => `<option value="${escapeHtml(c.id)}" ${c.id === current ? "selected" : ""}>${escapeHtml(c.name)} · ${escapeHtml(String(c.readinessScore))}/100</option>`)
      .join("");
    switcher.hidden = false;
    switcher.onchange = async () => {
      localStorage.setItem("launch-audit-campaign", switcher.value);
      await reloadCampaignData(switcher.value);
    };
  } catch {
    switcher.hidden = true;
  }
}

async function reloadCampaignData(campaignId) {
  await loadCampaign(campaignId);
  initMotion();
  applyView();
}

function initNewCampaign() {
  const backdrop = document.getElementById("new-campaign-backdrop");
  document.getElementById("new-campaign-btn").addEventListener("click", () => backdrop.classList.add("open"));
  document.getElementById("new-campaign-close").addEventListener("click", () => backdrop.classList.remove("open"));
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) backdrop.classList.remove("open");
  });

  document.getElementById("new-campaign-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorBox = document.getElementById("nc-error");
    errorBox.hidden = true;
    const payload = {
      name: document.getElementById("nc-name").value.trim(),
      app_url: document.getElementById("nc-url").value.trim(),
      repo_path_hint: document.getElementById("nc-repo").value.trim() || undefined,
    };
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        errorBox.textContent = result.error || `Creation failed (${response.status})${result.hint ? ` — ${result.hint}` : ""}`;
        errorBox.hidden = false;
        return;
      }
      localStorage.setItem("launch-audit-campaign", result.id);
      backdrop.classList.remove("open");
      window.location.hash = "#/campaigns";
      await reloadCampaignData(result.id);
    } catch (submitError) {
      errorBox.textContent = String(submitError);
      errorBox.hidden = false;
    }
  });

  document.getElementById("export-report-btn").addEventListener("click", () => {
    const id = currentCampaign?.id ?? "";
    window.open(`/report.html${id ? `?campaign=${encodeURIComponent(id)}` : ""}`, "_blank");
  });
}

/* ============================================================
   TOPBAR ACTIONS — honest quickstart modals. No fake spinners:
   these show the real commands until Playwright execution lands.
   ============================================================ */

const MODALS = {
  "start-campaign": {
    title: "Start a campaign",
    sub: "LaunchAudit runs through your own coding agent — your Claude does the planning, the local runner keeps your code private, this command center stores the evidence.",
    steps: [
      {
        h: "Add the LaunchAudit MCP server to Claude Code",
        p: "From the fusion-launchaudit repo folder (after npm install):",
        code: "claude mcp add launchaudit -- node --experimental-strip-types ./runner/mcp-server.ts",
      },
      {
        h: "Ask your agent to plan the audit",
        p: "In Claude Code, point it at your project:",
        code: "Scan ~/my-app with launchaudit_scan_repo, then write evidence-gated test cards per launchaudit_get_test_card_contract and sync them.",
      },
      {
        h: "Or run the full audit in one command",
        p: "Scan, generate, create campaign, execute in a real browser, sync evidence:",
        code: 'node --experimental-strip-types runner/audit.ts --name "My app" --app-url https://my.app --repo ~/my-app',
      },
      {
        h: "Auth-gated flows",
        p: "Login flows need locally captured auth state (qa.capture_auth_state) — credentials never touch this web app. Capture ships with the auth layer and is declared blocked until then.",
      },
    ],
    note: "Honest status: test cards sync and persist today. Playwright execution of approved cards is the next production layer — nothing here pretends to run tests it didn't run.",
  },
  "capture-auth": {
    title: "Capture auth state",
    sub: "Production credentials never get pasted into this web app. Auth capture happens on your machine through the local runner.",
    steps: [
      {
        h: "How it works",
        p: "The runner opens a controlled browser session on your machine; you log into your app; encrypted Playwright storage state is saved locally and referenced by ID — the platform only ever sees the reference.",
      },
      {
        h: "Contract",
        p: "qa.capture_auth_state — input { campaign_id, app_url }, output { auth_state_ref, expires_at, roles_detected[] }.",
      },
    ],
    note: "Honest status: browser-state capture ships with the Playwright execution layer. The contract and storage path are final; this button will run it the day it lands.",
  },
};

function escapeAttr(v) { return escapeHtml(String(v)); }

function openModal(kind) {
  const def = MODALS[kind];
  if (!def) return;
  document.getElementById("modal-title").textContent = def.title;
  document.getElementById("modal-sub").textContent = def.sub;
  document.getElementById("modal-body").innerHTML =
    def.steps
      .map(
        (s, i) => `
        <div class="modal-step">
          <div class="modal-step-num">${i + 1}</div>
          <div>
            <h3>${escapeHtml(s.h)}</h3>
            <p>${escapeHtml(s.p)}</p>
            ${s.code ? `<code class="modal-code">${escapeHtml(s.code)}<button class="modal-copy" data-copy="${escapeAttr(s.code)}" type="button">Copy</button></code>` : ""}
          </div>
        </div>`,
      )
      .join("") + `<div class="modal-note">${escapeHtml(def.note)}</div>`;
  document.getElementById("modal-backdrop").classList.add("open");
}

function closeModal() {
  document.getElementById("modal-backdrop").classList.remove("open");
}

function initModals() {
  document.getElementById("run-audit-btn")?.addEventListener("click", () => openModal("start-campaign"));
  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal-backdrop").addEventListener("click", (event) => {
    if (event.target === document.getElementById("modal-backdrop")) closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });
  document.getElementById("modal-body").addEventListener("click", async (event) => {
    const btn = event.target.closest(".modal-copy");
    if (!btn) return;
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.textContent = "Copied";
      setTimeout(() => { btn.textContent = "Copy"; }, 1400);
    } catch {
      btn.textContent = "Select + copy manually";
    }
  });
}

loadCampaign()
  .then((data) => {
    initMotion();
    initRouter();
    initModals();
    initNewCampaign();
    initCampaignSwitcher(data);
  })
  .catch((error) => {
    document.getElementById("metrics").innerHTML = `<article class="metric-card"><strong>Load failed</strong><p>${escapeHtml(error.message)}</p></article>`;
  });
