export type ModelTaskCategory =
  | "repo_context"
  | "runtime_crawl"
  | "test_generation"
  | "failure_classification"
  | "repair_task_writing"
  | "patch_planning"
  | "visual_review"
  | "traffic_analysis";

export type ModelProviderKind =
  | "platform_default"
  | "openrouter"
  | "genspark_bridge"
  | "docker_openai_compatible"
  | "proprietary_finetune";

export type ModelProviderSlot = {
  id: string;
  label: string;
  kind: ModelProviderKind;
  status: "ready" | "configurable" | "needs_secret" | "planned";
  endpoint: string;
  secretEnv: string;
  bestFor: ModelTaskCategory[];
  guardrail: string;
};

export type ModelRoute = {
  task: ModelTaskCategory;
  label: string;
  providerSlotId: string;
  model: string;
  temperature: number;
  maxTokens: number;
  fallbackProviderSlotId: string;
  qualityGate: string;
};

export type ModelTaskContract = {
  id: string;
  category: ModelTaskCategory;
  inputShape: string;
  outputShape: string;
  evidenceRequired: string[];
};

export const modelProviderSlots: ModelProviderSlot[] = [
  {
    id: "platform-default",
    label: "Fusion managed default",
    kind: "platform_default",
    status: "ready",
    endpoint: "server-managed",
    secretEnv: "OPENAI_API_KEY",
    bestFor: ["test_generation", "failure_classification", "repair_task_writing"],
    guardrail: "Used when no customer model route is configured; prompts and outputs are logged to the campaign audit trail.",
  },
  {
    id: "openrouter-coding",
    label: "OpenRouter coding model",
    kind: "openrouter",
    status: "needs_secret",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    secretEnv: "OPENROUTER_API_KEY",
    bestFor: ["patch_planning", "repair_task_writing", "test_generation"],
    guardrail: "Allowed for code-aware work only after the project owner approves which repo excerpts can leave the local runner.",
  },
  {
    id: "genspark-agent",
    label: "Genspark agent bridge",
    kind: "genspark_bridge",
    status: "configurable",
    endpoint: "customer-configured HTTPS bridge",
    secretEnv: "GENSPARK_BRIDGE_TOKEN",
    bestFor: ["runtime_crawl", "visual_review", "traffic_analysis"],
    guardrail: "Bridge receives sanitized tasks and artifact references, not raw production credentials.",
  },
  {
    id: "docker-local-llm",
    label: "Docker hosted local LLM",
    kind: "docker_openai_compatible",
    status: "configurable",
    endpoint: "http://host.docker.internal:11434/v1/chat/completions",
    secretEnv: "LOCAL_LLM_API_KEY",
    bestFor: ["repo_context", "patch_planning", "traffic_analysis"],
    guardrail: "Can run fully local for private code; must return structured JSON that passes the ModelTask schema.",
  },
  {
    id: "proprietary-finetune",
    label: "Proprietary QA model",
    kind: "proprietary_finetune",
    status: "planned",
    endpoint: "customer-owned OpenAI-compatible endpoint",
    secretEnv: "PROPRIETARY_QA_MODEL_KEY",
    bestFor: ["test_generation", "failure_classification", "visual_review"],
    guardrail: "Trained only from approved campaign artifacts; production secrets and credentials stay excluded from training data.",
  },
];

export const modelRoutes: ModelRoute[] = [
  {
    task: "repo_context",
    label: "Repo inspection summarizer",
    providerSlotId: "docker-local-llm",
    model: "local-code-context:latest",
    temperature: 0.1,
    maxTokens: 6000,
    fallbackProviderSlotId: "platform-default",
    qualityGate: "Must cite files, scripts, routes, env keys, and unsupported gaps without inventing dependencies.",
  },
  {
    task: "runtime_crawl",
    label: "Runtime workflow mapper",
    providerSlotId: "genspark-agent",
    model: "genspark-browser-agent",
    temperature: 0.2,
    maxTokens: 5000,
    fallbackProviderSlotId: "platform-default",
    qualityGate: "Must produce route inventory, reachable states, console/network issues, and auth assumptions.",
  },
  {
    task: "test_generation",
    label: "Deep test-card generator",
    providerSlotId: "platform-default",
    model: "managed-strong-reasoning",
    temperature: 0.25,
    maxTokens: 9000,
    fallbackProviderSlotId: "openrouter-coding",
    qualityGate: "Every card needs exact steps, data needs, evidence gates, risk, and acceptance criteria.",
  },
  {
    task: "failure_classification",
    label: "Failure classifier",
    providerSlotId: "platform-default",
    model: "managed-strong-reasoning",
    temperature: 0,
    maxTokens: 3000,
    fallbackProviderSlotId: "proprietary-finetune",
    qualityGate: "Must classify as product bug, test bug, environment issue, flaky behavior, missing context, or unclear requirement.",
  },
  {
    task: "repair_task_writing",
    label: "Coding-agent repair packet writer",
    providerSlotId: "openrouter-coding",
    model: "coding-agent-selected-by-owner",
    temperature: 0.15,
    maxTokens: 7000,
    fallbackProviderSlotId: "platform-default",
    qualityGate: "Must include likely files, repro steps, expected behavior, verification command, and a ready agent prompt.",
  },
  {
    task: "visual_review",
    label: "Visual and responsive auditor",
    providerSlotId: "genspark-agent",
    model: "vision-browser-agent",
    temperature: 0.1,
    maxTokens: 5000,
    fallbackProviderSlotId: "platform-default",
    qualityGate: "Must attach viewport, screenshot refs, overflow metrics, and concrete visual defects.",
  },
  {
    task: "traffic_analysis",
    label: "Network traffic analyst",
    providerSlotId: "docker-local-llm",
    model: "local-traffic-analyst:latest",
    temperature: 0,
    maxTokens: 5000,
    fallbackProviderSlotId: "platform-default",
    qualityGate: "Must map failed requests to cards/findings and redact sensitive headers before sync.",
  },
];

export const modelTaskContracts: ModelTaskContract[] = [
  {
    id: "modeltask.repo_context.v1",
    category: "repo_context",
    inputShape: "{ repo_summary, file_manifest, package_scripts, route_inventory }",
    outputShape: "{ framework, workflows[], risk_areas[], likely_files[], unsupported_gaps[] }",
    evidenceRequired: ["file refs", "script refs", "route refs"],
  },
  {
    id: "modeltask.test_generation.v1",
    category: "test_generation",
    inputShape: "{ campaign_context, runtime_map, repo_context, prd_notes?, auth_roles? }",
    outputShape: "{ test_cards: TestCard[], blocked_gaps[], generation_lineage[] }",
    evidenceRequired: ["source artifact refs", "risk reason", "acceptance criteria"],
  },
  {
    id: "modeltask.repair_packet.v1",
    category: "repair_task_writing",
    inputShape: "{ finding, evidence_refs, repo_context, traffic_insights? }",
    outputShape: "RepairTask",
    evidenceRequired: ["repro steps", "likely files", "verification command"],
  },
];
