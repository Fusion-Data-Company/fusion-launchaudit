import type { Campaign, Finding, RepairTask, TestCard } from "./campaign-data.ts";
import { campaign as seededCampaign, findings as seededFindings, repairTasks as seededRepairTasks, testCards as seededTestCards } from "./campaign-data.ts";
import type { RunnerSyncPayload } from "./mcp-runner-contract.ts";
import type { SqlClient } from "./db.ts";
import { storageSchemaSql } from "./storage-contract.ts";

export type PersistenceInfo = {
  mode: "postgres" | "seeded";
  detail: string;
};

const SEED_PROJECT_ID = "proj_local_001";
const SEED_OWNER_ID = "owner_fusion_rob";

function safeSegment(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

export async function ensureSchema(sql: SqlClient): Promise<void> {
  const statements = storageSchemaSql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

  for (const statement of statements) {
    await sql(statement);
  }
}

let readyPromise: Promise<void> | null = null;

export function ensureCampaignReady(sql: SqlClient): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      await ensureSchema(sql);
      await seedCampaignData(sql);
    })().catch((error: unknown) => {
      readyPromise = null;
      throw error;
    });
  }
  return readyPromise;
}

export async function seedCampaignData(sql: SqlClient): Promise<void> {
  await sql(
    `insert into projects (id, owner_id, repo_path_hint, framework, support_tier)
     values ($1, $2, $3, $4, $5)
     on conflict (id) do nothing`,
    [SEED_PROJECT_ID, SEED_OWNER_ID, seededCampaign.repoPath, seededCampaign.environment.framework, seededCampaign.environment.supportTier],
  );

  await sql(
    `insert into campaigns (id, project_id, status, app_url, depth, readiness_score)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (id) do nothing`,
    [seededCampaign.id, SEED_PROJECT_ID, seededCampaign.status, seededCampaign.appUrl, seededCampaign.depth, seededCampaign.readinessScore],
  );

  for (const card of seededTestCards) {
    await sql(
      `insert into test_cards (id, campaign_id, category, risk, status, title, goal, steps, expected_evidence, data_needs, acceptance_criteria)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (id) do nothing`,
      [
        card.id,
        seededCampaign.id,
        card.category,
        card.risk,
        card.status,
        card.title,
        card.goal,
        JSON.stringify(card.steps),
        JSON.stringify(card.expectedEvidence),
        JSON.stringify(card.dataNeeds),
        card.acceptanceCriteria,
      ],
    );
  }

  for (const finding of seededFindings) {
    await sql(
      `insert into findings (id, campaign_id, test_card_id, type, severity, title, summary, evidence_refs)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (id) do nothing`,
      [
        finding.id,
        seededCampaign.id,
        finding.testCardId,
        finding.type,
        finding.severity,
        finding.title,
        finding.summary,
        JSON.stringify(finding.evidenceRefs),
      ],
    );
  }

  for (const task of seededRepairTasks) {
    await sql(
      `insert into repair_tasks (id, finding_id, severity, title, why_it_matters, evidence_refs, likely_files, reproduction_steps, expected_behavior, verification_command, agent_prompt)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (id) do nothing`,
      [
        `rt_${task.finding_id}`,
        task.finding_id,
        task.severity,
        task.title,
        task.why_it_matters,
        JSON.stringify(task.evidence_refs),
        JSON.stringify(task.likely_files),
        JSON.stringify(task.reproduction_steps),
        task.expected_behavior,
        task.verification_command,
        task.agent_prompt,
      ],
    );
  }
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export type RunStats = {
  runs: number;
  artifacts: number;
  executedCardIds: string[];
};

export type CampaignBundle = {
  campaign: Campaign;
  testCards: TestCard[];
  findings: Finding[];
  repairTasks: RepairTask[];
  persistence: PersistenceInfo;
  runStats: RunStats;
};

export async function loadCampaignBundle(sql: SqlClient, campaignId: string = seededCampaign.id): Promise<CampaignBundle | null> {
  const campaignRows = await sql(
    `select id, status, app_url, depth, readiness_score, updated_at from campaigns where id = $1`,
    [campaignId],
  );

  if (campaignRows.length === 0) {
    return null;
  }

  const row = campaignRows[0];

  const sessionRows = await sql(
    `select runner_host, version, last_sync_at from runner_sessions where campaign_id = $1 order by last_sync_at desc nulls last limit 1`,
    [campaignId],
  );

  const cardRows = await sql(
    `select id, category, risk, status, title, goal, steps, expected_evidence, data_needs, acceptance_criteria
     from test_cards where campaign_id = $1 order by id`,
    [campaignId],
  );

  const findingRows = await sql(
    `select id, test_card_id, type, severity, title, summary, evidence_refs from findings where campaign_id = $1 order by id`,
    [campaignId],
  );

  const repairRows = await sql(
    `select finding_id, severity, title, why_it_matters, evidence_refs, likely_files, reproduction_steps, expected_behavior, verification_command, agent_prompt
     from repair_tasks order by id`,
  );

  const session = sessionRows[0];

  const campaign: Campaign = {
    ...seededCampaign,
    id: String(row.id),
    status: String(row.status) as Campaign["status"],
    appUrl: String(row.app_url),
    readinessScore: Number(row.readiness_score),
    runner: {
      ...seededCampaign.runner,
      host: session ? String(session.runner_host) : seededCampaign.runner.host,
      version: session ? String(session.version) : seededCampaign.runner.version,
      lastSync: session?.last_sync_at ? new Date(String(session.last_sync_at)).toISOString() : "never",
      status: session?.last_sync_at ? "connected" : "offline",
    },
  };

  const testCards: TestCard[] = cardRows.map((card) => ({
    id: String(card.id),
    title: String(card.title),
    category: String(card.category) as TestCard["category"],
    status: String(card.status) as TestCard["status"],
    risk: String(card.risk) as TestCard["risk"],
    goal: String(card.goal),
    steps: asStringArray(card.steps),
    expectedEvidence: asStringArray(card.expected_evidence),
    dataNeeds: asStringArray(card.data_needs),
    acceptanceCriteria: String(card.acceptance_criteria),
  }));

  const findings: Finding[] = findingRows.map((finding) => ({
    id: String(finding.id),
    type: String(finding.type) as Finding["type"],
    severity: String(finding.severity) as Finding["severity"],
    title: String(finding.title),
    testCardId: String(finding.test_card_id ?? ""),
    summary: String(finding.summary),
    evidenceRefs: asStringArray(finding.evidence_refs),
  }));

  const repairTasks: RepairTask[] = repairRows.map((task) => ({
    finding_id: String(task.finding_id),
    severity: String(task.severity) as RepairTask["severity"],
    title: String(task.title),
    why_it_matters: String(task.why_it_matters),
    evidence_refs: asStringArray(task.evidence_refs),
    likely_files: asStringArray(task.likely_files),
    reproduction_steps: asStringArray(task.reproduction_steps),
    expected_behavior: String(task.expected_behavior),
    verification_command: String(task.verification_command),
    agent_prompt: String(task.agent_prompt),
  }));

  const runRows = await sql(
    `select count(*)::int as runs, count(distinct test_card_id)::int as executed from runs where campaign_id = $1`,
    [campaignId],
  );
  const executedRows = await sql(
    `select distinct test_card_id from runs where campaign_id = $1`,
    [campaignId],
  );
  const artifactRows = await sql(`select count(*)::int as n from artifacts`);

  return {
    campaign,
    testCards,
    findings,
    repairTasks,
    runStats: {
      runs: Number(runRows[0]?.runs ?? 0),
      artifacts: Number(artifactRows[0]?.n ?? 0),
      executedCardIds: executedRows.map((row) => String(row.test_card_id)),
    },
    persistence: {
      mode: "postgres",
      detail: "Campaign state loaded from Postgres. Presentation-only fields (name, stages, environment metadata) remain seed-configured until campaign creation UI ships.",
    },
  };
}

export type RunnerSyncResult = {
  sessionId: string;
  cardsUpdated: number;
  cardsInserted: number;
  readiness: number;
};

export async function recordRunnerSync(sql: SqlClient, payload: RunnerSyncPayload): Promise<RunnerSyncResult> {
  const sessionId = `rs_${safeSegment(payload.campaign_id)}_${safeSegment(payload.runner_host)}`;

  await sql(
    `insert into runner_sessions (id, campaign_id, runner_host, version, last_sync_at)
     values ($1, $2, $3, $4, now())
     on conflict (id) do update set last_sync_at = now(), version = excluded.version`,
    [sessionId, payload.campaign_id, payload.runner_host, payload.build_sha ?? "unknown"],
  );

  let cardsUpdated = 0;
  let cardsInserted = 0;

  for (const card of payload.test_cards) {
    const inserted = await sql(
      `insert into test_cards (id, campaign_id, category, risk, status, title, goal, steps, expected_evidence, data_needs, acceptance_criteria)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (id) do update set
         status = excluded.status,
         title = excluded.title,
         risk = excluded.risk,
         goal = case when excluded.goal <> '' then excluded.goal else test_cards.goal end,
         steps = case when excluded.steps <> '[]'::jsonb then excluded.steps else test_cards.steps end,
         expected_evidence = case when excluded.expected_evidence <> '[]'::jsonb then excluded.expected_evidence else test_cards.expected_evidence end,
         acceptance_criteria = case when excluded.acceptance_criteria <> '' then excluded.acceptance_criteria else test_cards.acceptance_criteria end
       returning (xmax = 0) as inserted`,
      [
        card.id,
        payload.campaign_id,
        card.category,
        card.risk,
        card.status,
        card.title,
        card.goal ?? "",
        JSON.stringify(card.steps ?? []),
        JSON.stringify(card.expectedEvidence ?? []),
        JSON.stringify(card.dataNeeds ?? []),
        card.acceptanceCriteria ?? "",
      ],
    );
    if (inserted[0]?.inserted) cardsInserted += 1;
    else cardsUpdated += 1;
  }

  for (const run of payload.run_results ?? []) {
    await sql(
      `insert into runs (id, campaign_id, test_card_id, status, started_at, ended_at)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (id) do update set status = excluded.status, ended_at = excluded.ended_at`,
      [run.run_id, payload.campaign_id, run.test_card_id, run.status, run.started_at, run.ended_at],
    );
  }

  for (const finding of payload.findings ?? []) {
    await sql(
      `insert into findings (id, campaign_id, test_card_id, type, severity, title, summary, evidence_refs)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (id) do update set summary = excluded.summary, severity = excluded.severity, evidence_refs = excluded.evidence_refs`,
      [finding.id, payload.campaign_id, finding.test_card_id, finding.type, finding.severity, finding.title, finding.summary, JSON.stringify(finding.evidence_refs)],
    );
  }

  // Readiness score: computed from real card statuses, transparent formula.
  // passed / (passed + failed + blocked) over executed-or-blocked cards; ready/running excluded.
  const scoreRows = await sql(
    `select
       count(*) filter (where status = 'passed')::int as passed,
       count(*) filter (where status = 'failed')::int as failed,
       count(*) filter (where status = 'blocked')::int as blocked
     from test_cards where campaign_id = $1`,
    [payload.campaign_id],
  );
  const { passed = 0, failed = 0, blocked = 0 } = (scoreRows[0] ?? {}) as Record<string, number>;
  const denominator = Number(passed) + Number(failed) + Number(blocked);
  const readiness = denominator === 0 ? 0 : Math.round((Number(passed) / denominator) * 100);
  const status = Number(failed) > 0 ? "analyzing" : denominator > 0 ? "report_ready" : "planning";

  await sql(
    `update campaigns set updated_at = now(), readiness_score = $2, status = $3 where id = $1`,
    [payload.campaign_id, readiness, status],
  );

  return { sessionId, cardsUpdated, cardsInserted, readiness };
}

export type ArtifactRegistration = {
  campaign_id: string;
  run_id: string;
  test_card_id: string;
  artifact_type: string;
  filename: string;
  sha256: string;
};

export type ArtifactPersistResult =
  | { persisted: true; artifactId: string; runId: string }
  | { persisted: false; reason: string };

export async function registerArtifactRecord(
  sql: SqlClient,
  body: ArtifactRegistration,
  blobPath: string,
): Promise<ArtifactPersistResult> {
  try {
    await sql(
      `insert into runs (id, campaign_id, test_card_id, status, started_at)
       values ($1, $2, $3, 'running', now())
       on conflict (id) do nothing`,
      [body.run_id, body.campaign_id, body.test_card_id],
    );

    const artifactId = `art_${safeSegment(body.run_id)}_${safeSegment(body.test_card_id)}_${body.sha256.slice(0, 12)}`;

    await sql(
      `insert into artifacts (id, run_id, artifact_type, blob_path, sha256)
       values ($1, $2, $3, $4, $5)
       on conflict (id) do nothing`,
      [artifactId, body.run_id, body.artifact_type, blobPath, body.sha256],
    );

    return { persisted: true, artifactId, runId: body.run_id };
  } catch (error) {
    return {
      persisted: false,
      reason: error instanceof Error ? error.message : "Unknown persistence failure.",
    };
  }
}
