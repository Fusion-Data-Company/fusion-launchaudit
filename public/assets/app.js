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

function renderMetrics(campaign, testCards, findings) {
  const passed = testCards.filter((card) => card.status === "passed").length;
  const failed = testCards.filter((card) => card.status === "failed").length;
  const blocked = testCards.filter((card) => card.status === "blocked").length;
  const metrics = [
    ["Readiness", `${campaign.readinessScore}/100`, "Score", "Blocked by 2 launch issues"],
    ["Tests", `${passed} pass / ${failed} fail`, "Cards", `${blocked} blocked check declared`],
    ["Findings", String(findings.length), "Risk", "2 product bugs, 1 environment issue"],
    ["Artifacts", "18", "Proof", "Screenshots, traces, network logs"],
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

function renderTestCards(testCards) {
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
  document.getElementById("runner-truth").innerHTML = `
    <div><span>Host</span><strong>${escapeHtml(campaign.runner.host)}</strong></div>
    <div><span>Version</span><strong>${escapeHtml(campaign.runner.version)}</strong></div>
    <div><span>Last sync</span><strong>${escapeHtml(campaign.runner.lastSync)}</strong></div>`;

  document.getElementById("findings").innerHTML = findings
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

async function loadCampaign() {
  const response = await fetch("/api/campaign");
  if (!response.ok) throw new Error(`Campaign API failed: ${response.status}`);
  const data = await response.json();
  renderMetrics(data.campaign, data.test_cards, data.findings);
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

loadCampaign()
  .then(() => initMotion())
  .catch((error) => {
    document.getElementById("metrics").innerHTML = `<article class="metric-card"><strong>Load failed</strong><p>${escapeHtml(error.message)}</p></article>`;
  });
