/* ============================================================================
   LaunchAudit — control surface client
   Vanilla ES module. Renders the seeded /api/campaign payload into a dense
   developer-tool dashboard with real data-viz. No framework, no emoji.
   ============================================================================ */

const categoryLabels = {
  auth: "Auth",
  core_workflow: "Core workflow",
  roles_permissions: "Roles & permissions",
  forms_validation: "Forms & validation",
  state_persistence: "State persistence",
  responsive_visual: "Responsive & visual",
  accessibility: "Accessibility",
  performance: "Performance",
  api_contract: "API contract",
  console_network: "Console & network",
  error_empty_states: "Error & empty states",
  integration_side_effects: "Integration side-effects",
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
  ready_to_configure: "badge-info",
};

const esc = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const icon = (id, attrs = "") => `<svg ${attrs}><use href="#${id}"/></svg>`;
const badge = (label, tone = "badge-muted") => `<span class="badge ${tone}">${esc(label)}</span>`;
const badgeFlat = (label, tone = "badge-muted") => `<span class="badge no-dot ${tone}">${esc(label)}</span>`;
const titleCase = (v) => String(v).replaceAll("_", " ");

/* ---------------------------------------------------------------- theming */
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("launch-audit-theme", theme);
  const useEl = document.querySelector("#theme-icon use");
  if (useEl) useEl.setAttribute("href", theme === "dark" ? "#i-sun" : "#i-moon");
  const toggle = document.getElementById("theme-toggle");
  if (toggle) toggle.title = theme === "dark" ? "Switch to light" : "Switch to dark";
}

/* ---------------------------------------------------- state across renders */
let executedCardIds = new Set();
let currentCampaign = null;
// True when the API served seed/demo data (no Postgres). Drives the "sample
// data" labelling so placeholders are never presented as a real audit.
let isSampleData = true;

/* ============================================================================
   HERO — gauge + journey + run summary
   ============================================================================ */
function renderHero(campaign, testCards, runStats) {
  const score = Number(campaign.readinessScore) || 0;
  const counts = countByStatus(testCards);
  const total = testCards.length || 1;
  const live = Boolean(runStats);

  // gauge geometry
  const R = 70, C = 2 * Math.PI * R;
  const start = 80, target = 100;
  const gap = Math.max(0, target - score);
  const pct = Math.max(0, Math.min(100, ((score - start) / (target - start)) * 100));

  const segOrder = [["passed", counts.passed], ["failed", counts.failed], ["blocked", counts.blocked], ["ready", counts.ready]];
  const segHtml = segOrder
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `<span class="seg-${k}" style="flex-grow:${n}"></span>`)
    .join("");

  const legend = [
    ["passed", "var(--ok)", counts.passed],
    ["failed", "var(--bad)", counts.failed],
    ["blocked", "var(--warn)", counts.blocked],
    ["ready", "var(--fg-4)", counts.ready],
  ]
    .map(([label, color, n]) => `<span><i style="background:${color}"></i>${label} <b>${n}</b></span>`)
    .join("");

  document.getElementById("hero").innerHTML = `
    <div class="hero-gauge">
      <div class="gauge-wrap">
        <svg viewBox="0 0 168 168">
          <defs>
            <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="var(--accent-2)"/>
              <stop offset="1" stop-color="var(--accent)"/>
            </linearGradient>
          </defs>
          <circle class="gauge-track" cx="84" cy="84" r="${R}"/>
          <circle class="gauge-arc" id="gauge-arc" cx="84" cy="84" r="${R}"
            stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}"/>
        </svg>
        <div class="gauge-center">
          <div class="gauge-num" id="gauge-num" data-target="${score}">0</div>
          <div class="gauge-denom">/ 100</div>
        </div>
      </div>
      <div class="gauge-cap">launch readiness</div>
    </div>
    <div class="hero-body">
      <div class="journey-block">
        <div class="hero-journey-head">
          <h3>Road to hand-to-client</h3>
          <div class="gap-to-go">${gap === 0 ? "<b>ship-ready</b>" : `<b>${gap} pts</b> to 100`}</div>
        </div>
        <div class="journey">
          <div class="journey-track">
            <div class="journey-fill" id="journey-fill"></div>
            <div class="journey-now" id="journey-now" style="left:${pct.toFixed(1)}%"><span class="journey-now-dot"></span></div>
          </div>
          <div class="journey-scale">
            <span class="js-anchor">${start} · seeded start</span>
            <span class="js-anchor js-end">handoff · 100</span>
          </div>
        </div>
      </div>
      <div class="run-summary">
        <div class="run-summary-head">
          <div class="section-label">Run outcome</div>
          <div class="runtotal">${testCards.length} cards${live ? ` · ${runStats.runs} runs` : ""}</div>
        </div>
        <div class="segbar" id="run-segbar">${segHtml || '<span class="seg-ready" style="flex-grow:1"></span>'}</div>
        <div class="seg-legend">${legend}</div>
      </div>
    </div>`;

  requestAnimationFrame(() => {
    const fill = document.getElementById("journey-fill");
    if (fill) fill.style.width = `${pct}%`;
    animateGauge(score, C, R);
  });
}

