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
    ["@sveltejs/kit", "SvelteKit"],
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

/** Replace dynamic segments with a concrete sample so the route is callable. */
function sampleDynamic(url: string): string {
  return url
    .replace(/\[\[?\.\.\.[^\]]+\]\]?/g, "42") // [...slug] / [[...slug]] (Next.js catch-alls)
    .replace(/\[\[[^\]]+\]\]/g, "42") // [[optional]] (SvelteKit optional params)
    .replace(/\[[^\]]+\]/g, "42") // [id]
    .replace(/:[A-Za-z0-9_]+\??/g, "42") // :id / :id? (React Router / Express style)
    .replace(/\*/g, "42"); // splat routes
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

  // SvelteKit page: src/routes/blog/[slug]/+page.svelte → /blog/42
  // (drops (group) segments; +page@layout.svelte layout resets included)
  m = r.match(/(?:^|\/)src\/routes\/(?:(.*)\/)?\+page(?:@[^.]*)?\.svelte$/);
  if (m) {
    const seg = (m[1] ?? "")
      .split("/")
      .filter((s) => s && !/^\(.*\)$/.test(s))
      .join("/");
    return { url: sampleDynamic("/" + seg).replace(/\/+$/, "") || "/", kind: "page" };
  }

  // SvelteKit endpoint: src/routes/api/items/+server.ts → /api/items
  m = r.match(/(?:^|\/)src\/routes\/(?:(.*)\/)?\+server\.(?:t|j)s$/);
  if (m) {
    const seg = (m[1] ?? "")
      .split("/")
      .filter((s) => s && !/^\(.*\)$/.test(s))
      .join("/");
    return { url: sampleDynamic("/" + seg).replace(/\/+$/, "") || "/", kind: "api" };
  }

  return null;
}

function isPrivilegedUrl(url: string): boolean {
  return /(^|\/)(admin|superadmin|internal)(\/|$)/.test(url);
}

// ---------------------------------------------------------------------------
// Source-level privilege heuristic
// ---------------------------------------------------------------------------
// The URL substring test alone misses admin surfaces that don't say "admin" in
// the path. If the module implementing a route shows an auth/role guard, mark
// the route privileged too. False "privileged" is cheap (it just adds an RBAC
// check downstream); a false "public" on a guarded route is the costly miss.

const AUTH_GUARD_RE = new RegExp(
  "\\b(?:" +
    [
      "requireAuth\\w*", "requireAdmin\\w*", "requireRole", "requireUser", "requireSession",
      "ensureAuth\\w*", "ensureAdmin",
      "getServerSession", "getServerAuthSession",
      "withAuth\\w*", "isAuthenticated", "verifyAuth\\w*", "verifyAdmin",
      "checkAuth\\w*", "adminOnly", "assertAdmin", "assertAuth\\w*",
      "protect", "authGuard", "requiresAuth",
    ].join("|") +
    ")\\b",
);

const ROLE_CHECK_RE =
  /\brole\w*\s*(?:===|==|!==|!=)\s*["'`](?:admin|superadmin|staff|owner|moderator)["'`]|["'`](?:admin|superadmin)["'`]\s*(?:===|==|!==|!=)\s*[\w.$]*[Rr]ole\b/;

/** Auth-guard wrapper components commonly used around React Router routes. */
const GUARD_COMPONENT_NAMES = [
  "RequireAuth", "RequireAdmin", "RequireRole", "RequireUser",
  "ProtectedRoute", "PrivateRoute", "AuthGuard", "AdminGuard", "AdminRoute",
  "AuthenticatedRoute", "GuardedRoute",
];
const GUARD_COMPONENT_RE = new RegExp(`\\b(?:${GUARD_COMPONENT_NAMES.join("|")})\\b`);

export function sourceHasAuthGuard(src: string): boolean {
  return AUTH_GUARD_RE.test(src) || ROLE_CHECK_RE.test(src) || GUARD_COMPONENT_RE.test(src);
}

