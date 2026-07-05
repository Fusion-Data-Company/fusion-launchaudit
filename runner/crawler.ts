/**
 * Runtime crawler — opens the target app in a real browser and maps what
 * actually exists. Originally this read links from the HOME PAGE ONLY (capped at
 * 10), so an app's real surface — dashboards, settings, nested admin, anything a
 * click away — was invisible and every downstream check was starved.
 *
 * It now does a BOUNDED breadth-first crawl:
 *   - follows in-page same-origin links to a small depth (budget-capped),
 *   - optionally reuses a captured login session so pages behind auth are reached,
 *   - records same-origin fetch/XHR traffic to discover API routes that only
 *     exist in client code (never in a route file),
 *   - harvests REAL record ids from live URLs + JSON bodies so dynamic routes
 *     (/products/[id]) can be probed against something that actually exists
 *     instead of the hardcoded "42".
 *
 * The home page still sets every scalar field exactly as before (reachable,
 * title, console-errors-on-load, form/button counts, password field) so platform
 * detection and existing consumers are unchanged; the crawl only ADDS surface.
 */
import { launchBrowser } from "./browser.ts";

export type CrawlLink = { href: string; text: string };
export type ApiRoute = { path: string; method: string };

export type RuntimeCrawl = {
  app_url: string;
  reachable: boolean;
  title: string;
  links: CrawlLink[];
  form_count: number;
  button_count: number;
  has_password_field: boolean;
  console_errors_on_load: number;
  crawled_at: string;
  /** When reachable is false, a plain-English reason (HTTP status, DNS, timeout). */
  unreachable_reason?: string;
  // --- added by the bounded BFS crawl (all optional; older callers/tests unaffected) ---
  /** How many distinct pages the crawl actually visited (>=1). */
  pages_crawled?: number;
  /** Deepest BFS level reached from the home page (home = 0). */
  max_depth_reached?: number;
  /** Same-origin API endpoints observed in fetch/XHR traffic during the crawl. */
  api_routes?: ApiRoute[];
  /** Real ids seen live, keyed by the resource segment before them (products -> "1023"). */
  sampled_ids?: Record<string, string>;
  /** True when the crawl ran with a captured auth session (reached pages behind login). */
  authenticated?: boolean;
};

export type CrawlOptions = {
  /** Playwright storage-state file from capture-auth; when set, the crawl is authenticated. */
  storageStatePath?: string;
  /** BFS depth from the home page (home = 0). Default 2. */
  maxDepth?: number;
  /** Hard cap on pages visited. Default 20. */
  maxPages?: number;
  /** Wall-clock budget for the whole crawl. Default 45s. */
  timeBudgetMs?: number;
};

const LINKS_CAP = 100;
const API_CAP = 60;
const IDS_CAP = 40;
const JSON_BODY_CAP = 262_144; // 256 KB — don't read giant payloads to harvest ids
const JSON_RESPONSES_CAP = 25; // only inspect the first N JSON responses for ids

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit tests — no browser needed).
// ---------------------------------------------------------------------------

/** Normalize an href to a same-origin, query/hash-stripped absolute URL, or null to drop it. */
export function normalizeLink(href: string, origin: string): string | null {
  if (!href) return null;
  let abs: URL;
  try { abs = new URL(href, origin); } catch { return null; }
  if (abs.origin !== origin) return null;
  if (!/^https?:$/.test(abs.protocol)) return null; // drop mailto:, tel:, javascript:
  const normalized = abs.origin + abs.pathname.replace(/\/$/, "");
  if (normalized === origin || normalized === origin + "/") return null; // the home page itself
  return normalized || null;
}

/** Does this path look like an API endpoint (vs a navigable page)? */
export function looksLikeApi(path: string): boolean {
  return /(^|\/)(api|graphql|trpc|rest|v\d+|rpc)(\/|$)/i.test(path) || /\.(json)$/i.test(path);
}

/**
 * Pull real ids out of a path, keyed by the resource segment that precedes them.
 * `/products/1023/reviews/7` -> { products: "1023", reviews: "7" }.
 * Recognizes numeric ids and UUIDs; ignores obvious non-ids.
 */
export function sampleIdsFromPath(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  const segs = path.split("/").filter(Boolean);
  const isId = (s: string) => /^\d{1,}$/.test(s) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
  for (let i = 1; i < segs.length; i++) {
    if (isId(segs[i]) && !isId(segs[i - 1])) {
      const key = segs[i - 1].toLowerCase();
      if (!(key in out)) out[key] = segs[i];
    }
  }
  return out;
}

