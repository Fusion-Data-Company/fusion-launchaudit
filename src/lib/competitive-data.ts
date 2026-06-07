export type CompetitiveCategory = {
  category: string;
  testspriteBaseline: string;
  fusionAdvantage: string;
  proofGate: string;
  status: "implemented" | "designed" | "next";
};

export const competitiveScorecard: CompetitiveCategory[] = [
  {
    category: "Codebase context",
    testspriteBaseline: "URL, PRD, generated test plan, and black-box crawl are the public baseline.",
    fusionAdvantage: "Local MCP runner inspects repo structure, scripts, routes, API handlers, env expectations, and test tooling before planning.",
    proofGate: "Campaign cannot mark context complete until repo summary and runtime summary sync under one campaign ID.",
    status: "implemented",
  },
  {
    category: "Test specificity",
    testspriteBaseline: "Generic AI-generated happy-path and broad E2E coverage.",
    fusionAdvantage: "Each card includes risk, data needs, evidence gates, acceptance criteria, and blocked-gap policy.",
    proofGate: "Every generated card must include goal, steps, expected evidence, data needs, and acceptance criteria.",
    status: "implemented",
  },
  {
    category: "Repair quality",
    testspriteBaseline: "Reports failure and may suggest a fix.",
    fusionAdvantage: "Creates coding-agent repair packets with likely files, exact repro, expected behavior, verification command, and agent prompt.",
    proofGate: "Product bugs are not complete until a repair task can be handed to Codex, Claude, Cursor, or a local model.",
    status: "implemented",
  },
  {
    category: "Evidence integrity",
    testspriteBaseline: "Screenshots/video/report artifacts after execution.",
    fusionAdvantage: "Treats unsupported integrations and missing sandbox keys as blocked findings, never as implicit passes.",
    proofGate: "Audit score must include blocked checks and unsupported gaps as first-class report items.",
    status: "implemented",
  },
  {
    category: "Model harness",
    testspriteBaseline: "Vendor model behavior is hidden behind the product.",
    fusionAdvantage: "Planned category router can send planning, repo analysis, test generation, repair packets, and patching to different hosted or local models.",
    proofGate: "ModelTask interface and provider adapters must support OpenAI, Anthropic, OpenRouter, Genspark bridge, and Docker-hosted OpenAI-compatible endpoints.",
    status: "designed",
  },
  {
    category: "Deployment ownership",
    testspriteBaseline: "Hosted vendor workflow.",
    fusionAdvantage: "Vercel static/serverless app plus local runner keeps private code local while web reporting stays shareable.",
    proofGate: "Static app loads without framework dev server; API accepts runner sync; artifacts can move to Blob and campaign state to Postgres.",
    status: "implemented",
  },
];