async function readSourceCapped(absFile: string): Promise<string | null> {
  try {
    const stat = await fs.stat(absFile);
    if (stat.size > MAX_ENV_SCAN_BYTES) return null;
    return await fs.readFile(absFile, "utf8");
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// React Router (Vite SPA) route extraction
// ---------------------------------------------------------------------------
// Vite + React Router apps define routes in code, not in the file system, so
// the file-path mapping above finds nothing. These lightweight, string-aware
// scanners pull route paths out of both definition styles without an AST
// dependency. Best-effort by design: a parse that goes sideways yields fewer
// routes, never a crash.

export type ExtractedSpaRoute = { path: string; privileged: boolean };

/** Skip a quoted string / template literal; `i` points at the opening quote. */
function skipStringLiteral(src: string, i: number): number {
  const quote = src[i];
  i += 1;
  while (i < src.length) {
    if (src[i] === "\\") {
      i += 2;
      continue;
    }
    if (src[i] === quote) return i + 1;
    i += 1;
  }
  return i;
}

/** Skip a balanced (...) / [...] / {...} group; `i` points at the opener. */
function skipBalancedGroup(src: string, i: number): number {
  let depth = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      i = skipStringLiteral(src, i);
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ")" || ch === "]" || ch === "}") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
    i += 1;
  }
  return i;
}

/** Skip an object-property value; stops after `,` or before the closing `}`. */
function skipValue(src: string, i: number): number {
  let depth = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      i = skipStringLiteral(src, i);
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") {
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === ")" || ch === "]" || ch === "}") {
      if (depth === 0) return i; // caller handles the closer
      depth -= 1;
      i += 1;
      continue;
    }
    if (ch === "," && depth === 0) return i + 1;
    i += 1;
  }
  return i;
}

/** React Router semantics: absolute child paths replace, relative ones nest. */
function joinRoutePath(parent: string, child: string): string {
  if (child.startsWith("/")) return child;
  const joined = `${parent.replace(/\/+$/, "")}/${child}`;
  return joined.startsWith("/") ? joined : `/${joined}`;
}

