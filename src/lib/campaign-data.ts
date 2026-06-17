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
  | "integration_side_effects"
  | "object_authz"
  | "mutation_authz"
  | "mass_assignment"
  | "cookie_security"
  | "cors"
  | "tls_hsts"
  | "injection"
  | "security_headers"
  | "secrets_exposure";

export type FindingType =
  | "product_bug"
  | "test_bug"
  | "environment_issue"
  | "missing_context"
  | "flaky_behavior"
  | "unclear_requirement";

export type Severity = "critical" | "high" | "medium" | "low";

export type TestCardStatus = "ready" | "running" | "passed" | "failed" | "blocked" | "needs_verification";

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
  name: "Demo: Sample Campaign",
  status: "report_ready",
  readinessScore: 82,
  appUrl: "https://demo.example/sample-app",
  repoPath: "~/demo/sample-app",
  depth: "Full launch audit",
  runner: {
    status: "connected",
    host: "demo-runner (sample)",
    version: "mcp-runner 0.1.0",
    lastSync: "sample data",
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
  {
    id: "TC-201",
    title: "No cross-user object access by swapping an id (IDOR)",
    category: "object_authz",
    status: "failed",
    risk: "critical",
    goal: "A normal user requesting another owner's object id must be denied, never served the other owner's record.",
    steps: ["Capture a normal 'user' session.", "GET another owner's object id (e.g. /api/orders/1).", "Confirm the response is 401/403/404, not the other owner's data."],
    expectedEvidence: ["Network request/response pair", "Captured user session"],
    dataNeeds: ["A non-admin test account"],
    acceptanceCriteria: "As 'user', the swapped-id request returns 401/403/404, not a 2xx with another owner's object. WSTG-ATHZ-04 / CWE-639.",
  },
  {
    id: "TC-202",
    title: "Account detail endpoint enforces ownership",
    category: "object_authz",
    status: "passed",
    risk: "critical",
    goal: "Prove the per-user record endpoint checks ownership server-side.",
    steps: ["As 'user', request the user's own object (allowed).", "As 'user', request a neighbouring owner's id (denied)."],
    expectedEvidence: ["Network log", "Positive + negative control"],
    dataNeeds: ["A non-admin test account"],
    acceptanceCriteria: "Owner can read their object; cross-owner read is blocked. WSTG-ATHZ-04 / CWE-639.",
  },
  {
    id: "TC-203",
    title: "Normal user is denied a privileged mutation (BFLA)",
    category: "mutation_authz",
    status: "failed",
    risk: "critical",
    goal: "A privileged state-changing call by a normal user must be rejected with 401/403 before any write — the denial proves no state change.",
    steps: ["As 'user', POST the privileged endpoint (e.g. /api/admin/delete-user).", "Confirm a 401/403, not a 2xx."],
    expectedEvidence: ["Network request/response pair"],
    dataNeeds: ["A non-admin test account"],
    acceptanceCriteria: "As 'user', the privileged mutation returns 401/403 before any write. OWASP API5 / CWE-285.",
  },
  {
    id: "TC-204",
    title: "Update endpoint ignores privileged fields (mass-assignment)",
    category: "mass_assignment",
    status: "needs_verification",
    risk: "high",
    goal: "Sending role:\"admin\"/isAdmin:true to a profile-update endpoint must be ignored, not persisted.",
    steps: ["As 'user', PATCH the profile with extra privileged fields.", "Re-read the record and confirm role/isAdmin did not change."],
    expectedEvidence: ["Request body", "Re-read of the persisted record"],
    dataNeeds: ["A non-admin test account", "An object-update endpoint"],
    acceptanceCriteria: "Privileged fields are not accepted or echoed as persisted. OWASP API3 / CWE-915.",
  },
  {
    id: "TC-205",
    title: "Session cookie carries HttpOnly, Secure, and SameSite",
    category: "cookie_security",
    status: "failed",
    risk: "high",
    goal: "A session cookie without HttpOnly is JS-readable (XSS theft); without Secure it leaks over http; without SameSite it is CSRF-exposed.",
    steps: ["Log in and capture the Set-Cookie.", "Check for HttpOnly, Secure, and SameSite attributes."],
    expectedEvidence: ["Set-Cookie header transcript"],
    dataNeeds: ["A login that issues a session cookie"],
    acceptanceCriteria: "The session Set-Cookie includes HttpOnly, Secure, and SameSite. CWE-1004 / CWE-614.",
  },
  {
    id: "TC-206",
    title: "CORS does not reflect a hostile Origin with credentials",
    category: "cors",
    status: "passed",
    risk: "high",
    goal: "An arbitrary Origin must not be echoed in Access-Control-Allow-Origin together with Access-Control-Allow-Credentials: true.",
    steps: ["Send a request with Origin: https://evil.example.", "Confirm the probe Origin is not reflected with credentials enabled."],
    expectedEvidence: ["Response header transcript"],
    dataNeeds: [],
    acceptanceCriteria: "No credentialed reflection of an arbitrary Origin. CWE-942.",
  },
  {
    id: "TC-207",
    title: "HSTS (Strict-Transport-Security) is present",
    category: "tls_hsts",
    status: "passed",
    risk: "medium",
    goal: "Without HSTS a browser will still try http first and can be downgraded before the redirect.",
    steps: ["GET / over https.", "Confirm a Strict-Transport-Security response header."],
    expectedEvidence: ["Response header transcript"],
    dataNeeds: [],
    acceptanceCriteria: "Response carries Strict-Transport-Security. OWASP Secure Headers / Mozilla TLS.",
  },
  {
    id: "TC-208",
    title: "http redirects to https",
    category: "tls_hsts",
    status: "needs_verification",
    risk: "medium",
    goal: "Plain http must redirect to https so credentials/cookies never travel in cleartext.",
    steps: ["GET the http:// origin.", "Confirm a 301/308 whose Location is https."],
    expectedEvidence: ["Redirect transcript"],
    dataNeeds: ["A reachable http endpoint to probe"],
    acceptanceCriteria: "http requests 301/308-redirect to https.",
  },
  {
    id: "TC-209",
    title: "SQL-injection canary is handled safely",
    category: "injection",
    status: "failed",
    risk: "high",
    goal: "A non-destructive SQLi canary must not 500 the server or leak a database error.",
    steps: ["POST a field with the canary ' OR '1'='1.", "Confirm no 500 and no SQL/engine error text in the body."],
    expectedEvidence: ["Request + response transcript"],
    dataNeeds: [],
    acceptanceCriteria: "No 500 and no DB-error text on the canary. WSTG-INPV / CWE-89.",
  },
  {
    id: "TC-210",
    title: "XSS canary is escaped, not reflected",
    category: "injection",
    status: "passed",
    risk: "high",
    goal: "A reflected XSS canary must come back escaped, never as live markup.",
    steps: ["Send the canary <svg/onload=alert(1)>.", "Confirm the raw payload is not reflected unescaped."],
    expectedEvidence: ["Response body excerpt"],
    dataNeeds: [],
    acceptanceCriteria: "The raw XSS payload is not present unescaped in the response. WSTG-INPV / CWE-79.",
  },
  {
    id: "TC-211",
    title: "Security headers are present and carry safe values",
    category: "security_headers",
    status: "failed",
    risk: "high",
    goal: "The hardening headers that stop clickjacking, MIME-sniffing, and stack-banner leaks must be set.",
    steps: ["GET /.", "Check Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.", "Confirm no X-Powered-By banner."],
    expectedEvidence: ["Response header transcript"],
    dataNeeds: [],
    acceptanceCriteria: "CSP, X-Frame-Options, X-Content-Type-Options, and Referrer-Policy are present with safe values. OWASP Secure Headers.",
  },
  {
    id: "TC-212",
    title: "Secret and VCS files are not publicly downloadable",
    category: "secrets_exposure",
    status: "passed",
    risk: "critical",
    goal: "Config and version-control files must never be served to the public.",
    steps: ["Request /.env, /.env.local, /.git/config, /.git/HEAD.", "Confirm each is blocked (not 200 with file content)."],
    expectedEvidence: ["Per-path response transcript"],
    dataNeeds: [],
    acceptanceCriteria: "No /.env* or /.git/* path returns downloadable content. OWASP WSTG configuration testing.",
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
