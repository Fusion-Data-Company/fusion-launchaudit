export type FlagshipFeature = {
  id: string;
  sourceInspiredBy: "Fiddler MCP" | "mabl" | "Leapwork AI Studio";
  name: string;
  fusionVersion: string;
  status: "implemented_seed" | "runner_contract" | "next_execution_layer";
  whyItMatters: string;
  evidence: string[];
  proofGate: string;
};

export const flagshipFeatures: FlagshipFeature[] = [
  {
    id: "traffic-insight-debugger",
    sourceInspiredBy: "Fiddler MCP",
    name: "Traffic Insight Debugger",
    fusionVersion:
      "Captured HTTP sessions become campaign evidence, finding context, and coding-agent repair packet inputs instead of separate debugging work.",
    status: "runner_contract",
    whyItMatters:
      "Coding agents and QA reports should reason from actual requests, responses, headers, status codes, and timing, not guesses from UI symptoms.",
    evidence: ["network request/response pairs", "status-code timeline", "redacted header/body map", "slow and failed request summary"],
    proofGate: "Every failed API/network-related test must attach the exact request and response pair or mark traffic capture as blocked.",
  },
  {
    id: "audited-self-healing",
    sourceInspiredBy: "mabl",
    name: "Audited Self-Healing",
    fusionVersion:
      "Locator drift can be repaired, but every heal is logged as an audit event with visual/behavioral confirmation instead of silently turning green.",
    status: "runner_contract",
    whyItMatters:
      "Self-healing is useful only when it does not hide real product behavior changes or create false confidence.",
    evidence: ["old selector", "new selector", "visual diff", "behavior assertion", "heal confidence score"],
    proofGate: "A healed test cannot be promoted unless the intent assertion and visual check still match the original test card.",
  },
  {
    id: "knowledge-workspace",
    sourceInspiredBy: "Leapwork AI Studio",
    name: "AI Test Workspace",
    fusionVersion:
      "Requirements, docs, code, tickets, existing Playwright scripts, and recorded user actions become one campaign knowledge base before tests are generated.",
    status: "implemented_seed",
    whyItMatters:
      "The strongest test plans come from joined context, not a blank canvas or a single URL crawl.",
    evidence: ["requirement map", "route map", "existing test inventory", "recorded action transcript", "generated test-card lineage"],
    proofGate: "Every generated test card must show which source artifacts created it and what launch risk it covers.",
  },
];

export type TrafficInsight = {
  method: string;
  url: string;
  status: number;
  durationMs: number;
  risk: "clean" | "slow" | "failed" | "sensitive";
  attachedFindingId?: string;
};

export const trafficInsights: TrafficInsight[] = [
  {
    method: "GET",
    url: "/api/repair-tasks/rt_102",
    status: 200,
    durationMs: 184,
    risk: "sensitive",
    attachedFindingId: "FD-118",
  },
  {
    method: "POST",
    url: "/api/forms/submit",
    status: 201,
    durationMs: 4028,
    risk: "slow",
  },
  {
    method: "POST",
    url: "/api/webhooks/payment-test",
    status: 0,
    durationMs: 0,
    risk: "failed",
    attachedFindingId: "FD-153",
  },
];

export type HealEvent = {
  testCardId: string;
  event: string;
  confidence: number;
  disposition: "approved" | "needs_review" | "rejected";
  auditNote: string;
};

export const healEvents: HealEvent[] = [
  {
    testCardId: "TC-142",
    event: "Report table action selector changed from data-testid=export-report to aria-label=Export audit report.",
    confidence: 0.91,
    disposition: "needs_review",
    auditNote: "Selector can heal, but mobile visual overflow still fails, so the run remains red.",
  },
  {
    testCardId: "TC-124",
    event: "Submit button text changed from Save to Submit.",
    confidence: 0.88,
    disposition: "approved",
    auditNote: "Behavior assertion and network mutation stayed identical after heal.",
  },
];
