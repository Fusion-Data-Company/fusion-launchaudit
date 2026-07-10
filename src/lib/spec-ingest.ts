/**
 * OpenAPI / HAR ingestion — auto-discover the API surface so the authorization wedge runs
 * against EVERY parameterized endpoint, not just what a hints file hand-lists. Feed an
 * OpenAPI spec (the contract) or a recorded HAR (real traffic) and we derive endpoints +
 * their methods, sampling path/id parameters so IDOR/BOLA/write-authz probes have targets.
 * 10x the moat's coverage with zero hand-authoring. Pure parsers, no network, no deps.
 */

export type IngestedEndpoint = { path: string; methods: string[]; hasIdParam: boolean; write: boolean };

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Replace OpenAPI {id}/{userId} templates with a concrete sample so probes have a real URL.
function sampleTemplate(p: string): { path: string; hasIdParam: boolean } {
  let hasId = false;
  const path = p.replace(/\{([^}]+)\}/g, (_m, name) => {
    hasId = true;
    return /id$|^id$/i.test(String(name)) ? "1" : "sample";
  });
  return { path, hasIdParam: hasId };
}

/** Parse an OpenAPI 3.x (or Swagger 2) document's paths into endpoints. */
export function parseOpenApi(doc: unknown): IngestedEndpoint[] {
  const paths = (doc as { paths?: Record<string, Record<string, unknown>> })?.paths;
  if (!paths || typeof paths !== "object") return [];
  const out: IngestedEndpoint[] = [];
  for (const [rawPath, ops] of Object.entries(paths)) {
    if (!rawPath.startsWith("/") || !ops || typeof ops !== "object") continue;
    const methods = Object.keys(ops)
      .filter((k) => ["get", "post", "put", "patch", "delete"].includes(k.toLowerCase()))
      .map((m) => m.toUpperCase());
    if (methods.length === 0) continue;
    const { path, hasIdParam } = sampleTemplate(rawPath);
    out.push({ path, methods, hasIdParam, write: methods.some((m) => WRITE_METHODS.has(m)) });
  }
  return dedupe(out);
}

/** Parse a HAR (recorded browser session) into the same-origin API endpoints it exercised. */
export function parseHar(doc: unknown, sameOriginHost?: string): IngestedEndpoint[] {
  const entries = (doc as { log?: { entries?: Array<{ request?: { method?: string; url?: string } }> } })?.log?.entries;
  if (!Array.isArray(entries)) return [];
  const byPath = new Map<string, Set<string>>();
  for (const e of entries) {
    const url = e.request?.url;
    const method = (e.request?.method ?? "GET").toUpperCase();
    if (!url) continue;
    let u: URL;
    try { u = new URL(url); } catch { continue; }
    if (sameOriginHost && u.host !== sameOriginHost) continue;
    // Only keep API-ish paths (skip static assets) to stay meaningful.
    if (!/\/api\//.test(u.pathname) && !/^\/(graphql|rest|v\d+)\b/.test(u.pathname)) continue;
    if (/\.(js|css|png|jpg|jpeg|svg|gif|woff2?|ico|map)$/i.test(u.pathname)) continue;
    if (!byPath.has(u.pathname)) byPath.set(u.pathname, new Set());
    byPath.get(u.pathname)!.add(method);
  }
  const out: IngestedEndpoint[] = [];
  for (const [path, methods] of byPath) {
    const hasIdParam = /\/\d+(?:\/|$)/.test(path) || /\/[0-9a-f]{8}-[0-9a-f]{4}/i.test(path);
    out.push({ path, methods: [...methods], hasIdParam, write: [...methods].some((m) => WRITE_METHODS.has(m)) });
  }
  return dedupe(out);
}

function dedupe(list: IngestedEndpoint[]): IngestedEndpoint[] {
  const byPath = new Map<string, IngestedEndpoint>();
  for (const e of list) {
    const prev = byPath.get(e.path);
    if (prev) { prev.methods = [...new Set([...prev.methods, ...e.methods])]; prev.write = prev.write || e.write; prev.hasIdParam = prev.hasIdParam || e.hasIdParam; }
    else byPath.set(e.path, { ...e, methods: [...e.methods] });
  }
  return [...byPath.values()];
}

/**
 * Fold ingested endpoints into audit hints so the existing wedge generators (object-authz,
 * write-authz, mutation-authz, data-exposure) pick them up. Adds id-bearing endpoints as
 * protectedApis and write endpoints as writeApis/postEndpoints. Merges, never overwrites.
 */
export function endpointsToHints(endpoints: IngestedEndpoint[]): {
  protectedApis: Array<{ path: string; method: string }>;
  writeApis: Array<{ path: string; method: string }>;
  postEndpoints: Array<{ path: string }>;
} {
  const protectedApis: Array<{ path: string; method: string }> = [];
  const writeApis: Array<{ path: string; method: string }> = [];
  const postEndpoints: Array<{ path: string }> = [];
  for (const e of endpoints) {
    for (const m of e.methods) {
      if (m === "GET" && e.hasIdParam) protectedApis.push({ path: e.path, method: "GET" });
      if (WRITE_METHODS.has(m)) writeApis.push({ path: e.path, method: m });
      if (m === "POST") postEndpoints.push({ path: e.path });
    }
  }
  return { protectedApis, writeApis, postEndpoints };
}
