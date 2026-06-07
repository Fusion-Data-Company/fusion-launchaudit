import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { competitiveScorecard } from "../src/lib/competitive-data.ts";
import { campaign, categoryLabels, findings, repairTasks, stages, testCards } from "../src/lib/campaign-data.ts";
import { flagshipFeatures, healEvents, trafficInsights } from "../src/lib/flagship-features.ts";
import { modelProviderSlots, modelRoutes, modelTaskContracts } from "../src/lib/model-routing.ts";
import { runnerTools, type RunnerSyncPayload } from "../src/lib/mcp-runner-contract.ts";
import {
  blobArtifacts,
  databaseTables,
  getStorageRuntimeReadiness,
  storageReadiness,
  storageSchemaSql,
} from "../src/lib/storage-contract.ts";
import { getSqlClient } from "../src/lib/db.ts";
import {
  ensureCampaignReady,
  loadCampaignBundle,
  recordRunnerSync,
  registerArtifactRecord,
  type ArtifactRegistration as StoreArtifactRegistration,
} from "../src/lib/campaign-store.ts";

const host = "127.0.0.1";
const port = Number(process.env.PORT ?? 3010);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function json(response: http.ServerResponse, statusCode: number, data: unknown) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(data, null, 2));
}

async function readJsonBody<T>(request: http.IncomingMessage): Promise<Partial<T>> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Partial<T>;
}

function hasRequiredSyncShape(body: Partial<RunnerSyncPayload>): body is RunnerSyncPayload {
  return Boolean(
    body.campaign_id &&
      body.runner_host &&
      body.repo_summary?.framework &&
      body.runtime_summary?.app_url &&
      Array.isArray(body.test_cards) &&
      Array.isArray(body.artifact_refs),
  );
}

type ArtifactRegistrationPayload = {
  campaign_id: string;
  run_id: string;
  test_card_id: string;
  artifact_type: string;
  filename: string;
  sha256: string;
};

