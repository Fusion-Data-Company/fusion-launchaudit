import fs from "node:fs/promises";
import path from "node:path";
import type { RunnerSyncPayload } from "../src/lib/mcp-runner-contract.ts";

export type ScannedRoute = {
  file: string; // repo-relative path
  url_path: string; // concrete URL, dynamic segments sampled (e.g. /api/users/42)
  kind: "page" | "api";
  methods: string[]; // API: exported HTTP methods; page: ["GET"]
  privileged: boolean; // admin / superadmin / internal surface
};

export type RepoScanDetail = {
  repo_path: string;
  scanned_at: string;
  framework_evidence: string[];
  test_tooling: string[];
  test_file_count: number;
  route_files_sampled: string[];
  routes: ScannedRoute[];
  env_sources: string[];
  files_walked: number;
  truncated: boolean;
};

export type RepoScan = {
  repo_summary: RunnerSyncPayload["repo_summary"];
  detail: RepoScanDetail;
};

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", ".vercel", "dist", "build", "out", "coverage",
  ".turbo", ".cache", ".expo", "ios", "android", ".venv", "venv", "__pycache__",
]);

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const RUNTIME_PROVIDED_ENV = new Set([
  "NODE_ENV", "PORT", "CI", "HOME", "PATH", "PWD", "TZ",
  "VERCEL", "VERCEL_ENV", "VERCEL_URL", "VERCEL_REGION",
  "AWS_REGION", "AWS_LAMBDA_FUNCTION_NAME",
]);

const MAX_FILES = 4000;
const MAX_ENV_SCAN_BYTES = 200_000;

type WalkResult = {
  files: string[];
  truncated: boolean;
};

async function walk(rootDir: string): Promise<WalkResult> {
  const files: string[] = [];
  const queue: string[] = [rootDir];
  let truncated = false;

  while (queue.length > 0) {
    const dir = queue.shift()!;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (files.length >= MAX_FILES) {
        truncated = true;
        break;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".git")) {
          queue.push(fullPath);
        }
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }

    if (truncated) {
      break;
    }
  }

  return { files: files.sort(), truncated };
}

type PackageJson = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

async function readPackageJson(repoPath: string): Promise<PackageJson | null> {
  try {
    const raw = await fs.readFile(path.join(repoPath, "package.json"), "utf8");
    return JSON.parse(raw) as PackageJson;
  } catch {
    return null;
  }
}

function detectFramework(pkg: PackageJson | null, evidence: string[]): string {
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };

  const checks: Array<[string, string]> = [
    ["next", "Next.js"],
    ["expo", "Expo / React Native"],
    ["react-native", "React Native"],
    ["@remix-run/react", "Remix"],
    ["astro", "Astro"],
    ["nuxt", "Nuxt"],
    ["svelte", "Svelte"],
    ["fastify", "Fastify"],
    ["hono", "Hono"],
    ["express", "Express"],
    ["vite", "Vite"],
    ["react", "React"],
  ];

  const hits: string[] = [];
  for (const [dep, label] of checks) {
    if (deps[dep]) {
      evidence.push(`dependency: ${dep}@${deps[dep]}`);
      hits.push(label);
    }
  }

  const usesTypescript = Boolean(deps.typescript);
  if (usesTypescript) {
    evidence.push(`dependency: typescript@${deps.typescript}`);
  }

  if (hits.length === 0) {
    return usesTypescript ? "Node / TypeScript" : "Node / JavaScript";
  }

  const primary = hits[0];
  return usesTypescript ? `${primary} / TypeScript` : `${primary} / JavaScript`;
}

async function detectPackageManager(repoPath: string): Promise<string> {
  const lockfiles: Array<[string, string]> = [
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["bun.lockb", "bun"],
    ["bun.lock", "bun"],
    ["package-lock.json", "npm"],
  ];

  for (const [file, manager] of lockfiles) {
    try {
      await fs.access(path.join(repoPath, file));
      return manager;
    } catch {
      // keep checking
    }
  }

  return "npm";
}

function countRoutes(repoPath: string, files: string[], sampled: string[]) {
  let routeCount = 0;
  let apiRouteCount = 0;

  for (const file of files) {
    const rel = path.relative(repoPath, file).replaceAll(path.sep, "/");
    const base = path.basename(file);
    const ext = path.extname(file);

    if (!SOURCE_EXTENSIONS.has(ext) && ext !== ".html") {
      continue;
    }

    const isAppPage = /(^|\/)app\/.*page\.(t|j)sx?$/.test(rel);
    const isAppRoute = /(^|\/)app\/.*route\.(t|j)sx?$/.test(rel);
    const isPagesApi = /(^|\/)pages\/api\//.test(rel);
    const isPagesPage = /(^|\/)pages\//.test(rel) && !isPagesApi && !base.startsWith("_");
    const isServerlessApi = /^api\//.test(rel);
    const isRoutesDir = /(^|\/)(src\/)?routes\//.test(rel);

    if (isAppRoute || isPagesApi || isServerlessApi) {
      apiRouteCount += 1;
      if (sampled.length < 12) {
        sampled.push(rel);
      }
    } else if (isAppPage || isPagesPage || isRoutesDir) {
      routeCount += 1;
      if (sampled.length < 12) {
        sampled.push(rel);
      }
    }
  }

  return { routeCount, apiRouteCount };
}