function animateGauge(score, C, R) {
  const arc = document.getElementById("gauge-arc");
  const num = document.getElementById("gauge-num");
  if (!arc || !num) return;
  const targetOffset = C * (1 - score / 100);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    arc.style.strokeDashoffset = targetOffset.toFixed(1);
    num.textContent = String(score);
    return;
  }
  const dur = 1100, t0 = performance.now();
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const tick = (now) => {
    const p = Math.min((now - t0) / dur, 1);
    const e = ease(p);
    arc.style.strokeDashoffset = (C * (1 - (score * e) / 100)).toFixed(1);
    num.textContent = String(Math.round(score * e));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function countByStatus(cards) {
  const c = { passed: 0, failed: 0, blocked: 0, ready: 0, running: 0 };
  for (const card of cards) if (card.status in c) c[card.status]++;
  return c;
}

/* ============================================================================
   METRICS
   ============================================================================ */
function renderMetrics(campaign, testCards, findings, runStats) {
  const counts = countByStatus(testCards);
  const critical = findings.filter((f) => f.severity === "critical" || f.severity === "high").length;
  const live = Boolean(runStats);

  const metrics = [
    {
      ic: "i-gauge", label: "Readiness", value: `${campaign.readinessScore}<span class="unit">/100</span>`,
      tag: live ? badge("live", "badge-success") : badge("seeded", "badge-muted"),
      foot: live ? `from ${runStats.executedCardIds.length} executed cards` : "seeded demo baseline",
    },
    {
      ic: "i-check", label: "Tests", value: `${counts.passed}<span class="unit"> / ${testCards.length}</span>`,
      tag: counts.failed > 0 ? badge(`${counts.failed} failing`, "badge-high") : badge("clean", "badge-success"),
      foot: `${counts.passed} pass · ${counts.failed} fail · ${counts.blocked} blocked`,
    },
    {
      ic: "i-findings", label: "Findings", value: String(findings.length),
      tag: critical > 0 ? badge(`${critical} high+`, "badge-high") : badge("none", "badge-muted"),
      foot: findings.length === 0 ? "no open findings" : "evidence-linked, classified",
    },
    {
      ic: "i-evidence", label: "Artifacts", value: live ? String(runStats.artifacts) : "0",
      tag: live ? badge("captured", "badge-info") : badge("pending", "badge-muted"),
      foot: live ? `${runStats.runs} recorded runs` : "no runs executed yet",
    },
  ];

  document.getElementById("metrics").innerHTML = metrics
    .map(
      (m) => `
        <article class="metric-card">
          <div class="metric-top">${icon(m.ic, 'class="mi"')}<span>${m.label}</span>${m.tag}</div>
          <div class="metric-value">${m.value}</div>
          <p>${esc(m.foot)}</p>
        </article>`,
    )
    .join("");
}

/* ============================================================================
   CATEGORY COVERAGE — the centerpiece
   ============================================================================ */
const COVERAGE_GROUPS = [
  {
    key: "frontend", title: "Frontend", icon: "i-frontend",
    scope: "UI · flows · a11y · perf",
    categories: ["core_workflow", "responsive_visual", "console_network", "forms_validation", "accessibility", "performance", "state_persistence", "error_empty_states"],
  },
  {
    key: "backend", title: "Backend & API", icon: "i-backend",
    scope: "endpoints · input · injection",
    categories: ["api_contract", "injection"],
  },
  {
    key: "rbac", title: "Access control", icon: "i-rbac",
    scope: "roles · IDOR · mutations",
    categories: ["roles_permissions", "auth", "object_authz", "mutation_authz", "mass_assignment"],
  },
  {
    key: "security", title: "Security & hardening", icon: "i-db",
    scope: "headers · secrets · cookies · CORS · TLS",
    categories: ["security_headers", "secrets_exposure", "cookie_security", "cors", "tls_hsts"],
  },
  {
    key: "middleware", title: "Middleware & integrations", icon: "i-middleware",
    scope: "guards · third-party",
    categories: ["integration_side_effects"],
  },
];

function renderCoverage(testCards) {
  const html = COVERAGE_GROUPS.map((group) => {
    const cards = testCards.filter((c) => group.categories.includes(c.category));
    const counts = countByStatus(cards);
    const total = cards.length;
    const empty = total === 0;

    const segs = empty
      ? '<span class="b-empty"></span>'
      : [["passed", counts.passed], ["failed", counts.failed], ["blocked", counts.blocked]]
          .filter(([, n]) => n > 0)
          .map(([k, n]) => `<span class="b-${k}" style="flex-grow:${n}"></span>`)
          .join("") + (counts.passed + counts.failed + counts.blocked < total ? `<span class="b-empty" style="flex-grow:${total - counts.passed - counts.failed - counts.blocked}"></span>` : "");

    const stats = empty
      ? `<span class="cov-empty">no cards generated yet</span>`
      : [
          counts.passed ? `<span class="cov-tag t-pass"><i></i>${counts.passed} pass</span>` : "",
          counts.failed ? `<span class="cov-tag t-fail"><i></i>${counts.failed} fail</span>` : "",
          counts.blocked ? `<span class="cov-tag t-block"><i></i>${counts.blocked} blocked</span>` : "",
        ].filter(Boolean).join("");

    return `
      <article class="cov-card${empty ? " is-empty" : ""}">
        <div class="cov-head">
          <div class="cov-icon">${icon(group.icon)}</div>
          <div>
            <div class="cov-title">${group.title}</div>
            <div class="cov-scope">${esc(group.scope)}</div>
          </div>
          <div class="cov-count"><b>${total}</b><span>card${total === 1 ? "" : "s"}</span></div>
        </div>
        <div class="cov-bar">${segs}</div>
        <div class="cov-stats">${stats}</div>
      </article>`;
  }).join("");

  document.getElementById("coverage").innerHTML = html;
}

/* ============================================================================
   TEST RESULTS — dense list grouped by category
   ============================================================================ */
function renderTestCards(testCards) {
  const root = document.getElementById("test-cards");
  if (testCards.length === 0) {
    const cmd = `node --experimental-strip-types runner/audit.ts --name "${currentCampaign?.name ?? "My audit"}" --app-url ${currentCampaign?.appUrl ?? "https://your.app"} --repo /path/to/repo`;
    root.innerHTML = emptyState(
      "i-play", "No test cards yet",
      "From the fusion-launchaudit repo on your machine (LAUNCHAUDIT_API_URL pointed here), one command scans, generates, executes, and syncs:",
      cmd,
    );
    return;
  }

  // group by category, preserving first-seen order
  const order = [];
  const groups = new Map();
  for (const card of testCards) {
    if (!groups.has(card.category)) { groups.set(card.category, []); order.push(card.category); }
    groups.get(card.category).push(card);
  }

  root.innerHTML = order
    .map((cat) => {
      const cards = groups.get(cat);
      const counts = countByStatus(cards);
      const mini = [["passed", counts.passed], ["failed", counts.failed], ["blocked", counts.blocked]]
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `<span class="seg-${k}" style="flex-grow:${n}"></span>`)
        .join("");
      return `
        <div class="cat-group">
          <div class="cat-group-head">
            <span class="cat-name">${esc(categoryLabels[cat] || titleCase(cat))}</span>
            <span class="cat-mini-bar">${mini}</span>
            <span class="cat-meta">${cards.length} card${cards.length === 1 ? "" : "s"}</span>
          </div>
          ${cards.map(renderTestRow).join("")}
        </div>`;
    })
    .join("");
}

