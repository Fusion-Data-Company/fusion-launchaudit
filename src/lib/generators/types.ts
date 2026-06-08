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

export type AuditHints = {
  protectedRoutes?: string[];
  protectedApis?: Array<{ path: string; method?: string }>;
  postEndpoints?: Array<{ path: string }>;
  loginPath?: string;
  roles?: Record<string, RoleAuth>;
  securityPaths?: string[];
};

export class Counter {
  private map: Record<string, number> = {};
  next(prefix: string) {
    this.map[prefix] = (this.map[prefix] ?? 0) + 1;
    return `${prefix}-${String(this.map[prefix]).padStart(3, "0")}`;
  }
}
