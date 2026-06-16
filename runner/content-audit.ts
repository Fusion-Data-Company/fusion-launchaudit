/**
 * Content-integrity auditing — the fake/placeholder-data surface no functional-QA
 * competitor owns (and the one LaunchAudit itself was once guilty of shipping).
 * Operates on the rendered HTML the visitor actually receives.
 *
 * High-signal, conservative checks only — a security/quality tool that cries wolf
 * on real copy is worse than useless:
 *  - lorem ipsum filler in visible text,
 *  - rendered `undefined` / `NaN` tokens (the classic missing-data-binding bug),
 *  - hardcoded localhost / 127.0.0.1 references on a deployed target,
 *  - obvious placeholder markers (verified by a human, not claimed as a bug).
 */
import type { ContentAssertion } from "./executor.ts";

const PAGE_CACHE = new Map<string, Promise<string>>();

function fetchHtml(url: string): Promise<string> {
  const hit = PAGE_CACHE.get(url);
  if (hit) return hit;
  const p = (async () => {
    const r = await fetch(url, { redirect: "follow", headers: { "user-agent": "LaunchAudit-Content/1.0" } });
    if (!r.ok) throw new Error(`page returned ${r.status} — cannot read content`);
    return r.text();
  })();
  PAGE_CACHE.set(url, p);
  return p;
}

/** Strip scripts, styles, comments and tags to approximate what a human reads on screen. */
function visibleText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PLACEHOLDER_MARKERS = [
  "your company name", "your-company", "company name here", "replace this", "replace with",
  "placeholder text", "insert your", "insert text here", "sample text", "dummy text",
  "email@example.com", "yourname@", "your@email", "your-domain", "yourdomain.com",
];

/** Evaluate one content-integrity assertion. Throws a plain-English reason on failure. */
export async function runContentAssertion(url: string, assert: ContentAssertion): Promise<void> {
  assertContent(await fetchHtml(url), assert);
}

/** Pure scanner: given rendered HTML, throw a plain-English reason if the assertion fails. */
export function assertContent(html: string, assert: ContentAssertion): void {
  const text = visibleText(html);
  const lower = text.toLowerCase();

  switch (assert.kind) {
    case "no_lorem": {
      if (/\blorem ipsum\b/i.test(text)) {
        throw new Error("rendered page contains 'lorem ipsum' filler — real copy was never written");
      }
      return;
    }
    case "no_unbound_values": {
      // Standalone undefined / NaN in visible text (incl. $NaN, NaN%) — a value that
      // failed to bind and leaked to the screen.
      const m = text.match(/(^|[\s>$£€])(undefined|NaN)(?=[\s<%.,)/-]|$)/);
      if (m) {
        const at = Math.max(0, (m.index ?? 0) - 20);
        throw new Error(`rendered page shows an unbound "${m[2]}" value (…${text.slice(at, at + 50).trim()}…) — a data field failed to populate`);
      }
      return;
    }
    case "no_localhost_refs": {
      // Look at the RAW html so href/src attributes count, not just visible text.
      const m = html.match(/https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i);
      if (m) throw new Error(`deployed page references "${m[0]}" — a hardcoded local URL that will break for every real visitor`);
      return;
    }
    case "no_placeholder_markers": {
      const hit = PLACEHOLDER_MARKERS.find((mark) => lower.includes(mark));
      if (hit) throw new Error(`rendered page contains a placeholder marker ("${hit}") — confirm this is finished content, not a stub`);
      return;
    }
  }
}