function renderTestRow(card) {
  const live = executedCardIds.has(card.id);
  return `
    <div class="trow">
      <div class="trow-status">
        <span class="spill s-${card.status}"><span class="sdot"></span>${esc(card.status)}</span>
      </div>
      <div class="trow-main">
        <div class="trow-idline">
          <span class="mono-id">${esc(card.id)}</span>
        </div>
        <div class="trow-title">${esc(card.title)}</div>
        <div class="trow-accept">
          <span class="ac-label">accept</span>
          <span>${esc(card.acceptanceCriteria)}</span>
        </div>
      </div>
      <div class="trow-side">
        <span class="risk-chip r-${card.risk}"><i></i>${esc(card.risk)}</span>
        <span class="exec-tag${live ? " is-live" : ""}">${live ? icon("i-check", 'width="11" height="11"') : ""}${live ? "executed" : "not run"}</span>
      </div>
    </div>`;
}

/* ============================================================================
   CONTEXT CONTRACT (runner view)
   ============================================================================ */
function renderContext(campaign, runnerTools) {
  const env = campaign.environment || {};
  document.getElementById("context-contract").innerHTML = `
    ${isSampleData ? `<div class="sample-note">Sample data — these values are a demo placeholder, not a real target.</div>` : ""}
    <div class="code-box"><span>Runtime target</span><code>${esc(campaign.appUrl)}</code></div>
    <div class="code-box"><span>Repo path (local)</span><code>${esc(campaign.repoPath || "—")}</code></div>
    <div class="mini-grid">
      <div><span>Framework</span><strong>${esc(env.framework || "—")}</strong></div>
      <div><span>Support tier</span><strong>${esc(env.supportTier || "—")}</strong></div>
      <div><span>Auth</span><strong>${esc(env.auth || "—")}</strong></div>
      <div><span>Scripts</span><strong>${esc((env.scripts || []).length)} declared</strong></div>
    </div>
    <div>
      <div class="section-label">MCP tool surface</div>
      <div class="tool-grid">${(runnerTools || []).map((t) => `<code>${esc(t.name)}</code>`).join("")}</div>
    </div>
    ${(env.unsupportedGaps || []).length ? `
    <div>
      <div class="section-label">Declared gaps</div>
      <div class="tool-grid">${env.unsupportedGaps.map((g) => `<code>${esc(g)}</code>`).join("")}</div>
    </div>` : ""}`;
}