function safeSegment(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function artifactPath(body: ArtifactRegistrationPayload) {
  return `campaigns/${safeSegment(body.campaign_id)}/runs/${safeSegment(body.run_id)}/${safeSegment(body.artifact_type)}/${safeSegment(body.test_card_id)}-${safeSegment(body.filename)}`;
}

function badge(text: string, tone = "badge-muted") {
  return `<span class="badge ${tone}">${escapeHtml(text)}</span>`;
}

function renderPage() {
  const passed = testCards.filter((card) => card.status === "passed").length;
  const failed = testCards.filter((card) => card.status === "failed").length;
  const blocked = testCards.filter((card) => card.status === "blocked").length;
  const primaryRepairTask = repairTasks[0];

  const stageMarkup = stages
    .map(
      (stage, index) => `
        <div class="stage">
          <div class="stage-line">
            <div class="stage-dot stage-${stage.status}">${stage.status === "complete" ? "✓" : index + 1}</div>
            <div class="stage-rule"></div>
          </div>
          <div class="stage-label">${escapeHtml(stage.label)}</div>
          <div class="stage-detail">${escapeHtml(stage.detail)}</div>
        </div>
      `,
    )
    .join("");

  const testCardsMarkup = testCards
    .map(
      (card) => `
        <article class="test-card">
          <div class="test-card-top">
            <div>
              <div class="badge-row">
                <span class="mono-id">${escapeHtml(card.id)}</span>
                ${badge(categoryLabels[card.category])}
                ${badge(card.risk, `badge-${card.risk === "critical" ? "critical" : card.risk}`)}
                ${badge(card.status, card.status === "passed" ? "badge-success" : card.status === "blocked" ? "badge-medium" : card.status === "failed" ? "badge-high" : "badge-muted")}
              </div>
              <h3>${escapeHtml(card.title)}</h3>
            </div>
            <span class="arrow">→</span>
          </div>
          <p>${escapeHtml(card.goal)}</p>
          <div class="test-detail-grid">
            <div>
              <span>Evidence gate</span>
              <p>${escapeHtml(card.expectedEvidence.join(", "))}</p>
            </div>
            <div>
              <span>Acceptance</span>
              <p>${escapeHtml(card.acceptanceCriteria)}</p>
            </div>
          </div>
        </article>
      `,
    )
    .join("");

  const findingsMarkup = findings
    .map(
      (finding) => `
        <article class="finding-card">
          <div class="badge-row">
            ${badge(finding.severity, `badge-${finding.severity === "critical" ? "critical" : finding.severity}`)}
            ${badge(finding.type.replaceAll("_", " "))}
          </div>
          <h3>${escapeHtml(finding.title)}</h3>
          <p>${escapeHtml(finding.summary)}</p>
        </article>
      `,
    )
    .join("");

  const likelyFilesMarkup = primaryRepairTask.likely_files.map((file) => `<code>${escapeHtml(file)}</code>`).join("");
  const toolMarkup = runnerTools.map((tool) => `<code>${escapeHtml(tool.name)}</code>`).join("");

  return `<!doctype html>
<html lang="en" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LaunchAudit Campaign OS</title>
    <link rel="stylesheet" href="/assets/app.css" />
  </head>
  <body>
    <main class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">LA</div>
          <div>
            <div class="brand-name">LaunchAudit</div>
            <div class="brand-subtitle">Campaign OS</div>
          </div>
        </div>
        <nav class="nav-list">
          <a class="nav-item nav-active" href="#">Campaigns</a>
          <a class="nav-item" href="#">Projects</a>
          <a class="nav-item" href="#">Runner</a>
          <a class="nav-item" href="#">Evidence</a>
          <a class="nav-item" href="#">Reports</a>
        </nav>
        <div class="runner-note">
          <div class="runner-note-title">Local MCP Runner</div>
          <p>Executes repo inspection, auth capture, Playwright runs, and artifact sync from the user machine.</p>
          ${badge(campaign.runner.status, "badge-success")}
        </div>
      </aside>
      <section class="workspace">
        <header class="topbar">
          <div>
            <div class="title-row">
              <h1>${escapeHtml(campaign.name)}</h1>
              ${badge(campaign.depth, "badge-info")}
            </div>
            <p>Repo + runtime truth turned into launch evidence, findings, and repair work.</p>
          </div>
          <div class="actions">
            <button class="btn btn-secondary theme-toggle" id="theme-toggle" type="button">Light</button>
            <button class="btn btn-secondary" type="button">Capture auth</button>
            <button class="btn btn-primary" type="button">Start campaign</button>
          </div>
        </header>
        <div class="content-grid">
          <div class="main-column">
            <section class="metric-grid">
              <article class="metric-card"><div class="metric-top"><span>Readiness</span><b>Score</b></div><strong>${campaign.readinessScore}/100</strong><p>Blocked by 2 launch issues</p></article>
              <article class="metric-card"><div class="metric-top"><span>Tests</span><b>Cards</b></div><strong>${passed} pass / ${failed} fail</strong><p>${blocked} blocked check declared</p></article>
              <article class="metric-card"><div class="metric-top"><span>Findings</span><b>Risk</b></div><strong>${findings.length}</strong><p>2 product bugs, 1 environment issue</p></article>
              <article class="metric-card"><div class="metric-top"><span>Artifacts</span><b>Proof</b></div><strong>18</strong><p>Screenshots, traces, network logs</p></article>
            </section>
            <section class="panel">
              <div class="panel-heading">
                <div><h2>Campaign spine</h2><p>One run ID ties web review, MCP execution, artifacts, and report proof together.</p></div>
                ${badge("report_ready", "badge-success")}
              </div>
              <div class="stage-grid">${stageMarkup}</div>
            </section>
            <section class="lower-grid">
              <div class="panel">
                <div class="panel-title-line"><h2>Context contract</h2><span class="accent-dot"></span></div>
                <div class="contract-stack">
                  <div class="code-box"><span>Runtime URL</span><code>${escapeHtml(campaign.appUrl)}</code></div>
                  <div class="code-box"><span>Repo path</span><code>${escapeHtml(campaign.repoPath)}</code></div>
                  <div class="mini-grid">
                    <div><span>Support tier</span><strong>${escapeHtml(campaign.environment.supportTier)}</strong></div>
                    <div><span>Auth</span><strong>${escapeHtml(campaign.environment.auth)}</strong></div>
                  </div>
                  <div><div class="section-label">MCP tool surface</div><div class="tool-grid">${toolMarkup}</div></div>
                </div>
              </div>
              <div class="panel">
                <div class="panel-heading">
                  <div><h2>Generated test cards</h2><p>Specific, evidence-gated checks instead of generic smoke tests.</p></div>
                  ${badge("reviewed", "badge-info")}
                </div>
                <div class="test-card-list">${testCardsMarkup}</div>
              </div>
            </section>
          </div>
          <aside class="inspector">
            <section class="panel">
              <div class="panel-title-line"><h2>Runner truth</h2><span class="accent-dot"></span></div>
              <div class="kv-list">
                <div><span>Host</span><strong>${escapeHtml(campaign.runner.host)}</strong></div>
                <div><span>Version</span><strong>${escapeHtml(campaign.runner.version)}</strong></div>
                <div><span>Last sync</span><strong>${escapeHtml(campaign.runner.lastSync)}</strong></div>
              </div>
            </section>
            <section class="panel">
              <div class="panel-title-line"><h2>Findings</h2><span class="accent-dot"></span></div>
              <div class="finding-list">${findingsMarkup}</div>
            </section>
            <section class="repair-panel">
              <div class="panel-title-line"><h2>Repair packet</h2><span class="accent-dot cayenne"></span></div>
              <h3>${escapeHtml(primaryRepairTask.title)}</h3>
              <p>${escapeHtml(primaryRepairTask.why_it_matters)}</p>
              <div class="repair-box"><span>Likely files</span>${likelyFilesMarkup}</div>
              <div class="verify-box"><span>Verification</span><code>${escapeHtml(primaryRepairTask.verification_command)}</code></div>
            </section>
          </aside>
        </div>
      </section>
    </main>
    <script>
      const button = document.getElementById("theme-toggle");
      const saved = localStorage.getItem("launch-audit-theme");
      const initial = saved === "light" ? "light" : "dark";
      document.documentElement.dataset.theme = initial;
      button.textContent = initial === "dark" ? "Light" : "Dark";
      button.addEventListener("click", () => {
        const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        localStorage.setItem("launch-audit-theme", next);
        button.textContent = next === "dark" ? "Light" : "Dark";
      });
    </script>
  </body>
</html>`;
}

async function main() {
  const server = http.createServer(async (request, response) => {
    if (!request.url) {
      json(response, 400, { error: "Missing request URL." });
      return;
    }

    if (request.method === "GET" && (request.url === "/" || request.url === "/index.html")) {
      const html = await fs.readFile(path.join(rootDir, "public/index.html"), "utf8");
      response.writeHead(200, { "content-type": "text/html" });
      response.end(html);
      return;
    }

    if (request.method === "GET" && request.url === "/assets/app.css") {
      const css = await fs.readFile(path.join(rootDir, "public/assets/app.css"), "utf8");
      response.writeHead(200, { "content-type": "text/css" });
      response.end(css);
      return;
    }

    if (request.method === "GET" && request.url === "/assets/app.js") {
      const js = await fs.readFile(path.join(rootDir, "public/assets/app.js"), "utf8");
      response.writeHead(200, { "content-type": "text/javascript" });
      response.end(js);
      return;
    }

    if (request.method === "GET" && request.url === "/api/campaign") {
      let liveCampaign = campaign;
      let liveTestCards = testCards;
      let liveFindings = findings;
      let liveRepairTasks = repairTasks;
      let persistence: Record<string, unknown> = {
        mode: "seeded",
        detail: "POSTGRES_URL is not configured; serving seeded campaign data.",
      };

      const sql = await getSqlClient();
      if (sql) {
        try {
          await ensureCampaignReady(sql);
          const bundle = await loadCampaignBundle(sql);
          if (bundle) {
            liveCampaign = bundle.campaign;
            liveTestCards = bundle.testCards;
            liveFindings = bundle.findings;
            liveRepairTasks = bundle.repairTasks;
            persistence = bundle.persistence;
          }
        } catch (error) {
          persistence = {
            mode: "seeded",
            detail: `Postgres unavailable (${error instanceof Error ? error.message : "unknown error"}); serving seeded fallback.`,
          };
        }
      }

      json(response, 200, {
        campaign: liveCampaign,
        stages,
        test_cards: liveTestCards,
        findings: liveFindings,
        repair_tasks: liveRepairTasks,
        runner_tools: runnerTools,
        competitive_scorecard: competitiveScorecard,
        flagship_features: flagshipFeatures,
        traffic_insights: trafficInsights,
        heal_events: healEvents,
        model_provider_slots: modelProviderSlots,
        model_routes: modelRoutes,
        model_task_contracts: modelTaskContracts,
        storage_readiness: storageReadiness,
        database_tables: databaseTables,
        blob_artifacts: blobArtifacts,
        storage_schema_sql: storageSchemaSql,
        persistence,
      });
      return;
    }

    if (request.method === "GET" && request.url === "/api/model-routing") {
      json(response, 200, {
        model_provider_slots: modelProviderSlots,
        model_routes: modelRoutes,
        model_task_contracts: modelTaskContracts,
      });
      return;
    }

    if (request.method === "GET" && request.url === "/api/storage/readiness") {
      json(response, 200, {
        storage_readiness: getStorageRuntimeReadiness(process.env),
        database_tables: databaseTables,
        blob_artifacts: blobArtifacts,
      });
      return;
    }

    if (request.method === "GET" && request.url === "/api/storage/schema") {
      json(response, 200, {
        schema_sql: storageSchemaSql,
        tables: databaseTables,
      });
      return;
    }

    if (request.method === "POST" && request.url === "/api/storage/register-artifact") {
      const body = await readJsonBody<ArtifactRegistrationPayload>(request);
      const requiredFields = ["campaign_id", "run_id", "test_card_id", "artifact_type", "filename", "sha256"] as const;
      const missing = requiredFields.filter((field) => !body[field]);

      if (missing.length > 0) {
        json(response, 400, {
          accepted: false,
          error: "Artifact registration payload is incomplete.",
          missing,
        });
        return;
      }

      const completeBody = body as ArtifactRegistrationPayload;
      const blobPath = artifactPath(completeBody);

      let persistence: Record<string, unknown> = {
        mode: "seeded",
        detail: "POSTGRES_URL is not configured; artifact contract validated but not durably stored.",
      };

      const sql = await getSqlClient();
      if (sql) {
        try {
          await ensureCampaignReady(sql);
          const result = await registerArtifactRecord(sql, completeBody as StoreArtifactRegistration, blobPath);
          persistence = { mode: "postgres", ...result };
        } catch (error) {
          persistence = {
            mode: "postgres",
            persisted: false,
            reason: error instanceof Error ? error.message : "Unknown persistence failure.",
          };
        }
      }

      json(response, 200, {
        accepted: true,
        campaign_id: completeBody.campaign_id,
        run_id: completeBody.run_id,
        artifact_ref: `blob://${blobPath}`,
        upload: {
          mode: process.env.BLOB_READ_WRITE_TOKEN ? "vercel_blob_ready" : "contract_only_missing_blob_token",
          path: blobPath,
          access: "private",
        },
        persistence,
      });
      return;
    }

    if (request.method === "POST" && request.url === "/api/runner/sync") {
      const body = await readJsonBody<RunnerSyncPayload>(request);

      if (!hasRequiredSyncShape(body)) {
        json(response, 400, {
          accepted: false,
          error:
            "Runner sync payload must include campaign_id, runner_host, repo_summary, runtime_summary, test_cards, and artifact_refs.",
        });
        return;
      }

      let persistence: Record<string, unknown> = {
        mode: "seeded",
        detail: "POSTGRES_URL is not configured; sync accepted but not durably stored.",
      };

      const sql = await getSqlClient();
      if (sql) {
        try {
          await ensureCampaignReady(sql);
          const result = await recordRunnerSync(sql, body);
          persistence = {
            mode: "postgres",
            session_id: result.sessionId,
            cards_updated: result.cardsUpdated,
            cards_unknown: result.cardsUnknown,
          };
        } catch (error) {
          persistence = {
            mode: "postgres",
            error: error instanceof Error ? error.message : "Unknown persistence failure.",
          };
        }
      }

      json(response, 200, {
        accepted: true,
        campaign_id: body.campaign_id,
        synced_at: new Date().toISOString(),
        scan_mode: body.scan_mode ?? "seeded_simulation",
        normalized: {
          framework: body.repo_summary.framework,
          app_url: body.runtime_summary.app_url,
          cards_received: body.test_cards.length,
          artifacts_received: body.artifact_refs.length,
        },
        persistence,
      });
      return;
    }

    json(response, 404, { error: "Not found." });
  });

  server.listen(port, host, () => {
    console.log(`LaunchAudit dev server ready at http://${host}:${port}`);
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
