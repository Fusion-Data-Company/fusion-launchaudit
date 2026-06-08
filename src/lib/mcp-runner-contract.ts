import type { TestCard } from "@/lib/campaign-data";

export type RunnerToolName =
  | "qa.inspect_repo"
  | "qa.detect_app"
  | "qa.capture_auth_state"
  | "qa.start_or_verify_app"
  | "qa.run_test_card"
  | "qa.collect_artifacts"
  | "qa.sync_campaign_results";

export type RunnerTool = {
  name: RunnerToolName;
  description: string;
  inputShape: string;
  outputShape: string;
};

export type RunnerScanMode = "seeded_simulation" | "live_scan";

export type SyncTestCard = {
  id: string;
  title: string;
  category: string;
  status: string;
  risk: string;
  goal?: string;
  steps?: string[];
  expectedEvidence?: string[];
  dataNeeds?: string[];
  acceptanceCriteria?: string;
};

export type SyncFinding = {
  id: string;
  test_card_id: string;
  type: string;
  severity: string;
  title: string;
  summary: string;
  evidence_refs: string[];
};

export type SyncRunResult = {
  run_id: string;
  test_card_id: string;
  status: "passed" | "failed" | "blocked";
  started_at: string;
  ended_at: string;
  artifact_refs: string[];
};

export type RunnerSyncPayload = {
  campaign_id: string;
  runner_host: string;
  build_sha?: string;
  scan_mode?: RunnerScanMode;
  scan_detail?: Record<string, unknown>;
  findings?: SyncFinding[];
  run_results?: SyncRunResult[];
  repo_summary: {
    framework: string;
    package_manager: string;
    scripts: string[];
    route_count: number;
    api_route_count: number;
    env_keys_present: string[];
    env_keys_missing: string[];
  };
  runtime_summary: {
    app_url: string;
    reachable: boolean;
    console_errors: number;
    failed_requests: number;
    auth_state: "captured" | "missing";
  };
  test_cards: SyncTestCard[];
  artifact_refs: string[];
};

export const runnerTools: RunnerTool[] = [
  {
    name: "qa.inspect_repo",
    description: "Inspect package metadata, scripts, route files, API handlers, env expectations, and existing test tooling.",
    inputShape: "{ repo_path: string }",
    outputShape: "{ framework, package_manager, scripts, route_count, api_route_count, env_keys }",
  },
  {
    name: "qa.detect_app",
    description: "Detect app stack and support tier so the audit report names first-class and generic coverage honestly.",
    inputShape: "{ repo_summary: RepoSummary }",
    outputShape: "{ framework, support_tier, unsupported_gaps[] }",
  },
  {
    name: "qa.capture_auth_state",
    description: "Open a controlled browser session and store encrypted local Playwright storage state without sending credentials to the web app.",
    inputShape: "{ campaign_id: string, app_url: string }",
    outputShape: "{ auth_state_ref, expires_at, roles_detected[] }",
  },
  {
    name: "qa.start_or_verify_app",
    description: "Run or verify the local app URL, then collect console, network, and route reachability facts.",
    inputShape: "{ app_url: string, start_command?: string }",
    outputShape: "{ reachable, console_errors, failed_requests, discovered_routes[] }",
  },
  {
    name: "qa.run_test_card",
    description: "Execute an approved test card with Playwright and persist trace, screenshot, video, and structured assertions.",
    inputShape: "{ campaign_id: string, test_card_id: string, storage_state_ref?: string }",
    outputShape: "{ status, assertions[], artifact_refs[], finding_seed? }",
  },
  {
    name: "qa.collect_artifacts",
    description: "Normalize traces, screenshots, videos, network logs, and accessibility snapshots into report-ready artifact references.",
    inputShape: "{ campaign_id: string, run_id: string }",
    outputShape: "{ artifact_refs[], evidence_summary }",
  },
  {
    name: "qa.sync_campaign_results",
    description: "Send sanitized campaign results to the web app under one campaign id.",
    inputShape: "RunnerSyncPayload",
    outputShape: "{ accepted: boolean, synced_at: string }",
  },
];
