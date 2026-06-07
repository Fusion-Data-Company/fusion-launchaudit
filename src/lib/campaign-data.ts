export type CampaignStatus =
  | "draft"
  | "context_collecting"
  | "planning"
  | "awaiting_review"
  | "running"
  | "analyzing"
  | "report_ready"
  | "blocked"
  | "failed";

export type TestCategory =
  | "auth"
  | "core_workflow"
  | "roles_permissions"
  | "forms_validation"
  | "state_persistence"
  | "responsive_visual"
  | "accessibility"
  | "performance"
  | "api_contract"
  | "console_network"
  | "error_empty_states"
  | "integration_side_effects";

export type FindingType =
  | "product_bug"
  | "test_bug"
  | "environment_issue"
  | "missing_context"
  | "flaky_behavior"
  | "unclear_requirement";

export type Severity = "critical" | "high" | "medium" | "low";

export type TestCardStatus = "ready" | "running" | "passed" | "failed" | "blocked";

export type TestCard = {
  id: string;
  title: string;
  category: TestCategory;
  status: TestCardStatus;
  risk: Severity;
  goal: string;
  steps: string[];
  expectedEvidence: string[];
  dataNeeds: string[];
  acceptanceCriteria: string;
};

export type Finding = {
  id: string;
  type: FindingType;
  severity: Severity;
  title: string;
  testCardId: string;
  evidenceRefs: string[];
  summary: string;
};

export type RepairTask = {
  finding_id: string;
  severity: Severity;
  title: string;
  why_it_matters: string;
  evidence_refs: string[];
  likely_files: string[];
  reproduction_steps: string[];
  expected_behavior: string;
  verification_command: string;
  agent_prompt: string;
};

export type Campaign = {
  id: string;
  name: string;
  status: CampaignStatus;
  readinessScore: number;
  appUrl: string;
  repoPath: string;
  depth: "Full launch audit";
  runner: {
    status: "connected" | "syncing" | "offline";
    host: string;
    version: string;
    lastSync: string;
  };
  environment: {
    framework: string;
    supportTier: "first-class" | "generic";
    auth: "captured locally" | "not captured";
    scripts: string[];
    unsupportedGaps: string[];
  };
};

export type CampaignStage = {
  label: string;
  status: "complete" | "active" | "queued";
  detail: string;
};

export const campaign: Campaign = {
  id: "cmp_launch_001",
  name: "Launch Audit Campaign",
  status: "report_ready",
  readinessScore: 82,
  appUrl: "http://localhost:3000",
  repoPath: "~/client-app",
  depth: "Full launch audit",
  runner: {
    status: "connected",
    host: "Rob-MacBook-Pro.local",
    version: "mcp-runner 0.1.0",
    lastSync: "2 min ago",
  },
  environment: {
    framework: "Next.js / TypeScript / Playwright candidate",
    supportTier: "first-class",
    auth: "captured locally",
    scripts: ["npm run dev", "npm run lint", "npm run test:e2e"],
    unsupportedGaps: ["Webhook side effects need sandbox provider keys before execution."],
  },
};

export const stages: CampaignStage[] = [
  { label: "Context", status: "complete", detail: "Repo + runtime mapped" },
  { label: "Plan", status: "complete", detail: "5 test cards generated" },
  { label: "Review", status: "complete", detail: "High-risk cards approved" },
  { label: "Run", status: "complete", detail: "2 passed / 2 failed / 1 blocked" },
  { label: "Analyze", status: "complete", detail: "Findings classified" },
  { label: "Report", status: "active", detail: "Client-ready audit assembled" },
];