/** Parse JSX `<Route path="…">` trees, including nesting + guard wrappers. */
export function extractJsxRoutes(src: string): ExtractedSpaRoute[] {
  const out: ExtractedSpaRoute[] = [];
  const stack: Array<{ tag: string; resolved: string; guard: boolean }> = [];

  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt === -1) break;

    if (src[lt + 1] === "/") {
      // Closing tag: pop the matching frame (and anything left open above it).
      const gt = src.indexOf(">", lt);
      const name = src.slice(lt + 2, gt === -1 ? src.length : gt).trim();
      for (let s = stack.length - 1; s >= 0; s -= 1) {
        if (stack[s].tag === name) {
          stack.length = s;
          break;
        }
      }
      i = gt === -1 ? src.length : gt + 1;
      continue;
    }

    const nameMatch = /^([A-Za-z][\w.]*)/.exec(src.slice(lt + 1, lt + 80));
    if (!nameMatch) {
      i = lt + 1;
      continue;
    }
    const tag = nameMatch[1];

    // Find the end of the opening tag, respecting strings and {expr} attrs.
    let j = lt + 1 + tag.length;
    let depth = 0;
    let selfClosing = false;
    while (j < src.length) {
      const ch = src[j];
      if (ch === '"' || ch === "'" || ch === "`") {
        j = skipStringLiteral(src, j);
        continue;
      }
      if (ch === "{") depth += 1;
      else if (ch === "}") depth = Math.max(0, depth - 1);
      else if (ch === ">" && depth === 0) {
        selfClosing = src[j - 1] === "/";
        break;
      }
      j += 1;
    }
    const attrs = src.slice(lt + 1 + tag.length, j);
    const inheritedResolved = stack.length > 0 ? stack[stack.length - 1].resolved : "";
    const inheritedGuard = stack.length > 0 ? stack[stack.length - 1].guard : false;

    if (tag === "Route") {
      const pathAttr = attrs.match(/\bpath\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*["'`]([^"'`]*)["'`]\s*\})/);
      const own = pathAttr ? (pathAttr[1] ?? pathAttr[2] ?? pathAttr[3]) : null;
      const guard = inheritedGuard || AUTH_GUARD_RE.test(attrs) || GUARD_COMPONENT_RE.test(attrs);
      const resolved = own ? joinRoutePath(inheritedResolved, own) : inheritedResolved;
      if (own) out.push({ path: resolved, privileged: guard });
      if (!selfClosing) stack.push({ tag, resolved, guard });
    } else if (GUARD_COMPONENT_NAMES.includes(tag)) {
      if (!selfClosing) stack.push({ tag, resolved: inheritedResolved, guard: true });
    }
    i = j + 1;
  }
  return out;
}

function parseRouteObject(
  src: string,
  i: number,
  prefix: string,
  guardInherited: boolean,
  out: ExtractedSpaRoute[],
): number {
  const start = i; // src[i] === "{"
  i += 1;
  let pathValue: string | null = null;
  let childrenAt = -1;

  while (i < src.length) {
    const ch = src[i];
    if (ch === "}") {
      i += 1;
      break;
    }
    if (/\s|,/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") {
      // Computed key, method body, or similar — skip the whole group.
      i = skipBalancedGroup(src, i);
      continue;
    }

    // Read a property key: identifier or quoted string.
    let key: string | null = null;
    if (ch === '"' || ch === "'") {
      const end = skipStringLiteral(src, i);
      key = src.slice(i + 1, end - 1);
      i = end;
    } else {
      const idMatch = /^[A-Za-z_$][\w$]*/.exec(src.slice(i, i + 64));
      if (!idMatch) {
        i += 1;
        continue;
      }
      key = idMatch[0];
      i += key.length;
    }
    while (i < src.length && /\s/.test(src[i])) i += 1;
    if (src[i] !== ":") continue; // shorthand / spread / method — keep scanning
    i += 1;
    while (i < src.length && /\s/.test(src[i])) i += 1;

    if (key === "path" && (src[i] === '"' || src[i] === "'" || src[i] === "`")) {
      const end = skipStringLiteral(src, i);
      pathValue = src.slice(i + 1, end - 1);
      i = end;
    } else if (key === "children" && src[i] === "[") {
      childrenAt = i;
      i = skipValue(src, i);
    } else {
      i = skipValue(src, i);
    }
  }

  const objText = src.slice(start, i);
  const guard = guardInherited || sourceHasAuthGuard(objText);
  const resolved = pathValue ? joinRoutePath(prefix, pathValue) : prefix;
  if (pathValue) out.push({ path: resolved, privileged: guard });
  if (childrenAt !== -1) parseRouteArray(src, childrenAt, resolved, guard, out);
  return i;
}

function parseRouteArray(
  src: string,
  i: number,
  prefix: string,
  guard: boolean,
  out: ExtractedSpaRoute[],
): number {
  i += 1; // src[i] === "["
  while (i < src.length) {
    const ch = src[i];
    if (ch === "]") return i + 1;
    if (ch === "{") {
      i = parseRouteObject(src, i, prefix, guard, out);
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      i = skipStringLiteral(src, i);
      continue;
    }
    if (ch === "(" || ch === "[") {
      i = skipBalancedGroup(src, i);
      continue;
    }
    i += 1;
  }
  return i;
}