/* ============================================================================
   INSPECTOR — runner truth, findings, repair packet
   ============================================================================ */
function renderInspector(campaign, findings, repairTasks) {
  document.getElementById("runner-truth").innerHTML = `
    ${isSampleData ? `<div class="sample-note">Sample data — no live runner is connected. Create a campaign to see real runner truth.</div>` : ""}
    <div><span>Host</span><strong>${esc(campaign.runner.host)}</strong></div>
    <div><span>Version</span><strong>${esc(campaign.runner.version)}</strong></div>
    <div><span>Status</span><strong class="kv-ok">${esc(campaign.runner.status)}</strong></div>
    <div><span>Last sync</span><strong>${esc(campaign.runner.lastSync)}</strong></div>`;

  const fc = document.getElementById("findings-count");
  if (fc) {
    fc.textContent = String(findings.length);
    fc.className = "badge " + (findings.length === 0 ? "badge-muted" : "badge-high");
  }

  const findingsEl = document.getElementById("findings");
  if (findings.length === 0) {
    findingsEl.innerHTML = emptyStateInline("No open findings", "Failures from executed cards land here with evidence attached.");
  } else {
    findingsEl.innerHTML = findings
      .map(
        (f) => `
        <article class="finding-card">
          <div class="badge-row">${badge(f.severity, severityTone[f.severity])}${badgeFlat(titleCase(f.type))}</div>
          <h3>${esc(f.title)}</h3>
          <p>${esc(f.summary)}</p>
          ${(f.evidenceRefs || []).length ? `<div class="evidence-refs">${f.evidenceRefs.map((r) => `<span class="eref">${icon("i-link")}${esc(r)}</span>`).join("")}</div>` : ""}
        </article>`,
      )
      .join("");
  }

  const repairEl = document.getElementById("repair-panel");
  const head = `<div class="panel-title-line">${icon("i-wrench")}<h2>Repair packet</h2><span class="spacer"></span>${repairTasks.length ? badge(`${repairTasks.length} queued`, "badge-accent") : ""}</div>`;
  if (repairTasks.length === 0) {
    repairEl.innerHTML = head + emptyStateInline("No repair packets", "Every product-bug finding generates a coding-agent-ready repair packet.");
    return;
  }
  const task = repairTasks[0];
  repairEl.innerHTML = head + `
    <div class="repair-meta-row">${badge(task.severity, severityTone[task.severity])}${task.finding_id ? `<span class="mono-id">${esc(task.finding_id)}</span>` : ""}</div>
    <h3>${esc(task.title)}</h3>
    <p>${esc(task.why_it_matters)}</p>
    <div class="repair-box">
      <span>Likely files</span>
      ${task.likely_files.map((f) => `<code>${esc(f)}</code>`).join("")}
    </div>
    <div class="verify-box">
      <span>Verification</span>
      <code><span class="vcaret">$</span> ${esc(task.verification_command)}</code>
    </div>`;
}

