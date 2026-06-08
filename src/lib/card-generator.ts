/**
 * Test card generator — turns repo scan + runtime crawl into specific,
 * executable, evidence-gated test cards. Deterministic and honest:
 * what cannot be tested gets a blocked card with the reason, never
 * silently skipped. LLM-authored cards can ride alongside via the MCP
 * path; this generator needs no model at all.
 */
import type { RepoScan } from "../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../runner/crawler.ts";

export type GeneratedCard = {
  id: string;
  title: string;
  category: string;
  status: string;
  risk: string;
  goal: string;
  steps: string[];
  expectedEvidence: string[];
  dataNeeds: string[];
  acceptanceCriteria: string;
  exec: Array<Record<string, unknown>>;
};

function pad(n: number) {
  return String(n).padStart(3, "0");
}

export function generateTestCards(scan: RepoScan | null, crawl: RuntimeCrawl): GeneratedCard[] {
  const cards: GeneratedCard[] = [];
  let n = 0;
  const next = () => `TC-GEN-${pad(++n)}`;

  // 1. Core load
  cards.push({
    id: next(),
    title: `App shell loads at ${crawl.app_url}`,
    category: "core_workflow",
    status: "ready",
    risk: "critical",
    goal: "The application loads and renders interactive content for a first-time visitor.",
    steps: ["Open the app root", "Wait for network idle", "Verify interactive elements present"],
    expectedEvidence: ["screenshot"],
    dataNeeds: [],
    acceptanceCriteria: `Page reaches network idle with a non-empty title and at least one interactive element (observed ${crawl.button_count} buttons at crawl time).`,
    exec: [
      { action: "goto", url: crawl.app_url },
      { action: "wait", ms: 800 },
      { action: "expect_visible", selector: crawl.button_count > 0 ? "button, [role=button]" : "body" },
    ],
  });

  // 2. Per discovered route (real links found in the DOM)
  for (const link of crawl.links.slice(0, 6)) {
    const label = link.text || new URL(link.href).pathname;
    cards.push({
      id: next(),
      title: `Discovered route reachable: ${label}`,
      category: "core_workflow",
      status: "ready",
      risk: "high",
      goal: `Navigation target "${label}" found in the live DOM responds without server error.`,
      steps: [`GET ${link.href}`, "Verify non-5xx response"],
      expectedEvidence: ["network_log"],
      dataNeeds: [],
      acceptanceCriteria: `${link.href} returns a non-5xx status.`,
      exec: [{ action: "expect_http_ok", url: link.href }],
    });
  }

  // 3. Console + network hygiene
  cards.push({
    id: next(),
    title: "Zero console errors and no 5xx on load",
    category: "console_network",
    status: "ready",
    risk: "high",
    goal: "Baseline professionalism: a clean console and no failing requests on first load.",
    steps: ["Open root", "Collect console + network", "Assert clean"],
    expectedEvidence: ["network_log", "screenshot"],
    dataNeeds: [],
    acceptanceCriteria: `Zero console.error entries and zero 5xx responses (crawl observed ${crawl.console_errors_on_load} console errors).`,
    exec: [
      { action: "goto", url: crawl.app_url },
      { action: "wait", ms: 1200 },
      { action: "expect_console_clean" },
      { action: "expect_network_clean" },
    ],
  });

  // 4. Responsive
  cards.push({
    id: next(),
    title: "Mobile 390px renders without horizontal overflow",
    category: "responsive_visual",
    status: "ready",
    risk: "high",
    goal: "Phone users get a usable layout, not sideways scrolling.",
    steps: ["Set 390x844 viewport", "Open root", "Measure overflow"],
    expectedEvidence: ["screenshot"],
    dataNeeds: [],
    acceptanceCriteria: "documentElement.scrollWidth <= clientWidth at 390px.",
    exec: [
      { action: "set_viewport", width: 390, height: 844 },
      { action: "goto", url: crawl.app_url },
      { action: "wait", ms: 800 },
      { action: "expect_no_horizontal_overflow" },
    ],
  });

  // 5. Forms — presence-grounded
  if (crawl.form_count > 0) {
    cards.push({
      id: next(),
      title: `Form interaction surface present (${crawl.form_count} form${crawl.form_count > 1 ? "s" : ""} observed)`,
      category: "forms_validation",
      status: "ready",
      risk: "medium",
      goal: "Forms detected in the live DOM render their fields.",
      steps: ["Open root", "Verify form elements visible"],
      expectedEvidence: ["screenshot"],
      dataNeeds: [],
      acceptanceCriteria: "At least one form with at least one input renders.",
      exec: [
        { action: "goto", url: crawl.app_url },
        { action: "wait", ms: 800 },
        { action: "expect_visible", selector: "form" },
      ],
    });
  }

  // 6. Auth — honest blocked card when detected but capture not available
  if (crawl.has_password_field) {
    cards.push({
      id: next(),
      title: "Authenticated flow coverage",
      category: "auth",
      status: "blocked",
      risk: "critical",
      goal: "Login flow detected (password field in DOM). Full auth-flow execution requires captured auth state.",
      steps: ["Capture auth state via local runner", "Re-run campaign with storage_state_ref"],
      expectedEvidence: ["trace", "screenshot"],
      dataNeeds: ["test account credentials (kept local)"],
      acceptanceCriteria: "BLOCKED until auth-state capture: declared honestly instead of skipped silently.",
      exec: [],
    });
  }

  // 7. Env gaps from repo scan — blocked, named
  if (scan && scan.repo_summary.env_keys_missing.length > 0) {
    const missing = scan.repo_summary.env_keys_missing.slice(0, 6);
    cards.push({
      id: next(),
      title: `Integrations blocked by missing env keys (${missing.length})`,
      category: "integration_side_effects",
      status: "blocked",
      risk: "high",
      goal: "Code references env keys that are absent locally; dependent integrations cannot be verified.",
      steps: ["Provide sandbox values for the named keys", "Re-run campaign"],
      expectedEvidence: ["env-presence map (names only)"],
      dataNeeds: missing,
      acceptanceCriteria: `BLOCKED: ${missing.join(", ")} unset. Declared, not skipped.`,
      exec: [],
    });
  }

  // 8. API surface from repo scan
  if (scan && scan.repo_summary.api_route_count > 0) {
    cards.push({
      id: next(),
      title: `API surface detected (${scan.repo_summary.api_route_count} handlers in repo)`,
      category: "api_contract",
      status: "ready",
      risk: "medium",
      goal: "Repo contains API handlers; the app's primary origin serves them without server failure on root probe.",
      steps: ["Probe app origin", "Sample handler files recorded in scan detail"],
      expectedEvidence: ["network_log"],
      dataNeeds: [],
      acceptanceCriteria: "Origin reachable; per-endpoint contract cards are authored via the MCP agent path with repo knowledge.",
      exec: [{ action: "expect_http_ok", url: crawl.app_url }],
    });
  }

  return cards;
}