async function collectEnvExpectations(files: string[]) {
  const expected = new Set<string>();

  for (const file of files) {
    if (!SOURCE_EXTENSIONS.has(path.extname(file))) {
      continue;
    }
    let stat;
    try {
      stat = await fs.stat(file);
    } catch {
      continue;
    }
    if (stat.size > MAX_ENV_SCAN_BYTES) {
      continue;
    }
    let content;
    try {
      content = await fs.readFile(file, "utf8");
    } catch {
      continue;
    }
    for (const match of content.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
      expected.add(match[1]);
    }
    for (const match of content.matchAll(/import\.meta\.env\.([A-Z][A-Z0-9_]*)/g)) {
      expected.add(match[1]);
    }
  }

  for (const name of RUNTIME_PROVIDED_ENV) {
    expected.delete(name);
  }

  return expected;
}

async function collectEnvPresent(repoPath: string, envSources: string[]) {
  const present = new Set<string>();
  const candidates = [".env", ".env.local", ".env.development", ".env.development.local", ".env.example"];

  for (const candidate of candidates) {
    let content;
    try {
      content = await fs.readFile(path.join(repoPath, candidate), "utf8");
    } catch {
      continue;
    }
    envSources.push(candidate);
    for (const line of content.split("\n")) {
      const match = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/);
      if (match) {
        present.add(match[1]);
      }
    }
  }

  return present;
}

function detectTestTooling(pkg: PackageJson | null, files: string[], repoPath: string) {
  const tooling: string[] = [];
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };

  for (const dep of ["playwright", "@playwright/test", "vitest", "jest", "cypress", "mocha"]) {
    if (deps[dep]) {
      tooling.push(`${dep}@${deps[dep]}`);
    }
  }

  const configNames = new Set([
    "playwright.config.ts", "playwright.config.js",
    "vitest.config.ts", "vitest.config.js", "vitest.config.mts",
    "jest.config.ts", "jest.config.js", "jest.config.mjs",
    "cypress.config.ts", "cypress.config.js",
  ]);

  let testFileCount = 0;
  for (const file of files) {
    const base = path.basename(file);
    if (configNames.has(base)) {
      tooling.push(`config: ${path.relative(repoPath, file).replaceAll(path.sep, "/")}`);
    }
    if (/\.(test|spec)\.(t|j)sx?$/.test(base)) {
      testFileCount += 1;
    }
  }

  for (const [name, script] of Object.entries(pkg?.scripts ?? {})) {
    if (/\b(test|playwright|vitest|jest|cypress)\b/.test(`${name} ${script}`) && tooling.length < 20) {
      tooling.push(`script: ${name}`);
    }
  }

  return { tooling: [...new Set(tooling)], testFileCount };
}

const MAX_ROUTES_EXTRACTED = 250;

/** Replace Next.js dynamic segments with a concrete sample so the route is callable. */
function sampleDynamic(url: string): string {
  return url
    .replace(/\[\[?\.\.\.[^\]]+\]\]?/g, "42") // [...slug] / [[...slug]]
    .replace(/\[[^\]]+\]/g, "42"); // [id]
}

/** Map a route source file (App Router, Pages Router, or bare api/) to its URL path. */
function routeFileToUrl(rel: string): { url: string; kind: "page" | "api" } | null {
  const r = rel.replace(/\\/g, "/");

  // App Router: app/(group)/admin/page.tsx → /admin ; app/api/x/route.ts → /api/x
  let m = r.match(/(?:^|\/)(?:src\/)?app\/(.*)\/(page|route)\.(?:t|j)sx?$/);
  if (m) {
    const kind = m[2] === "route" ? "api" : "page";
    const seg = m[1]
      .split("/")
      .filter((s) => s && !/^\(.*\)$/.test(s) && !s.startsWith("@")) // drop route groups + parallel slots
      .join("/");
    const url = (sampleDynamic("/" + seg).replace(/\/+$/, "") || "/");
    return { url, kind };
  }
  // App Router root: app/page.tsx → / ; app/route.ts → /
  m = r.match(/(?:^|\/)(?:src\/)?app\/(page|route)\.(?:t|j)sx?$/);
  if (m) return { url: "/", kind: m[1] === "route" ? "api" : "page" };

  // Pages Router API: pages/api/x.ts → /api/x
  m = r.match(/(?:^|\/)(?:src\/)?pages\/api\/(.*)\.(?:t|j)sx?$/);
  if (m) return { url: sampleDynamic("/api/" + m[1].replace(/\/index$/, "")), kind: "api" };

  // Pages Router page: pages/about.tsx → /about
  m = r.match(/(?:^|\/)(?:src\/)?pages\/(.*)\.(?:t|j)sx?$/);
  if (m && !/^api\//.test(m[1]) && !path.basename(m[1]).startsWith("_")) {
    const url = sampleDynamic("/" + m[1].replace(/\/index$/, "").replace(/^index$/, "")).replace(/\/+$/, "") || "/";
    return { url, kind: "page" };
  }

  // Bare serverless functions: api/x.ts → /api/x
  m = r.match(/^api\/(.*)\.(?:t|j)sx?$/);
  if (m) return { url: sampleDynamic("/api/" + m[1].replace(/\/index$/, "")), kind: "api" };

  return null;
}