/* ============================================================================
   REPORTS — scorecard + flagship
   ============================================================================ */
function renderScorecard(scorecard) {
  document.getElementById("scorecard").innerHTML = scorecard
    .map(
      (item) => `
        <article class="tile">
          <div class="tile-top">
            <h3>${esc(item.category)}</h3>
            ${badge(titleCase(item.status), statusTone[item.status] || "badge-muted")}
          </div>
          <div class="tile-row"><span>TestSprite baseline</span><p>${esc(item.testspriteBaseline)}</p></div>
          <div class="tile-divider"></div>
          <div class="tile-row"><span>Fusion advantage</span><p>${esc(item.fusionAdvantage)}</p></div>
          <div class="tile-row"><span>Proof gate</span><p>${esc(item.proofGate)}</p></div>
        </article>`,
    )
    .join("");
}

function renderFlagshipFeatures(features) {
  document.getElementById("flagship-features").innerHTML = features
    .map(
      (f) => `
        <article class="tile">
          <div class="tile-top">
            <h3>${esc(f.name)}</h3>
            ${badgeFlat(f.sourceInspiredBy, "badge-info")}
          </div>
          <p class="tile-lede">${esc(f.fusionVersion)}</p>
          <div class="tile-row"><span>Why it matters</span><p>${esc(f.whyItMatters)}</p></div>
          <div class="tile-row"><span>Proof gate</span><p>${esc(f.proofGate)}</p></div>
          <div class="badge-row">${(f.evidence || []).map((e) => badgeFlat(e)).join("")}</div>
        </article>`,
    )
    .join("");
}

/* ============================================================================
   MODELS — routes + provider slots
   ============================================================================ */
function renderModelRouting(routes, providers) {
  const byId = Object.fromEntries(providers.map((p) => [p.id, p]));
  document.getElementById("model-routes").innerHTML = routes
    .map((route) => {
      const provider = byId[route.providerSlotId];
      const fallback = byId[route.fallbackProviderSlotId];
      return `
        <article class="tile">
          <div class="tile-top">
            <div><span class="mono-id">${esc(titleCase(route.task))}</span><h3>${esc(route.label)}</h3></div>
            ${badge(titleCase(provider?.kind || "unknown"), "badge-info")}
          </div>
          <div class="tile-split">
            <div class="tile-row">
              <span>Primary</span>
              <p>${esc(provider?.label || route.providerSlotId)}</p>
              <code>${esc(route.model)}</code>
            </div>
            <div class="tile-row">
              <span>Fallback</span>
              <p>${esc(fallback?.label || route.fallbackProviderSlotId)}</p>
              <code>temp ${esc(route.temperature)} · ${esc(route.maxTokens)} tok</code>
            </div>
          </div>
          <div class="tile-row"><span>Quality gate</span><p>${esc(route.qualityGate)}</p></div>
        </article>`;
    })
    .join("");
}

function renderProviderSlots(providers) {
  document.getElementById("provider-slots").innerHTML = providers
    .map(
      (p) => `
        <article class="finding-card">
          <div class="badge-row">
            <span class="mono-id">${esc(p.id)}</span>
            ${badge(titleCase(p.status), statusTone[p.status] || "badge-muted")}
          </div>
          <h3>${esc(p.label)}</h3>
          <div class="badge-row" style="margin-top:2px">
            ${badgeFlat(titleCase(p.kind), "badge-muted")}
            <code class="codechip" style="font-size:10px;color:var(--fg-3)">${esc(p.secretEnv)}</code>
          </div>
          <p>${esc(p.guardrail)}</p>
          <div class="badge-row">${(p.bestFor || []).map((t) => badgeFlat(titleCase(t))).join("")}</div>
        </article>`,
    )
    .join("");
}

/* ============================================================================
   PROJECTS — storage readiness + data contracts
   ============================================================================ */
