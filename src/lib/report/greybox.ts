/**
 * Grey-box authorization cross-verification — our structural edge: we read the repo AND
 * drive the app in one pass, so we can confirm a runtime authz finding against the source.
 * Pure DAST (ZAP/Burp) can't see the source; pure SAST (Semgrep) can't prove the runtime
 * exploit. When a runtime authz probe shows exposure AND the handler source has no
 * server-side guard, that's "defense-verified" — the highest-confidence a finding can carry.
 *
 * This ENRICHES existing findings (adds a source-confirmed note + raises confidence); it
 * never creates new findings, so it can't add a false positive or change the score.
 */
import type { ScannedRoute } from "../../../runner/repo-scanner.ts";

export type GuardIndexEntry = { path: string; file: string; hasGuard: boolean };
export type GuardIndex = GuardIndexEntry[];

/**
 * Build a guard index: for each API/privileged route, whether its handler source contains
 * a server-side auth guard. `readGuard(file)` returns true if the file's source has a guard
 * (the caller passes a fn wrapping sourceHasAuthGuard + fs, so this stays pure/testable).
 */
export function buildGuardIndex(routes: ScannedRoute[], readGuard: (file: string) => boolean | undefined): GuardIndex {
  const index: GuardIndex = [];
  for (const r of routes) {
    if (r.kind !== "api" && !r.privileged) continue; // only surfaces that should be guarded
    const has = readGuard(r.file);
    if (has === undefined) continue; // couldn't read — omit rather than guess
    index.push({ path: r.url_path, file: r.file, hasGuard: has });
  }
  return index;
}

// Normalize a URL path for comparison: drop a trailing slash and collapse concrete numeric
// id segments to a placeholder so /admin/users/42 matches the route /admin/users/1.
function norm(p: string): string {
  return p.replace(/\/\d+(?=\/|$)/g, "/#").replace(/\/$/, "") || "/";
}

/**
 * Does the source confirm a MISSING guard for this runtime path? Returns the matched file
 * when so, else null. Only answers "missing" — a present guard that failed at runtime is a
 * different (still real) story we don't downgrade here.
 */
export function sourceConfirmsMissingGuard(runtimePath: string, index: GuardIndex): { file: string } | null {
  const target = norm(runtimePath);
  for (const e of index) {
    if (norm(e.path) === target && !e.hasGuard) return { file: e.file };
  }
  return null;
}

/** Pull the most relevant path out of a card's first exec step (http/two_identity/race). */
export function cardPath(card: { exec?: Array<Record<string, unknown>> }): string | undefined {
  const step = card.exec?.[0];
  if (!step) return undefined;
  const p = step.path ?? step.url;
  return typeof p === "string" ? p : undefined;
}
