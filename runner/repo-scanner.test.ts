import { test, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import {
  extractApiMethods,
  extractJsxRoutes,
  extractRouteObjectRoutes,
  extractSpaRoutes,
  scanRepo,
  sourceHasAuthGuard,
} from "./repo-scanner.ts";

// These assert against the platform's own API handlers, which are the exact
// shapes that previously produced write-authz false positives. The scanner must
// read each handler's real `request.method` guards, not assume GET+POST.
const root = path.resolve(import.meta.dirname, "..");
const api = (p: string) => path.join(root, "server/api-src", p);

test("GET-only default handler is not flagged as accepting POST", async () => {
  assert.deepEqual((await extractApiMethods(api("campaign.ts"))).sort(), ["GET"]);
});

test("dual GET/POST handler reports both verbs", async () => {
  assert.deepEqual((await extractApiMethods(api("campaigns.ts"))).sort(), ["GET", "POST"]);
});

test("POST-only handlers report only POST", async () => {
  assert.deepEqual((await extractApiMethods(api("runner/sync.ts"))).sort(), ["POST"]);
  assert.deepEqual((await extractApiMethods(api("storage/register-artifact.ts"))).sort(), ["POST"]);
});

// ---------------------------------------------------------------------------
// Temp-repo helper for scanRepo end-to-end tests
// ---------------------------------------------------------------------------

const tempRepos: string[] = [];

async function makeRepo(files: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "launchaudit-scan-"));
  tempRepos.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content);
  }
  return dir;
}