function renderStorage(readiness, tables, artifacts) {
  document.getElementById("storage-readiness").innerHTML = readiness
    .map(
      (item) => `
        <article class="tile">
          <div class="tile-top">
            <div><span class="mono-id">${esc(item.subsystem)}</span><h3>${esc(item.label)}</h3></div>
            ${badge(titleCase(item.status), statusTone[item.status] || "badge-muted")}
          </div>
          <p class="tile-lede">${esc(item.purpose)}</p>
          <div class="tile-row"><span>Required env</span><p><code>${(item.requiredEnv || []).map(esc).join("</code> <code>")}</code></p></div>
          <div class="tile-row"><span>Production gate</span><p>${esc(item.productionGate)}</p></div>
        </article>`,
    )
    .join("");

  document.getElementById("database-tables").innerHTML = tables
    .map(
      (t) => `
        <article class="contract-row">
          <div class="contract-row-main"><h3>${esc(t.table)}</h3><p>${esc(t.purpose)}</p></div>
          ${badgeFlat(t.requiredForV1 ? "v1" : "later", t.requiredForV1 ? "badge-info" : "badge-muted")}
        </article>`,
    )
    .join("");

  document.getElementById("blob-artifacts").innerHTML = artifacts
    .map(
      (a) => `
        <article class="contract-row">
          <div class="contract-row-main"><h3>${esc(titleCase(a.artifactType))}</h3><p>${esc(a.pathTemplate)}</p></div>
          ${badgeFlat(a.access, a.access === "private" ? "badge-medium" : "badge-info")}
        </article>`,
    )
    .join("");
}

/* ============================================================================
   PERSISTENCE banner
   ============================================================================ */
function renderPersistence(persistence) {
  const el = document.getElementById("persistence-status");
  if (!el || !persistence) return;
  const live = persistence.mode === "postgres";
  el.textContent = live ? "postgres live" : "seeded mode";
  el.className = "badge " + (live ? "badge-success" : "badge-medium");
  el.title = persistence.detail || "";
}

/* ============================================================================
   NAV COUNTS
   ============================================================================ */
function renderNavCounts(data) {
  const counts = countByStatus(data.test_cards || []);
  const map = {
    campaigns: (data.test_cards || []).length,
    projects: (data.database_tables || []).length,
    runner: (data.runner_tools || []).length,
    reports: (data.competitive_scorecard || []).length,
    models: (data.model_routes || []).length,
  };
  for (const [view, n] of Object.entries(map)) {
    const el = document.querySelector(`[data-nav-count="${view}"]`);
    if (el) el.textContent = n ? String(n) : "";
  }
}

/* ============================================================================
   EMPTY STATES
   ============================================================================ */
function emptyState(iconId, title, body, command) {
  return `
    <div class="empty-state">
      <div class="es-icon">${icon(iconId)}</div>
      <h3>${esc(title)}</h3>
      <p>${esc(body)}</p>
      ${command ? `<code>${esc(command)}</code>` : ""}
    </div>`;
}
function emptyStateInline(title, body) {
  return `<div class="empty-state" style="margin:14px;padding:18px"><h3>${esc(title)}</h3><p>${esc(body)}</p></div>`;
}

/* ============================================================================
   DATA LOAD
   ============================================================================ */
async function loadCampaign(campaignId = selectedCampaignId()) {
  const response = await fetch(`/api/campaign${campaignId ? `?id=${encodeURIComponent(campaignId)}` : ""}`);
  if (!response.ok && response.status !== 404) throw new Error(`Campaign API failed: ${response.status}`);
  const data = await response.json();

  currentCampaign = data.campaign;
  executedCardIds = new Set(data.run_stats?.executedCardIds ?? []);

  // topbar
  document.getElementById("campaign-title").textContent = data.campaign.name;
  document.title = `${data.campaign.name} — LaunchAudit`;
  // Honesty: anything not durably stored in Postgres is seed/demo data. Flag it
  // plainly so a public visitor never reads sample numbers as a real audit.
  isSampleData = data.persistence?.mode !== "postgres";
  const sampleBadge = document.getElementById("sample-data-badge");
  if (sampleBadge) sampleBadge.hidden = !isSampleData;
  const idChip = document.getElementById("campaign-id-chip");
  if (idChip) idChip.textContent = data.campaign.id;
  const appUrlEl = document.getElementById("campaign-appurl");
  if (appUrlEl) appUrlEl.textContent = String(data.campaign.appUrl).replace(/^https?:\/\//, "");
  const meta = document.getElementById("runner-note-meta");
  if (meta) meta.textContent = `${data.campaign.runner.version} · ${data.campaign.runner.status}`;

  renderHero(data.campaign, data.test_cards, data.run_stats);
  renderMetrics(data.campaign, data.test_cards, data.findings, data.run_stats);
  renderCoverage(data.test_cards);
  renderTestCards(data.test_cards);
  renderContext(data.campaign, data.runner_tools);
  renderInspector(data.campaign, data.findings, data.repair_tasks);
  renderScorecard(data.competitive_scorecard || []);
  renderFlagshipFeatures(data.flagship_features || []);
  renderModelRouting(data.model_routes || [], data.model_provider_slots || []);
  renderProviderSlots(data.model_provider_slots || []);
  renderStorage(data.storage_readiness || [], data.database_tables || [], data.blob_artifacts || []);
  renderPersistence(data.persistence);
  renderNavCounts(data);
  return data;
}

function selectedCampaignId() {
  return localStorage.getItem("launch-audit-campaign") || "";
}

/* ---- theme boot ---- */
setTheme(localStorage.getItem("launch-audit-theme") === "light" ? "light" : "dark");
document.getElementById("theme-toggle").addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

/* ============================================================================
   MOTION — staggered reveals (GPU only). Counters handled by the gauge.
   ============================================================================ */
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function initReveals() {
  if (prefersReducedMotion) return;
  const groups = [".metric-card", ".cov-card", ".cat-group", ".tile", ".finding-card", ".contract-row", ".panel"];
  const seen = new Set();
  for (const selector of groups) {
    const nodes = [...document.querySelectorAll(selector)].filter((n) => !seen.has(n));
    nodes.forEach((node, i) => {
      seen.add(node);
      node.classList.add("reveal");
      node.style.setProperty("--reveal-delay", `${Math.min(i, 7) * 45}ms`);
    });
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) { entry.target.classList.add("in-view"); observer.unobserve(entry.target); }
      }
    },
    { rootMargin: "0px 0px -30px 0px", threshold: 0.05 },
  );
  for (const node of seen) observer.observe(node);
}

