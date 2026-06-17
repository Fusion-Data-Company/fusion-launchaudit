/**
 * Verify orchestrator — runs checks, seals each result into a Verdict under the
 * truth protocol, then runs the watchdog to independently re-prove every pass.
 * Returns the honest readiness number (verified passes only). This is where the
 * spine (verdict + watchdog) meets the executor.
 */
import type { ExecutableTestCard } from "./executor.ts";
import { executeNoBrowserCards, type CardResult } from "./execute-core.ts";
import { readiness, sealVerdict, type Evidence, type RawResult, type Verdict } from "./verdict.ts";
import { runWatchdog, type WatchdogReport } from "./watchdog.ts";

export function resultToRaw(r: CardResult): RawResult {
  const evidence: Evidence[] = [];
  if (r.screenshotPath) evidence.push({ kind: "screenshot", ref: r.screenshotPath, summary: "page screenshot at assertion time" });
  if (r.tracePath) evidence.push({ kind: "trace", ref: r.tracePath, summary: "Playwright trace of the failing run" });
  if (r.httpEvidence) evidence.push({ kind: "http_transcript", summary: r.httpEvidence.replace(/\n/g, " | ").slice(0, 300) });
  if (r.consoleErrors?.length) evidence.push({ kind: "console", summary: `${r.consoleErrors.length} console error(s)` });
  return {
    checkId: r.card.id, title: r.card.title, category: r.card.category, risk: r.card.risk,
    rawStatus: r.status === "passed" ? "pass" : "fail",
    reason: r.status === "passed" ? (r.card.acceptanceCriteria || "passed") : (r.error || "failed"),
    evidence,
    provenance: { executor: r.screenshotPath ? "browser" : "http", attempts: r.attempts, startedAt: r.startedAt, endedAt: r.endedAt },
  };
}

/** No-browser (HTTP/SEO/EL) audit with watchdog re-verification. Browser path is added when Playwright is present. */
export async function auditVerifyHttp(cards: ExecutableTestCard[], options: { appUrl: string; artifactDir: string }) {
  const results = await executeNoBrowserCards(cards, options);
  const verdicts: Verdict[] = results.map((r) => sealVerdict(resultToRaw(r)));
  const byId = new Map(cards.map((c) => [c.id, c]));
  const reexec = async (id: string): Promise<RawResult> => {
    const card = byId.get(id);
    if (!card) throw new Error(`watchdog: unknown card ${id}`);
    const [fresh] = await executeNoBrowserCards([card], options);
    return resultToRaw(fresh);
  };
  const watchdog: WatchdogReport = await runWatchdog(verdicts, reexec);
  return { verdicts: watchdog.verdicts, watchdog, readiness: readiness(watchdog.verdicts) };
}
