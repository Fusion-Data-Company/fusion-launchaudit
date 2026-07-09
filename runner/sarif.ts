/**
 * SARIF 2.1.0 emitter — turns a LaunchAudit report into the OASIS-standard
 * Static Analysis Results Interchange Format so findings load straight into
 * GitHub code-scanning (and any SARIF viewer) as native alerts on the PR.
 *
 * GitHub parses a supported subset of the SARIF 2.1.0 schema; we emit exactly
 * those properties (tool.driver.rules, results[].ruleId/level/message/locations/
 * partialFingerprints). No invented data — every result traces to a report card.
 * Ref: https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning
 */
import { createHash } from "node:crypto";
import type { ReportData } from "./render-report.ts";

const SARIF_VERSION = "2.1.0";
const SARIF_SCHEMA = "https://json.schemastore.org/sarif-2.1.0.json";
const TOOL_NAME = "80/20 Launch Audit";
const TOOL_URI = "https://github.com/Fusion-Data-Company/fusion-launchaudit";

// SARIF result.level is a fixed enum: error | warning | note | none.
// We map an audit finding's honesty-classified severity onto it without ever
// upgrading a "needs verification" into a hard error — the Truth Protocol holds
// even in the export.
function levelFor(severity: string): string {
  const s = severity.toLowerCase();
  if (s === "needs verification") return "warning";
  if (s === "needs input" || s === "blocked" || s === "tooling") return "note";
  if (s === "low" || s === "info") return "note";
  if (s === "medium" || s === "moderate") return "warning";
  // high / critical / confirmed product bug
  return "error";
}

// A stable id for a rule: prefer the finding's category, else a slug of its title.
function ruleIdFor(f: ReportData["findings"][number]): string {
  if (f.category && f.category.trim()) return f.category.trim();
  return (f.title || "finding").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "finding";
}

// Deterministic dedupe key so re-runs update the same alert instead of stacking.
function fingerprint(ruleId: string, f: ReportData["findings"][number]): string {
  return createHash("sha256").update(`${ruleId}::${f.title}::${f.summary}`).digest("hex").slice(0, 32);
}

/** Build a SARIF 2.1.0 log object from a LaunchAudit report. */
export function buildSarif(data: ReportData): Record<string, unknown> {
  // One reportingDescriptor (rule) per distinct ruleId actually used.
  const rulesById = new Map<string, Record<string, unknown>>();
  const results: Array<Record<string, unknown>> = [];

  for (const f of data.findings) {
    const ruleId = ruleIdFor(f);
    if (!rulesById.has(ruleId)) {
      rulesById.set(ruleId, {
        id: ruleId,
        name: ruleId.replace(/[^a-z0-9]+/gi, "_"),
        shortDescription: { text: `${TOOL_NAME}: ${ruleId}` },
        helpUri: TOOL_URI,
      });
    }
    // Runtime findings have no source line; GitHub tolerates a logical/synthetic
    // artifactLocation. We anchor to the audited app URL so the alert is placeable.
    const result: Record<string, unknown> = {
      ruleId,
      level: levelFor(f.severity),
      message: { text: f.fixPrompt ? `${f.summary}\n\nFix: ${f.fixPrompt}` : f.summary },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: data.appUrl || "app://launchaudit", uriBaseId: "SRCROOT" },
            region: { startLine: 1 },
          },
          logicalLocations: [{ fullyQualifiedName: ruleId }],
        },
      ],
      partialFingerprints: { launchauditIdV1: fingerprint(ruleId, f) },
    };
    results.push(result);
  }

  return {
    $schema: SARIF_SCHEMA,
    version: SARIF_VERSION,
    runs: [
      {
        tool: {
          driver: {
            name: TOOL_NAME,
            informationUri: TOOL_URI,
            version: "1.1.0",
            rules: Array.from(rulesById.values()),
          },
        },
        results,
        // Surface the audited target so a viewer shows what was scanned.
        properties: { appUrl: data.appUrl, readiness: data.readiness, generatedAt: data.generatedAt },
      },
    ],
  };
}

/** Serialize to a SARIF JSON string (2-space, stable). */
export function renderSarif(data: ReportData): string {
  return JSON.stringify(buildSarif(data), null, 2);
}
