/**
 * Reproducible evidence bundle — every finding ships with a runnable repro (the exact
 * curl / Playwright step) plus a redacted response slice and any saved trace/screenshot.
 * "Here's the proof, run it yourself" beats any competitor's confidence score, and it
 * hardens the Watchdog: a claim you can re-run is a claim you can't fake.
 *
 * Credentials NEVER appear in a repro — cookie values are redacted before rendering.
 */

export type ReproInput = {
  appUrl: string;
  /** The failed exec step, as an object (parsed from CardResult.failedStep JSON) or the card's first step. */
  step?: Record<string, unknown>;
  /** Request→status transcript captured for no-browser (HTTP) cards. */
  httpEvidence?: string;
  /** Playwright trace.zip path (failed browser cards only). */
  tracePath?: string;
  /** Screenshot path (browser cards). */
  screenshotPath?: string;
};

// Redact any cookie value so a session token can never ride into a shared report.
function redactCookie(_cookie: string): string {
  return "<REDACTED_SESSION>";
}

function shellQuote(s: string): string {
  return `'${String(s).replace(/'/g, "'\\''")}'`;
}

// Build the curl for an { action: "http" } step.
function curlFor(step: Record<string, unknown>, appUrl: string): string {
  const method = typeof step.method === "string" ? step.method : "GET";
  const path = typeof step.path === "string" ? step.path : typeof step.url === "string" ? String(step.url) : "/";
  const url = /^https?:\/\//.test(path) ? path : `${appUrl.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
  const parts = ["curl", "-i", "-X", method, shellQuote(url)];
  if (step.cookie) parts.push("-H", shellQuote(`Cookie: ${redactCookie(String(step.cookie))}`));
  if (step.body !== undefined) {
    parts.push("-H", shellQuote("content-type: application/json"));
    parts.push("--data", shellQuote(JSON.stringify(step.body)));
  }
  return parts.join(" ");
}

// A redacted, single-line slice of the transcript so the reader sees what came back.
function evidenceSlice(httpEvidence?: string): string | undefined {
  if (!httpEvidence) return undefined;
  const oneLine = httpEvidence.replace(/\s+/g, " ").trim();
  const redacted = oneLine.replace(/(cookie:\s*)[^\s;]+/gi, "$1<REDACTED_SESSION>");
  return redacted.slice(0, 240);
}

/** Build a one-block, runnable repro for a finding. Never empty for a real step. */
export function buildRepro(input: ReproInput): string {
  const lines: string[] = [];
  const step = input.step;
  const action = step && typeof step.action === "string" ? step.action : undefined;

  if (action === "http") {
    lines.push(curlFor(step!, input.appUrl));
  } else if (action === "two_identity") {
    const path = typeof step!.path === "string" ? step!.path : "/";
    const url = `${input.appUrl.replace(/\/$/, "")}${path}`;
    lines.push(`# Privilege gradient — compare responses (admin session vs a lower identity):`);
    lines.push(`curl -s -o /dev/null -w '%{size_download} bytes\\n' -H 'Cookie: <REDACTED_ADMIN>' ${shellQuote(url)}   # admin baseline`);
    lines.push(`curl -s -o /dev/null -w '%{size_download} bytes\\n' ${shellQuote(url)}   # anonymous — must be denied or strictly less`);
  } else if (action) {
    // A non-HTTP step (seo/content/dep audit/etc.) — point at how to re-run the check.
    lines.push(`# Re-run this check: npx launchaudit --reverify   (step: ${action})`);
  } else {
    lines.push(`# Re-run: npx launchaudit --reverify`);
  }

  const slice = evidenceSlice(input.httpEvidence);
  if (slice) lines.push(`# Observed: ${slice}`);
  if (input.tracePath) lines.push(`# Playwright trace: ${input.tracePath}  (npx playwright show-trace <path>)`);
  else if (input.screenshotPath) lines.push(`# Screenshot: ${input.screenshotPath}`);

  return lines.join("\n");
}

/** Safe JSON parse of a CardResult.failedStep string; returns undefined on garbage. */
export function parseStep(failedStep?: string): Record<string, unknown> | undefined {
  if (!failedStep) return undefined;
  try {
    const o = JSON.parse(failedStep);
    return o && typeof o === "object" ? (o as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}