function isPrivilegedUrl(url: string): boolean {
  return /(^|\/)(admin|superadmin|internal)(\/|$)/.test(url);
}

/** Read an API route file to learn which HTTP methods it actually exports. */
async function extractApiMethods(absFile: string): Promise<string[]> {
  try {
    const src = await fs.readFile(absFile, "utf8");
    const methods = new Set<string>();
    for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)) methods.add(m[1]);
    for (const m of src.matchAll(/export\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*[:=]/g)) methods.add(m[1]);
    // Pages Router default handler accepts any method.
    if (methods.size === 0 && /export\s+default\b/.test(src)) return ["GET", "POST"];
    return [...methods];
  } catch {
    return [];
  }
}

/** Turn discovered route files into concrete, callable routes with methods + privilege flags. */
async function extractRoutes(repoPath: string, files: string[]): Promise<ScannedRoute[]> {
  const routes: ScannedRoute[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    if (routes.length >= MAX_ROUTES_EXTRACTED) break;
    if (!SOURCE_EXTENSIONS.has(path.extname(file))) continue;
    const rel = path.relative(repoPath, file).replaceAll(path.sep, "/");
    const mapped = routeFileToUrl(rel);
    if (!mapped) continue;
    const key = `${mapped.kind} ${mapped.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const methods = mapped.kind === "api" ? await extractApiMethods(file) : ["GET"];
    routes.push({ file: rel, url_path: mapped.url, kind: mapped.kind, methods, privileged: isPrivilegedUrl(mapped.url) });
  }
  return routes;
}

export async function scanRepo(repoPath: string): Promise<RepoScan> {
  const resolved = path.resolve(repoPath);
  const stat = await fs.stat(resolved);
  if (!stat.isDirectory()) {
    throw new Error(`Repo path is not a directory: ${resolved}`);
  }

  const pkg = await readPackageJson(resolved);
  const frameworkEvidence: string[] = [];
  let framework = detectFramework(pkg, frameworkEvidence);

  if (!framework.includes("TypeScript")) {
    try {
      await fs.access(path.join(resolved, "tsconfig.json"));
      frameworkEvidence.push("config: tsconfig.json");
      framework = framework.replace("/ JavaScript", "/ TypeScript");
      if (!framework.includes("TypeScript")) {
        framework = `${framework} / TypeScript`;
      }
    } catch {
      // no tsconfig; keep detection as-is
    }
  }
  const packageManager = await detectPackageManager(resolved);

  const { files, truncated } = await walk(resolved);

  const sampledRoutes: string[] = [];
  const { routeCount, apiRouteCount } = countRoutes(resolved, files, sampledRoutes);
  const routes = await extractRoutes(resolved, files);

  const expectedEnv = await collectEnvExpectations(files);
  const envSources: string[] = [];
  const presentEnv = await collectEnvPresent(resolved, envSources);

  const envKeysPresent = [...expectedEnv].filter((key) => presentEnv.has(key)).sort();
  const envKeysMissing = [...expectedEnv].filter((key) => !presentEnv.has(key)).sort();

  const { tooling, testFileCount } = detectTestTooling(pkg, files, resolved);

  const scripts = Object.keys(pkg?.scripts ?? {}).map((name) => `${packageManager} run ${name}`);

  return {
    repo_summary: {
      framework,
      package_manager: packageManager,
      scripts,
      route_count: routeCount,
      api_route_count: apiRouteCount,
      env_keys_present: envKeysPresent,
      env_keys_missing: envKeysMissing,
    },
    detail: {
      repo_path: resolved,
      scanned_at: new Date().toISOString(),
      framework_evidence: frameworkEvidence,
      test_tooling: tooling,
      test_file_count: testFileCount,
      route_files_sampled: sampledRoutes,
      routes,
      env_sources: envSources,
      files_walked: files.length,
      truncated,
    },
  };
}

export async function probeRuntime(appUrl: string, timeoutMs = 4000): Promise<RunnerSyncPayload["runtime_summary"]> {
  let reachable = false;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(appUrl, { method: "GET", redirect: "follow", signal: controller.signal });
    clearTimeout(timer);
    reachable = response.status < 500;
  } catch {
    reachable = false;
  }

  return {
    app_url: appUrl,
    reachable,
    console_errors: 0,
    failed_requests: reachable ? 0 : 1,
    auth_state: "missing",
  };
}
