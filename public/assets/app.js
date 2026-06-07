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
            ${badge(item.status, item.status === "implemented" ? "badge-success" : item.status === "designed" ? "badge-info" : "badge-medium")}
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
  renderTrafficInsights(data.traffic_insights);
  renderHealEvents(data.heal_events);
}

const savedTheme = localStorage.getItem("launch-audit-theme");
setTheme(savedTheme === "light" ? "light" : "dark");

document.getElementById("theme-toggle").addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

loadCampaign().catch((error) => {
  document.getElementById("metrics").innerHTML = `<article class="metric-card"><strong>Load failed</strong><p>${escapeHtml(error.message)}</p></article>`;
});