function initMotion() { initReveals(); }

/* ============================================================================
   VIEW ROUTER
   ============================================================================ */
const VIEW_NAMES = ["campaigns", "projects", "runner", "reports", "models"];

function currentView() {
  const candidate = window.location.hash.replace(/^#\/?/, "");
  return VIEW_NAMES.includes(candidate) ? candidate : "campaigns";
}

function applyView() {
  const view = currentView();
  for (const node of document.querySelectorAll("[data-view]")) {
    const show = node.dataset.view.split(" ").includes(view);
    node.hidden = !show;
    if (show) {
      node.classList.remove("view-enter");
      void node.offsetWidth;
      node.classList.add("view-enter");
      for (const child of node.querySelectorAll(".reveal")) child.classList.add("in-view");
      if (node.classList.contains("reveal")) node.classList.add("in-view");
    }
  }
  for (const link of document.querySelectorAll("#main-nav .nav-item")) {
    link.classList.toggle("nav-active", link.dataset.nav === view);
  }
  const inspector = document.querySelector(".inspector");
  const inspectorVisible = [...inspector.querySelectorAll("[data-view]")].some((n) => !n.hidden);
  inspector.hidden = !inspectorVisible;
  document.querySelector(".content-grid").classList.toggle("no-inspector", !inspectorVisible);
  window.scrollTo({ top: 0, behavior: "auto" });
}

function initRouter() {
  window.addEventListener("hashchange", applyView);
  applyView();
}

/* ============================================================================
   CAMPAIGN SWITCHER + CREATION
   ============================================================================ */
async function initCampaignSwitcher(data) {
  const switcher = document.getElementById("campaign-switcher");
  if (data.persistence?.mode !== "postgres") { switcher.hidden = true; return; }
  try {
    const response = await fetch("/api/campaigns");
    if (!response.ok) return;
    const { campaigns } = await response.json();
    if (!campaigns || campaigns.length === 0) return;
    const current = currentCampaign?.id;
    switcher.innerHTML = campaigns
      .map((c) => `<option value="${esc(c.id)}" ${c.id === current ? "selected" : ""}>${esc(c.name)} · ${esc(String(c.readinessScore))}/100</option>`)
      .join("");
    switcher.hidden = false;
    switcher.onchange = async () => {
      localStorage.setItem("launch-audit-campaign", switcher.value);
      await reloadCampaignData(switcher.value);
    };
  } catch { switcher.hidden = true; }
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
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.classList.remove("open"); });

  document.getElementById("new-campaign-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("nc-error");
    errorBox.hidden = true;
    const payload = {
      name: document.getElementById("nc-name").value.trim(),
      app_url: document.getElementById("nc-url").value.trim(),
      repo_path_hint: document.getElementById("nc-repo").value.trim() || undefined,
    };
    const postCampaign = (secret) => fetch("/api/campaigns", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(secret ? { "x-runner-secret": secret } : {}),
      },
      body: JSON.stringify(payload),
    });
    try {
      let response = await postCampaign(localStorage.getItem("launch-audit-operator-key") || "");
      // A deployed dashboard gates creation behind the operator secret. Prompt
      // once, store it locally, and retry — anonymous visitors stay blocked.
      if (response.status === 401) {
        const key = window.prompt("Operator key required to create campaigns (RUNNER_SYNC_SECRET):", "");
        if (!key) {
          errorBox.textContent = "Campaign creation requires the operator key.";
          errorBox.hidden = false;
          return;
        }
        localStorage.setItem("launch-audit-operator-key", key.trim());
        response = await postCampaign(key.trim());
      }
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) localStorage.removeItem("launch-audit-operator-key");
        errorBox.textContent = result.error || `Creation failed (${response.status})${result.hint ? ` — ${result.hint}` : ""}`;
        errorBox.hidden = false;
        return;
      }
      localStorage.setItem("launch-audit-campaign", result.id);
      backdrop.classList.remove("open");
      window.location.hash = "#/campaigns";
      await reloadCampaignData(result.id);
    } catch (err) {
      errorBox.textContent = String(err);
      errorBox.hidden = false;
    }
  });

  document.getElementById("export-report-btn").addEventListener("click", () => {
    const id = currentCampaign?.id ?? "";
    window.open(`/report${id ? `?campaign=${encodeURIComponent(id)}` : ""}`, "_blank");
  });
}