export const testCards: TestCard[] = [
  {
    id: "TC-101",
    title: "Authenticated user can complete the primary workflow without hidden console failures",
    category: "core_workflow",
    status: "passed",
    risk: "critical",
    goal: "Prove the app's highest-value workflow works from first page load through final confirmation.",
    steps: [
      "Reuse captured local auth state.",
      "Open dashboard from a clean browser context.",
      "Create a new record with valid boundary data.",
      "Verify confirmation, persisted state, and reload behavior.",
    ],
    expectedEvidence: ["Trace", "Before/after screenshots", "Network log", "Persisted record assertion"],
    dataNeeds: ["Authenticated builder account", "Fresh test record name"],
    acceptanceCriteria: "The record exists after reload and no console error or failed API request appears during the flow.",
  },
  {
    id: "TC-118",
    title: "Role boundary prevents client user from reaching admin-only repair actions",
    category: "roles_permissions",
    status: "failed",
    risk: "high",
    goal: "Confirm role separation is enforced at navigation, page load, and API mutation layers.",
    steps: [
      "Load captured client-role auth state.",
      "Attempt direct navigation to admin repair task URL.",
      "Attempt the backing mutation request from the browser context.",
      "Capture server response and visible UI state.",
    ],
    expectedEvidence: ["403/redirect proof", "Screenshot", "Network request/response pair"],
    dataNeeds: ["Client role session", "Known admin task id"],
    acceptanceCriteria: "Client role receives a blocked state and cannot mutate or view admin-only repair tasks.",
  },
  {
    id: "TC-124",
    title: "Slow API response preserves form input and shows a recoverable state",
    category: "forms_validation",
    status: "passed",
    risk: "medium",
    goal: "Expose the common launch bug where slow services erase user work or double-submit forms.",
    steps: [
      "Throttle submit endpoint to 4 seconds.",
      "Submit a valid form.",
      "Verify disabled state, spinner, and no duplicate request.",
      "Refresh after completion and confirm saved data.",
    ],
    expectedEvidence: ["Network throttle trace", "DOM disabled-state assertion", "Screenshot"],
    dataNeeds: ["Valid form payload", "Network interception rule"],
    acceptanceCriteria: "Only one mutation fires, user input remains visible, and the saved state survives reload.",
  },
  {
    id: "TC-142",
    title: "Mobile audit report is readable without horizontal overflow",
    category: "responsive_visual",
    status: "failed",
    risk: "medium",
    goal: "Verify the client-ready report can be reviewed on mobile without clipped tables or overlapping action buttons.",
    steps: [
      "Open report page at 390px width.",
      "Scroll every section.",
      "Inspect issue table, evidence gallery, and repair task cards.",
      "Capture screenshot and overflow metrics.",
    ],
    expectedEvidence: ["Mobile screenshot", "Layout overflow measurement", "DOM bounding boxes"],
    dataNeeds: ["Generated audit report with at least two findings"],
    acceptanceCriteria: "No primary content overflows the viewport and all action labels remain readable.",
  },
  {
    id: "TC-153",
    title: "Webhook/payment side effects are declared instead of silently skipped",
    category: "integration_side_effects",
    status: "blocked",
    risk: "high",
    goal: "Prevent fake confidence by forcing unsupported third-party checks into the audit report.",
    steps: [
      "Inspect env and integration code references.",
      "Detect missing sandbox keys.",
      "Mark affected checks as blocked with exact reason.",
    ],
    expectedEvidence: ["Env-key presence map", "Integration file references", "Blocked finding"],
    dataNeeds: ["Sandbox provider keys or explicit skip approval"],
    acceptanceCriteria: "The report names the blocked integration checks and does not count them as passed.",
  },
];

export const findings: Finding[] = [
  {
    id: "FD-118",
    type: "product_bug",
    severity: "high",
    title: "Client role can load admin repair task detail by direct URL",
    testCardId: "TC-118",
    evidenceRefs: ["trace://TC-118/direct-url.zip", "screenshot://TC-118/admin-detail.png"],
    summary: "Navigation hides the admin action, but the route-level loader returns repair task details for a client-role session.",
  },
  {
    id: "FD-142",
    type: "product_bug",
    severity: "medium",
    title: "Mobile report table overflows 390px viewport",
    testCardId: "TC-142",
    evidenceRefs: ["screenshot://TC-142/mobile-overflow.png", "metric://TC-142/body-scroll-width"],
    summary: "The evidence table uses fixed columns and pushes primary actions outside the viewport.",
  },
  {
    id: "FD-153",
    type: "environment_issue",
    severity: "high",
    title: "Webhook checks blocked by missing sandbox keys",
    testCardId: "TC-153",
    evidenceRefs: ["env-map://campaign/cmp_launch_001"],
    summary: "Payment/webhook confidence cannot be claimed until sandbox credentials are present or the check is explicitly waived.",
  },
];

export const repairTasks: RepairTask[] = [
  {
    finding_id: "FD-118",
    severity: "high",
    title: "Enforce server-side role guard on repair task detail route",
    why_it_matters:
      "The UI hides admin actions, but direct navigation still exposes admin-only repair task details to a client user.",
    evidence_refs: ["trace://TC-118/direct-url.zip", "screenshot://TC-118/admin-detail.png"],
    likely_files: ["src/app/admin/repair-tasks/[id]/page.tsx", "src/lib/auth/roles.ts", "src/app/api/repair-tasks/[id]/route.ts"],
    reproduction_steps: [
      "Login with captured client-role browser state.",
      "Navigate directly to /admin/repair-tasks/rt_102.",
      "Observe repair task title, likely files, and agent prompt in the rendered page.",
    ],
    expected_behavior: "Client role should receive a 403 page or redirect and API detail route should return 403.",
    verification_command: "npx playwright test tests/roles/repair-task-guard.spec.ts",
    agent_prompt:
      "Patch the repair task detail page and API route so authorization is enforced server-side. Keep admin access unchanged, return 403 for client users, and add a Playwright regression for direct URL access.",
  },
  {
    finding_id: "FD-142",
    severity: "medium",
    title: "Make audit report evidence table responsive",
    why_it_matters:
      "The launch audit is supposed to be client-ready, but the mobile report currently clips evidence and action labels.",
    evidence_refs: ["screenshot://TC-142/mobile-overflow.png", "metric://TC-142/body-scroll-width"],
    likely_files: ["src/app/reports/[id]/page.tsx", "src/components/report/evidence-table.tsx"],
    reproduction_steps: [
      "Open /reports/rpt_launch_001 at 390px viewport width.",
      "Scroll to Evidence.",
      "Observe horizontal overflow and clipped action column.",
    ],
    expected_behavior: "Evidence rows collapse into readable stacked rows on narrow screens with no body overflow.",
    verification_command: "npx playwright test tests/responsive/audit-report-mobile.spec.ts",
    agent_prompt:
      "Refactor the audit evidence table responsive layout so mobile uses stacked row cards while desktop preserves the dense table. Verify no horizontal body overflow at 390px.",
  },
];

export const categoryLabels: Record<TestCategory, string> = {
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
