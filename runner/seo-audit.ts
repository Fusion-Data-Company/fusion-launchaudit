/**
 * SEO + structured-data auditing. Operates on the INITIAL server HTML — the
 * exact bytes a crawler/social-unfurler sees — not the hydrated DOM, because
 * that is the surface search and sharing actually read. One assertion per card
 * (each its own evidenced pass/fail), mirroring the ElevenLabs detector.
 *
 * Truth-Protocol: presence-only checks (title, meta, OG) are real but NOT
 * launch-blocking — the generator sets their risk low. A noindex directive on a
 * public page IS a launch blocker (search engines told not to index it).
 */
import type { SeoAssertion } from "./executor.ts";

const PAGE_CACHE = new Map<string, Promise<{ html: string; headers: Headers }>>();

function fetchPage(url: string): Promise<{ html: string; headers: Headers }> {
  const hit = PAGE_CACHE.get(url);
  if (hit) return hit;
  const p = (async () => {
    const r = await fetch(url, { redirect: "follow", headers: { "user-agent": "LaunchAudit-SEO/1.0" } });
    if (!r.ok) throw new Error(`page returned ${r.status} — cannot read SEO tags`);
    return { html: await r.text(), headers: r.headers };
  })();
  PAGE_CACHE.set(url, p);
  return p;
}

const TITLE_JUNK = new Set(["document", "react app", "vite app", "untitled", "home", "app", "next app", "create next app"]);

/** Read a <meta>'s content by name= or property=, tolerant of attribute order. */
function metaContent(html: string, key: string): string | undefined {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // name|property before content
  let m = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${k}["'][^>]*?content=["']([^"']*)["']`, "i"));
  if (m) return m[1];
  // content before name|property
  m = html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*?(?:name|property)=["']${k}["']`, "i"));
  return m ? m[1] : undefined;
}

function linkHref(html: string, rel: string): string | undefined {
  let m = html.match(new RegExp(`<link[^>]+rel=["']${rel}["'][^>]*?href=["']([^"']*)["']`, "i"));
  if (m) return m[1];
  m = html.match(new RegExp(`<link[^>]+href=["']([^"']*)["'][^>]*?rel=["']${rel}["']`, "i"));
  return m ? m[1] : undefined;
}

/** Evaluate one SEO assertion against a page. Throws a plain-English reason on failure (== a failed card). */
export async function runSeoAssertion(url: string, assert: SeoAssertion): Promise<void> {
  const { html, headers } = await fetchPage(url);

  switch (assert.kind) {
    case "title_present": {
      const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = (m?.[1] ?? "").trim();
      if (!title) throw new Error("page has no <title> — search results and browser tabs show the raw URL");
      if (title.length < (assert.minLen ?? 10)) throw new Error(`<title> is only "${title}" (${title.length} chars) — too short to be descriptive`);
      if (TITLE_JUNK.has(title.toLowerCase())) throw new Error(`<title> is the default placeholder "${title}" — never customized`);
      return;
    }
    case "meta_present": {
      const content = metaContent(html, assert.name);
      if (content === undefined) throw new Error(`<meta name="${assert.name}"> is missing — ${assert.label ?? assert.name} not set`);
      if (!content.trim()) throw new Error(`<meta name="${assert.name}"> is empty`);
      return;
    }
    case "canonical_present": {
      const href = linkHref(html, "canonical");
      if (!href) throw new Error('<link rel="canonical"> is missing — duplicate-content and ranking risk');
      return;
    }
    case "viewport_present": {
      if (!metaContent(html, "viewport") && !/<meta[^>]+name=["']viewport["']/i.test(html)) {
        throw new Error('<meta name="viewport"> is missing — the page will not scale on mobile');
      }
      return;
    }
    case "og_present": {
      const content = metaContent(html, assert.property);
      if (!content || !content.trim()) throw new Error(`${assert.property} is missing — link previews on social/chat will be blank or wrong`);
      return;
    }
    case "jsonld_valid": {
      const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1].trim()).filter(Boolean);
      if (blocks.length === 0) throw new Error("no Schema.org JSON-LD found — structured data is required on public pages (rich results + AI/search comprehension)");
      for (const [i, block] of blocks.entries()) {
        try { JSON.parse(block); }
        catch (e) { throw new Error(`JSON-LD block #${i + 1} is invalid JSON (${e instanceof Error ? e.message : "parse error"}) — search engines will ignore it`); }
      }
      return;
    }
    case "not_noindex": {
      const robots = (metaContent(html, "robots") ?? "").toLowerCase();
      const xRobots = (headers.get("x-robots-tag") ?? "").toLowerCase();
      if (robots.includes("noindex") || xRobots.includes("noindex")) {
        throw new Error(`the page ships a noindex directive (${robots.includes("noindex") ? "meta robots" : "X-Robots-Tag header"}) — search engines are told NOT to index this page`);
      }
      return;
    }
  }
}