after(async () => {
  for (const dir of tempRepos) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

function byUrl(routes: Array<{ url_path: string; kind: string }>, url: string, kind = "page") {
  return routes.find((r) => r.url_path === url && r.kind === kind);
}

// ---------------------------------------------------------------------------
// React Router parsers (pure)
// ---------------------------------------------------------------------------

test("JSX <Route> parser handles nesting, absolute children, and guard wrappers", () => {
  const src = `
    import { Routes, Route } from "react-router-dom";
    export default function App() {
      return (
        <Routes>
          <Route path="/admin" element={<Layout />}>
            <Route path="users" element={<Users />} />
            <Route path="/absolute" element={<Abs />} />
          </Route>
          <RequireAuth>
            <Route path="/billing" element={<Billing />} />
          </RequireAuth>
          <Route path="/public" element={<Pub />} />
        </Routes>
      );
    }
  `;
  const routes = extractJsxRoutes(src);
  const paths = routes.map((r) => r.path);
  assert.deepEqual(paths, ["/admin", "/admin/users", "/absolute", "/billing", "/public"]);
  assert.equal(routes.find((r) => r.path === "/billing")?.privileged, true, "RequireAuth wrapper marks privileged");
  assert.equal(routes.find((r) => r.path === "/public")?.privileged, false);
});

test("JSX <Route> parser marks routes guarded via element={<ProtectedRoute …>} attrs", () => {
  const src = `<Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />`;
  const routes = extractJsxRoutes(src);
  assert.deepEqual(routes, [{ path: "/dashboard", privileged: true }]);
});

test("createBrowserRouter object parser handles nested children and loader guards", () => {
  const src = `
    const router = createBrowserRouter([
      {
        path: "/",
        element: h(Root),
        children: [
          {
            path: "reports",
            loader: requireAuth,
            children: [{ path: ":reportId", element: h(Report) }],
          },
        ],
      },
      { path: "/login", element: h(Login) },
    ]);
  `;
  const routes = extractRouteObjectRoutes(src);
  const reports = routes.find((r) => r.path === "/reports");
  const detail = routes.find((r) => r.path === "/reports/:reportId");
  const login = routes.find((r) => r.path === "/login");
  assert.ok(reports && detail && login, `expected routes present, got ${JSON.stringify(routes)}`);
  assert.equal(reports.privileged, true, "requireAuth loader marks privileged");
  assert.equal(detail.privileged, true, "children inherit the guard");
  assert.equal(login.privileged, false);
});

test("useRoutes object form is parsed and dynamic segments are sampled", () => {
  const src = `
    function App() {
      const element = useRoutes([
        { path: "/", element: h(Home) },
        { path: "/users/:id", element: h(User) },
        { path: "/docs/*", element: h(Docs) },
      ]);
      return element;
    }
  `;
  const routes = extractSpaRoutes(src);
  const paths = routes.map((r) => r.path).sort();
  assert.deepEqual(paths, ["/", "/docs/42", "/users/42"]);
});

test("extractSpaRoutes applies the admin-URL heuristic on top of source guards", () => {
  const routes = extractSpaRoutes(`<Route path="/admin/flags" element={<Flags />} />`);
  assert.deepEqual(routes, [{ path: "/admin/flags", privileged: true }]);
});

// ---------------------------------------------------------------------------
// sourceHasAuthGuard heuristic
// ---------------------------------------------------------------------------

test("sourceHasAuthGuard catches common guard shapes and skips plain modules", () => {
  assert.equal(sourceHasAuthGuard(`const session = await getServerSession(req, res, authOptions);`), true);
  assert.equal(sourceHasAuthGuard(`if (user.role !== "admin") return res.status(403).end();`), true);
  assert.equal(sourceHasAuthGuard(`export const loader = requireAuth(async () => data());`), true);
  assert.equal(sourceHasAuthGuard(`export default function About() { return <p>hello</p>; }`), false);
});

// ---------------------------------------------------------------------------
// Vite + React Router end-to-end (scanRepo)
// ---------------------------------------------------------------------------

test("scanRepo discovers React Router routes in a Vite SPA", async () => {
  const repo = await makeRepo({
    "package.json": JSON.stringify({
      name: "spa",
      dependencies: { react: "^18.0.0", "react-router-dom": "^6.0.0" },
      devDependencies: { vite: "^5.0.0" },
    }),
    "vite.config.ts": "export default {};\n",
    "src/App.tsx": `
      import { Routes, Route } from "react-router-dom";
      import { RequireAuth } from "./auth";
      export default function App() {
        return (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/users/:id" element={<User />} />
            <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/settings">
              <Route path="profile" element={<Profile />} />
            </Route>
          </Routes>
        );
      }
    `,
  });

  const scan = await scanRepo(repo);
  const routes = scan.detail.routes;
  for (const url of ["/", "/about", "/users/42", "/dashboard", "/settings", "/settings/profile"]) {
    assert.ok(byUrl(routes, url), `expected page route ${url}, got ${JSON.stringify(routes.map((r) => r.url_path))}`);
  }
  assert.equal(byUrl(routes, "/dashboard")?.privileged, true, "RequireAuth-wrapped route is privileged");
  assert.equal(byUrl(routes, "/about")?.privileged, false);
  assert.ok(scan.repo_summary.route_count >= 6, "summary route_count reflects extracted SPA routes");
});

// ---------------------------------------------------------------------------
// SvelteKit end-to-end (scanRepo)
// ---------------------------------------------------------------------------

test("scanRepo discovers SvelteKit pages and +server endpoints", async () => {
  const repo = await makeRepo({
    "package.json": JSON.stringify({
      name: "sk",
      devDependencies: { "@sveltejs/kit": "^2.0.0", svelte: "^4.0.0" },
    }),
    "src/routes/+page.svelte": "<h1>home</h1>\n",
    "src/routes/about/+page.svelte": "<h1>about</h1>\n",
    "src/routes/blog/[slug]/+page.svelte": "<h1>post</h1>\n",
    "src/routes/(app)/dashboard/+page.svelte": "<h1>dash</h1>\n",
    "src/routes/(app)/dashboard/+page.server.ts":
      "import { requireAuth } from '$lib/auth';\nexport const load = requireAuth(async () => ({}));\n",
    "src/routes/api/items/+server.ts":
      "export async function GET() { return new Response('[]'); }\nexport async function POST() { return new Response('ok'); }\n",
  });

  const scan = await scanRepo(repo);
  const routes = scan.detail.routes;

  for (const url of ["/", "/about", "/blog/42", "/dashboard"]) {
    assert.ok(byUrl(routes, url), `expected page route ${url}, got ${JSON.stringify(routes.map((r) => r.url_path))}`);
  }
  const items = byUrl(routes, "/api/items", "api");
  assert.ok(items, "expected /api/items endpoint");
  assert.deepEqual([...items.methods].sort(), ["GET", "POST"]);
  assert.equal(byUrl(routes, "/dashboard")?.privileged, true, "sibling +page.server.ts guard marks the page privileged");
  assert.equal(byUrl(routes, "/about")?.privileged, false);
  assert.ok(scan.repo_summary.framework.includes("SvelteKit"), `framework should be SvelteKit, got ${scan.repo_summary.framework}`);
});

// ---------------------------------------------------------------------------
// tRPC mount discovery
// ---------------------------------------------------------------------------

test("scanRepo surfaces the tRPC mount path from an Express adapter", async () => {
  const repo = await makeRepo({
    "package.json": JSON.stringify({
      name: "trpc-app",
      dependencies: { "@trpc/server": "^11.0.0", express: "^4.0.0" },
    }),
    "server.ts": `
      import express from "express";
      import { createExpressMiddleware } from "@trpc/server/adapters/express";
      import { appRouter } from "./router";
      const app = express();
      app.use("/api/trpc", createExpressMiddleware({ router: appRouter }));
      app.listen(3000);
    `,
  });

  const scan = await scanRepo(repo);
  const trpc = byUrl(scan.detail.routes, "/api/trpc", "api");
  assert.ok(trpc, `expected /api/trpc api route, got ${JSON.stringify(scan.detail.routes)}`);
  assert.deepEqual([...trpc.methods].sort(), ["GET", "POST"]);
  assert.equal(trpc.file, "server.ts");
});

test("scanRepo falls back to /api/trpc when @trpc/server is present but no mount string is found", async () => {
  const repo = await makeRepo({
    "package.json": JSON.stringify({ name: "trpc-min", dependencies: { "@trpc/server": "^11.0.0" } }),
    "src/router.ts": "export const appRouter = {};\n",
  });

  const scan = await scanRepo(repo);
  const trpc = byUrl(scan.detail.routes, "/api/trpc", "api");
  assert.ok(trpc, "expected default /api/trpc mount");
  assert.equal(trpc.file, "package.json");
});

// ---------------------------------------------------------------------------
// Guard heuristic on file-based routes + privilege-prioritized truncation
// ---------------------------------------------------------------------------

test("Next pages with auth guards in source are privileged even without admin in the URL", async () => {
  const repo = await makeRepo({
    "package.json": JSON.stringify({ name: "next-app", dependencies: { next: "^14.0.0" } }),
    "pages/index.tsx": "export default function Home() { return null; }\n",
    "pages/account.tsx":
      "import { getServerSession } from 'next-auth';\nexport default function Account() { return null; }\n",
  });

  const scan = await scanRepo(repo);
  assert.equal(byUrl(scan.detail.routes, "/account")?.privileged, true);
  assert.equal(byUrl(scan.detail.routes, "/")?.privileged, false);
});

test("route-cap truncation keeps privileged routes first", async () => {
  const files: Record<string, string> = {
    "package.json": JSON.stringify({ name: "big-app", dependencies: { next: "^14.0.0" } }),
    // Sorts after every pages/pNNN file, so a naive first-250 cut would drop it.
    "pages/zz/admin.tsx": "export default function Admin() { return null; }\n",
  };
  for (let i = 0; i < 259; i += 1) {
    files[`pages/p${String(i).padStart(3, "0")}.tsx`] = "export default function P() { return null; }\n";
  }

  const scan = await scanRepo(await makeRepo(files));
  const routes = scan.detail.routes;
  assert.equal(routes.length, 250, "route extraction cap holds");
  assert.equal(routes[0].url_path, "/zz/admin", "privileged route survives truncation at the front");
  assert.equal(routes[0].privileged, true);
});