/** Extract a few id-like values from a JSON text body. Bounded + defensive. */
export function extractIdsFromJsonText(text: string, limit = 12): string[] {
  const ids: string[] = [];
  const re = /"(?:id|_id|uuid|slug)"\s*:\s*(?:"([^"]{1,64})"|(\d{1,}))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && ids.length < limit) {
    const v = m[1] ?? m[2];
    if (v) ids.push(v);
  }
  return ids;
}

/** Merge a secondary crawl's discovered surface into a primary one (dedup, caps). */
export function mergeDiscovered(primary: RuntimeCrawl, secondary: RuntimeCrawl): RuntimeCrawl {
  const linkSeen = new Set(primary.links.map((l) => l.href));
  const links = [...primary.links];
  for (const l of secondary.links) {
    if (!linkSeen.has(l.href) && links.length < LINKS_CAP) { linkSeen.add(l.href); links.push(l); }
  }
  const apiSeen = new Set((primary.api_routes ?? []).map((a) => `${a.method} ${a.path}`));
  const api_routes = [...(primary.api_routes ?? [])];
  for (const a of secondary.api_routes ?? []) {
    const k = `${a.method} ${a.path}`;
    if (!apiSeen.has(k) && api_routes.length < API_CAP) { apiSeen.add(k); api_routes.push(a); }
  }
  const sampled_ids = { ...(secondary.sampled_ids ?? {}), ...(primary.sampled_ids ?? {}) };
  return {
    ...primary,
    links,
    api_routes,
    sampled_ids,
    pages_crawled: (primary.pages_crawled ?? 1) + (secondary.pages_crawled ?? 0),
    authenticated: primary.authenticated || secondary.authenticated,
  };
}

// ---------------------------------------------------------------------------
// The crawl.
// ---------------------------------------------------------------------------