/* ============================================================================
   QUICKSTART MODALS — honest commands, no fake spinners
   ============================================================================ */
const MODALS = {
  "start-campaign": {
    title: "Start a campaign",
    sub: "LaunchAudit runs through your own coding agent — your Claude does the planning, the local runner keeps your code private, this command center stores the evidence.",
    steps: [
      { h: "Add the LaunchAudit MCP server to Claude Code", p: "From the fusion-launchaudit repo folder (after npm install):", code: "claude mcp add launchaudit -- node --experimental-strip-types ./runner/mcp-server.ts" },
      { h: "Ask your agent to plan the audit", p: "In Claude Code, point it at your project:", code: "Scan ~/my-app with launchaudit_scan_repo, then write evidence-gated test cards per launchaudit_get_test_card_contract and sync them." },
      { h: "Or run the full audit in one command", p: "Scan, generate, create campaign, execute in a real browser, sync evidence:", code: 'node --experimental-strip-types runner/audit.ts --name "My app" --app-url https://my.app --repo ~/my-app' },
      { h: "Auth-gated flows", p: "Login flows need locally captured auth state (qa.capture_auth_state) — credentials never touch this web app. Capture ships with the auth layer and is declared blocked until then." },
    ],
    note: "Honest status: test cards sync and persist today. Playwright execution of approved cards is the next production layer — nothing here pretends to run tests it didn't run.",
  },
};

function escapeAttr(v) { return esc(String(v)); }

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
            <h3>${esc(s.h)}</h3>
            <p>${esc(s.p)}</p>
            ${s.code ? `<code class="modal-code">${esc(s.code)}<button class="modal-copy" data-copy="${escapeAttr(s.code)}" type="button">Copy</button></code>` : ""}
          </div>
        </div>`,
      )
      .join("") + `<div class="modal-note">${esc(def.note)}</div>`;
  document.getElementById("modal-backdrop").classList.add("open");
}

function closeModal() { document.getElementById("modal-backdrop").classList.remove("open"); }

function initModals() {
  document.getElementById("run-audit-btn")?.addEventListener("click", () => openModal("start-campaign"));
  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal-backdrop").addEventListener("click", (e) => {
    if (e.target === document.getElementById("modal-backdrop")) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeModal(); document.getElementById("new-campaign-backdrop").classList.remove("open"); }
  });
  document.getElementById("modal-body").addEventListener("click", async (e) => {
    const btn = e.target.closest(".modal-copy");
    if (!btn) return;
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.textContent = "Copied";
      setTimeout(() => { btn.textContent = "Copy"; }, 1400);
    } catch { btn.textContent = "Select + copy"; }
  });
}

/* ============================================================================
   BOOT
   ============================================================================ */
loadCampaign()
  .then((data) => {
    initMotion();
    initRouter();
    initModals();
    initNewCampaign();
    initCampaignSwitcher(data);
  })
  .catch((error) => {
    document.getElementById("metrics").innerHTML =
      `<article class="metric-card"><div class="metric-value">Load failed</div><p>${esc(error.message)}</p></article>`;
  });
