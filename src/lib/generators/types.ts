export type ExecStepLike = Record<string, unknown>;

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
  exec: ExecStepLike[];
  authState?: string;
};

export type RoleAuth = { cookie?: string; storageState?: string };

/** A state-changing API that must reject anonymous callers (write-authz / IDOR surface). */
export type WriteApi = { path: string; method?: string; body?: unknown };

/** An ElevenLabs ConvAI agent to audit (config is fetched read-only via the EL API). */
export type ElevenLabsAgent = { agentId: string; name?: string; toolless?: boolean; apiKeyEnv?: string };

export type AuditHints = {
  protectedRoutes?: string[];
  protectedApis?: Array<{ path: string; method?: string }>;
  postEndpoints?: Array<{ path: string }>;
  loginPath?: string;
  roles?: Record<string, RoleAuth>;
  securityPaths?: string[];
  /** State-changing endpoints whose anonymous-write rejection must be proven. */
  writeApis?: WriteApi[];
  /** ElevenLabs agents to audit, plus the env var holding the xi-api-key. */
  elevenLabsAgents?: ElevenLabsAgent[];
  elevenLabsApiKeyEnv?: string;
};

export class Counter {
  private map: Record<string, number> = {};
  next(prefix: string) {
    this.map[prefix] = (this.map[prefix] ?? 0) + 1;
    return `${prefix}-${String(this.map[prefix]).padStart(3, "0")}`;
  }
}