export async function crawlRuntime(appUrl: string, opts: CrawlOptions = {}): Promise<RuntimeCrawl> {
  const base = appUrl.replace(/\/$/, "");
  const origin = new URL(base).origin;
  const maxDepth = opts.maxDepth ?? 2;
  const maxPages = opts.maxPages ?? 20;
  const timeBudgetMs = opts.timeBudgetMs ?? 45_000;
  const deadline = Date.now() + timeBudgetMs;

  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    ...(opts.storageStatePath ? { storageState: opts.storageStatePath } : {}),
  });
  const page = await context.newPage();

  let consoleErrors = 0;
  page.on("console", (message) => { if (message.type() === "error") consoleErrors += 1; });

  // Same-origin API discovery from real traffic + id harvesting from JSON bodies.
  const apiSeen = new Set<string>();
  const apiRoutes: ApiRoute[] = [];
  const sampledIds: Record<string, string> = {};
  let jsonInspected = 0;
  const recordApi = (method: string, urlStr: string) => {
    let u: URL; try { u = new URL(urlStr); } catch { return; }
    if (u.origin !== origin) return;
    if (!looksLikeApi(u.pathname)) return;
    const key = `${method} ${u.pathname}`;
    if (!apiSeen.has(key) && apiRoutes.length < API_CAP) { apiSeen.add(key); apiRoutes.push({ path: u.pathname, method }); }
  };
  const addIds = (obj: Record<string, string>) => {
    for (const [k, v] of Object.entries(obj)) if (Object.keys(sampledIds).length < IDS_CAP && !(k in sampledIds)) sampledIds[k] = v;
  };
  page.on("request", (req) => {
    const type = req.resourceType();
    if (type === "xhr" || type === "fetch") recordApi(req.method(), req.url());
  });
  page.on("response", async (res) => {
    try {
      if (jsonInspected >= JSON_RESPONSES_CAP) return;
      const ct = (res.headers()["content-type"] ?? "").toLowerCase();
      if (!ct.includes("application/json")) return;
      const clen = Number(res.headers()["content-length"] ?? "0");
      if (clen > JSON_BODY_CAP) return;
      jsonInspected += 1;
      const text = await res.text();
      if (text.length > JSON_BODY_CAP) return;
      for (const id of extractIdsFromJsonText(text)) {
        // key JSON-harvested ids by the request's resource segment when we can infer it
        const reqPath = (() => { try { return new URL(res.url()).pathname; } catch { return ""; } })();
        const segs = reqPath.split("/").filter((s) => s && !looksLikeApi(`/${s}`) && !/^\d+$/.test(s));
        const key = segs[segs.length - 1]?.toLowerCase() ?? "id";
        if (Object.keys(sampledIds).length < IDS_CAP && !(key in sampledIds)) sampledIds[key] = id;
      }
    } catch { /* body unavailable / streamed — skip */ }
  });

  const result: RuntimeCrawl = {
    app_url: base, reachable: false, title: "", links: [], form_count: 0, button_count: 0,
    has_password_field: false, console_errors_on_load: 0, crawled_at: new Date().toISOString(),
    pages_crawled: 0, max_depth_reached: 0, api_routes: apiRoutes, sampled_ids: sampledIds,
    authenticated: Boolean(opts.storageStatePath),
  };

  const linkSeen = new Set<string>();
  const links: CrawlLink[] = [];
  const visited = new Set<string>();
  const frontier: Array<{ url: string; depth: number }> = [{ url: base, depth: 0 }];

  const scrapePage = async (): Promise<{ links: CrawlLink[]; form_count: number; button_count: number; has_password_field: boolean }> =>
    page.evaluate((originStr) => {
      const found: Array<{ href: string; text: string }> = [];
      for (const a of document.querySelectorAll("a[href]")) {
        const href = (a as HTMLAnchorElement).href;
        if (!href.startsWith(originStr)) continue;
        found.push({ href, text: (a.textContent ?? "").trim().slice(0, 60) });
      }
      return {
        links: found,
        form_count: document.querySelectorAll("form").length,
        button_count: document.querySelectorAll("button, [role=button]").length,
        has_password_field: document.querySelectorAll('input[type="password"]').length > 0,
      };
    }, origin);

  try {
    while (frontier.length && visited.size < maxPages && Date.now() < deadline) {
      const { url, depth } = frontier.shift()!;
      if (visited.has(url)) continue;
      visited.add(url);
      const isHome = visited.size === 1;

      let status: number | undefined;
      try {
        const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: isHome ? 30000 : 15000 });
        status = response?.status();
      } catch (e) {
        if (isHome) throw e; // home unreachable is fatal — report it like before
        continue; // a deep page failed — skip it, keep crawling
      }
      // Best-effort settle for SPA hydration / async content.
      try { await page.waitForLoadState("networkidle", { timeout: isHome ? 6000 : 3000 }); } catch { /* busy app — fine */ }
      await page.waitForTimeout(isHome ? 800 : 300);

      if (isHome) {
        result.reachable = Boolean(status !== undefined && status < 500);
        if (!result.reachable) {
          result.unreachable_reason = status === undefined
            ? "no HTTP response from the server"
            : `the site returned HTTP ${status} (server error — the deployment is up but failing)`;
        }
        result.title = await page.title();
      }

      const dom = await scrapePage();
      if (isHome) {
        result.form_count = dom.form_count;
        result.button_count = dom.button_count;
        result.has_password_field = dom.has_password_field;
        result.console_errors_on_load = consoleErrors;
      }
      result.max_depth_reached = Math.max(result.max_depth_reached ?? 0, depth);

      for (const raw of dom.links) {
        const norm = normalizeLink(raw.href, origin);
        if (!norm) continue;
        addIds(sampleIdsFromPath(new URL(norm).pathname));
        if (!linkSeen.has(norm) && links.length < LINKS_CAP) {
          linkSeen.add(norm);
          links.push({ href: norm, text: raw.text });
          if (depth + 1 <= maxDepth && !visited.has(norm)) frontier.push({ url: norm, depth: depth + 1 });
        }
      }
    }

    result.links = links;
    result.pages_crawled = visited.size;
  } catch (e) {
    result.reachable = false;
    const msg = e instanceof Error ? e.message : String(e);
    result.unreachable_reason = /ERR_NAME_NOT_RESOLVED|getaddrinfo|ENOTFOUND/i.test(msg)
      ? "the domain did not resolve (DNS) — check the URL or that the site is still hosted there"
      : /timeout|ERR_TIMED_OUT/i.test(msg)
        ? "the request timed out after 30s — the server is unreachable or extremely slow"
        : `navigation failed: ${msg.split("\n")[0].slice(0, 120)}`;
  }

  await browser.close();
  return result;
}