/** Parse `createBrowserRouter([...])` / `useRoutes([...])` object route trees. */
export function extractRouteObjectRoutes(src: string): ExtractedSpaRoute[] {
  const out: ExtractedSpaRoute[] = [];
  for (const m of src.matchAll(/\b(?:createBrowserRouter|createHashRouter|createMemoryRouter|useRoutes)\s*\(/g)) {
    let k = (m.index ?? 0) + m[0].length;
    while (k < src.length && /\s/.test(src[k])) k += 1;
    if (src[k] !== "[") continue; // router built from an identifier — can't trace it
    parseRouteArray(src, k, "", false, out);
  }
  return out;
}

/** All React Router routes in one module, deduped, with sampled dynamic segments. */
export function extractSpaRoutes(src: string): ExtractedSpaRoute[] {
  const raw = [
    ...(src.includes("<Route") ? extractJsxRoutes(src) : []),
    ...(/\b(?:createBrowserRouter|createHashRouter|createMemoryRouter|useRoutes)\s*\(/.test(src)
      ? extractRouteObjectRoutes(src)
      : []),
  ];
  const merged = new Map<string, boolean>();
  for (const r of raw) {
    const url = sampleDynamic(r.path).replace(/\/+$/, "") || "/";
    merged.set(url, (merged.get(url) ?? false) || r.privileged || isPrivilegedUrl(url));
  }
  return [...merged].map(([routePath, privileged]) => ({ path: routePath, privileged }));
}

/** Where a tRPC router is mounted, e.g. app.use("/api/trpc", …). */
const TRPC_MOUNT_RE = /["'`](\/[\w\-./]*trpc[\w\-./]*)["'`]/;

const HTTP_METHOD = "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS";

/** Read an API route file to learn which HTTP methods it actually exports. */
export async function extractApiMethods(absFile: string): Promise<string[]> {
  try {
    const src = await fs.readFile(absFile, "utf8");
    const methods = new Set<string>();
    // App Router: explicit named method exports are authoritative.
    for (const m of src.matchAll(new RegExp(`export\\s+(?:async\\s+)?function\\s+(${HTTP_METHOD})\\b`, "g"))) methods.add(m[1]);
    for (const m of src.matchAll(new RegExp(`export\\s+const\\s+(${HTTP_METHOD})\\s*[:=]`, "g"))) methods.add(m[1]);
    if (methods.size > 0) return [...methods];

    // Default-export / Pages-Router-style handler: infer the methods it actually
    // serves from its own `request.method` guards rather than blindly assuming
    // GET+POST. This is the difference between flagging a real write endpoint and
    // crying wolf on a GET-only handler that returns 405 for everything else.
    const guard = new RegExp(`req(?:uest)?\\.method\\s*(?:===|!==|==|!=)\\s*["'\`](${HTTP_METHOD})["'\`]`, "g");
    for (const m of src.matchAll(guard)) methods.add(m[1]);
    // OPTIONS/HEAD alone (e.g. a CORS preflight branch) doesn't tell us the real
    // verb the handler serves, so don't let it suppress the safe fallback.
    const meaningful = [...methods].filter((m) => m !== "HEAD" && m !== "OPTIONS");
    if (meaningful.length > 0) return [...methods];

    // Truly generic dispatcher: a default export with no discernible method guards.
    // Fall back to the safe assumption that it accepts reads and writes.
    if (/export\s+default\b/.test(src)) return ["GET", "POST"];
    return [];
  } catch {
    return [];
  }
}

/** SvelteKit guards usually live next door: +page.server.ts loads / +layout.server.ts. */
const SVELTEKIT_GUARD_SIBLINGS = [
  "+page.server.ts", "+page.server.js", "+page.ts", "+page.js",
  "+layout.server.ts", "+layout.server.js", "+layout.ts", "+layout.js",
];

/** Turn discovered route files into concrete, callable routes with methods + privilege flags. */
async function extractRoutes(repoPath: string, files: string[], pkg: PackageJson | null): Promise<ScannedRoute[]> {
  const routes: ScannedRoute[] = [];
  const seen = new Set<string>();
  const push = (route: ScannedRoute) => {
    const key = `${route.kind} ${route.url_path}`;
    if (seen.has(key)) return;
    seen.add(key);
    routes.push(route);
  };

  // 1) File-system routes: Next.js app/pages routers, bare api/, SvelteKit.
  for (const file of files) {
    const ext = path.extname(file);
    if (!SOURCE_EXTENSIONS.has(ext) && ext !== ".svelte") continue;
    const rel = path.relative(repoPath, file).replaceAll(path.sep, "/");
    const mapped = routeFileToUrl(rel);
    if (!mapped) continue;
    const methods = mapped.kind === "api" ? await extractApiMethods(file) : ["GET"];

    let privileged = isPrivilegedUrl(mapped.url);
    if (!privileged) {
      const src = await readSourceCapped(file);
      if (src && sourceHasAuthGuard(src)) privileged = true;
    }
    if (!privileged && ext === ".svelte") {
      // The guard for a SvelteKit page usually lives in its sibling load files.
      for (const sibling of SVELTEKIT_GUARD_SIBLINGS) {
        const src = await readSourceCapped(path.join(path.dirname(file), sibling));
        if (src && sourceHasAuthGuard(src)) {
          privileged = true;
          break;
        }
      }
    }
    push({ file: rel, url_path: mapped.url, kind: mapped.kind, methods, privileged });
  }

  // 2) Code-defined SPA routes (Vite + React Router) and tRPC mounts.
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const hasViteConfig = files.some((f) => /^vite\.config\.(?:js|ts|mjs|mts|cjs|cts)$/.test(path.basename(f)));
  const spaCandidate =
    Boolean(deps.vite) || hasViteConfig || Boolean(deps["react-router"]) || Boolean(deps["react-router-dom"]);
  const wantTrpc = Boolean(deps["@trpc/server"]);
  let trpcMount: { file: string; url: string } | null = null;

  if (spaCandidate || wantTrpc) {
    for (const file of files) {
      if (!SOURCE_EXTENSIONS.has(path.extname(file))) continue;
      const rel = path.relative(repoPath, file).replaceAll(path.sep, "/");
      const src = await readSourceCapped(file);
      if (!src) continue;
      if (spaCandidate) {
        for (const spaRoute of extractSpaRoutes(src)) {
          push({ file: rel, url_path: spaRoute.path, kind: "page", methods: ["GET"], privileged: spaRoute.privileged });
        }
      }
      if (wantTrpc && !trpcMount && /["'`]\/[^"'`\n]*trpc/.test(src)) {
        const m = src.match(TRPC_MOUNT_RE);
        if (m) trpcMount = { file: rel, url: m[1].replace(/\/+$/, "") || "/" };
      }
    }
  }

  // 3) tRPC: surface the router mount path unless file-based routes already cover it.
  if (wantTrpc) {
    const mountUrl = trpcMount?.url ?? "/api/trpc";
    const alreadyCovered = routes.some((r) => r.kind === "api" && r.url_path.startsWith(mountUrl));
    if (!alreadyCovered) {
      push({
        file: trpcMount?.file ?? "package.json",
        url_path: mountUrl,
        kind: "api",
        methods: ["GET", "POST"],
        privileged: isPrivilegedUrl(mountUrl),
      });
    }
  }

  // 4) Privilege-prioritized truncation: if the cap drops routes, admin/guarded
  // surfaces are the ones we can least afford to lose — keep them first.
  if (routes.length > MAX_ROUTES_EXTRACTED) {
    const privileged = routes.filter((r) => r.privileged);
    const rest = routes.filter((r) => !r.privileged);
    return [...privileged, ...rest].slice(0, MAX_ROUTES_EXTRACTED);
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
  const counted = countRoutes(resolved, files, sampledRoutes);
  const routes = await extractRoutes(resolved, files, pkg);
  // Code-defined routes (React Router SPAs, tRPC mounts) have no route files to
  // count, so keep the summary honest by never reporting fewer routes than we
  // actually extracted.
  const routeCount = Math.max(counted.routeCount, routes.filter((r) => r.kind === "page").length);
  const apiRouteCount = Math.max(counted.apiRouteCount, routes.filter((r) => r.kind === "api").length);

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
