/**
 * Extensible rule packs — the Nuclei model, on our engine. An org drops in its own
 * declarative HTTP checks (house conventions, per-client routes, internal header policy)
 * and they generate cards through the same pipeline as the built-in detectors — no fork.
 * Nuclei is the category leader precisely because of this: 9,000+ community templates.
 *
 * A rule pack is plain JSON (zero new deps). Each rule compiles to the existing `http`
 * exec step + its assertions, so custom checks get the same Watchdog + honest
 * classification as everything else. Malformed packs FAIL SAFE — skipped with a captured
 * reason, never a faked pass.
 */
import fs from "node:fs";
import path from "node:path";
import { type Counter, type GeneratedCard } from "./generators/types.ts";

export type RulePackRule = {
  id: string;
  title: string;
  path: string;
  method?: string;
  risk?: "low" | "medium" | "high" | "critical";
  description?: string;
  // A subset of the http exec assertions — declarative matchers, Nuclei-style.
  expectStatusOneOf?: number[];
  expectStatusNot?: number[];
  expectHeaderPresent?: string[];
  expectHeaderAbsent?: string[];
  expectBodyExcludes?: string[];
  expectBodyExcludesCI?: string[];
};

export type RulePack = { name: string; rules: RulePackRule[] };
export type LoadResult = { packs: RulePack[]; skipped: Array<{ file: string; reason: string }> };

const ASSERTION_KEYS = ["expectStatusOneOf", "expectStatusNot", "expectHeaderPresent", "expectHeaderAbsent", "expectBodyExcludes", "expectBodyExcludesCI"] as const;

/** Validate + coerce untrusted JSON into a RulePack. Throws on anything malformed. */
export function parseRulePack(input: unknown, source = "<inline>"): RulePack {
  if (input == null || typeof input !== "object") throw new Error(`rule pack ${source} must be a JSON object`);
  const o = input as Record<string, unknown>;
  if (typeof o.name !== "string" || !o.name.trim()) throw new Error(`rule pack ${source} needs a non-empty "name"`);
  if (!Array.isArray(o.rules) || o.rules.length === 0) throw new Error(`rule pack ${source} needs a non-empty "rules" array`);
  const rules: RulePackRule[] = o.rules.map((r, i) => validateRule(r, `${source}#${i}`));
  const ids = new Set<string>();
  for (const r of rules) {
    if (ids.has(r.id)) throw new Error(`rule pack ${source} has a duplicate rule id "${r.id}"`);
    ids.add(r.id);
  }
  return { name: o.name.trim(), rules };
}

function validateRule(input: unknown, where: string): RulePackRule {
  if (input == null || typeof input !== "object") throw new Error(`rule ${where} must be an object`);
  const o = input as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) throw new Error(`rule ${where} needs an "id"`);
  if (typeof o.title !== "string" || !o.title.trim()) throw new Error(`rule ${where} needs a "title"`);
  if (typeof o.path !== "string" || !o.path.startsWith("/")) throw new Error(`rule ${where} needs a "path" starting with "/"`);
  const hasAssertion = ASSERTION_KEYS.some((k) => o[k] !== undefined);
  if (!hasAssertion) throw new Error(`rule ${where} needs at least one assertion (${ASSERTION_KEYS.join(", ")})`);
  const rule: RulePackRule = { id: o.id.trim(), title: o.title.trim(), path: o.path };
  if (o.method !== undefined) { if (typeof o.method !== "string") throw new Error(`rule ${where} method must be a string`); rule.method = o.method.toUpperCase(); }
  if (o.risk !== undefined) { if (!["low", "medium", "high", "critical"].includes(String(o.risk))) throw new Error(`rule ${where} risk must be low|medium|high|critical`); rule.risk = o.risk as RulePackRule["risk"]; }
  if (o.description !== undefined) rule.description = String(o.description);
  for (const k of ASSERTION_KEYS) if (o[k] !== undefined) (rule as Record<string, unknown>)[k] = o[k];
  return rule;
}

/** Compile a validated rule pack into cards on the shared counter. Category: custom_rule. */
export function compileRulePack(pack: RulePack, c: Counter): GeneratedCard[] {
  return pack.rules.map((r) => {
    const httpStep: Record<string, unknown> = { action: "http", method: r.method ?? "GET", path: r.path };
    for (const k of ASSERTION_KEYS) if (r[k] !== undefined) httpStep[k] = r[k];
    return {
      id: c.next("TC-RULE"),
      title: `[${pack.name}] ${r.title}`,
      category: "custom_rule",
      status: "ready",
      risk: r.risk ?? "medium",
      goal: r.description ?? `Custom rule "${r.id}" from the "${pack.name}" pack.`,
      steps: [`${r.method ?? "GET"} ${r.path}`, "Assert the pack's declared matchers hold"],
      expectedEvidence: ["http_transcript"],
      dataNeeds: [],
      acceptanceCriteria: `Custom rule ${r.id} (${pack.name}): the declared HTTP assertion holds for ${r.method ?? "GET"} ${r.path}.`,
      exec: [httpStep as GeneratedCard["exec"][number]],
    };
  });
}

/** Load every *.rulepack.json under dir. Malformed packs are skipped with a reason. */
export function loadRulePacksFromDir(dir: string): LoadResult {
  const packs: RulePack[] = [];
  const skipped: Array<{ file: string; reason: string }> = [];
  if (!fs.existsSync(dir)) return { packs, skipped };
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith(".rulepack.json")) continue;
    const file = path.join(dir, entry);
    try {
      packs.push(parseRulePack(JSON.parse(fs.readFileSync(file, "utf8")), entry));
    } catch (e) {
      skipped.push({ file: entry, reason: (e as Error).message });
    }
  }
  return { packs, skipped };
}
