import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * AI-feature red-teaming — the OWASP LLM Top 10 surface almost no launch auditor tests, on
 * the attack vector (prompt injection) that tops the list. For each configured AI/chat
 * endpoint we fire three canaries: prompt injection (LLM01), system-prompt leak (LLM06),
 * and unsafe output handling (LLM02/LLM05). Config is explicit (endpoint + prompt field);
 * if we merely DETECT a likely chat endpoint we emit an honest BLOCKED card inviting config
 * rather than guessing the request shape. Source: OWASP LLM Top 10 (2025), OWASP ASI (2026).
 */

const AI_ENDPOINT_HINT = /\b(chat|assistant|completion|complete|message|prompt|copilot|llm|ai)\b/i;
const ATTACKS = ["injection", "system_leak", "unsafe_output"] as const;
const ATTACK_TITLE: Record<(typeof ATTACKS)[number], string> = {
  injection: "resists prompt injection (LLM01)",
  system_leak: "does not leak its system prompt (LLM06)",
  unsafe_output: "escapes unsafe output (LLM02/05)",
};

export function generateAiRedteam(scan: RepoScan | null, _crawl: RuntimeCrawl, hints: AuditHints, c: Counter): GeneratedCard[] {
  const configured = hints.aiEndpoints ?? [];
  const cards: GeneratedCard[] = [];

  if (configured.length === 0) {
    // Detect a likely AI endpoint from declared post/write endpoints or scanned routes.
    const candidate =
      (hints.postEndpoints ?? []).map((e) => e.path).find((p) => AI_ENDPOINT_HINT.test(p)) ??
      (scan?.detail?.routes ?? []).find((r) => r.kind === "api" && AI_ENDPOINT_HINT.test(r.url_path))?.url_path;
    if (!candidate) return [];
    return [{
      id: c.next("TC-AI"), title: "AI/LLM endpoint red-team needs the request shape", category: "ai_security", status: "blocked", risk: "high",
      goal: "Red-team the AI feature for prompt injection, system-prompt leakage, and unsafe output (OWASP LLM Top 10).",
      steps: [`Detected a likely AI endpoint (${candidate})`, "Add it to hints.aiEndpoints with { path, promptField, replyPath } and re-run"],
      expectedEvidence: ["http_transcript"], dataNeeds: ["the JSON field the user message goes in"],
      acceptanceCriteria: "BLOCKED: a chat/LLM endpoint was detected but the prompt field isn't declared — provide it to run the OWASP LLM canaries.", exec: [],
    }];
  }

  for (const ep of configured.slice(0, 4)) {
    for (const attack of ATTACKS) {
      cards.push({
        id: c.next("TC-AI"), title: `AI endpoint ${ATTACK_TITLE[attack]}: ${ep.path}`, category: "ai_security", status: "ready", risk: "high",
        goal: "An AI feature must not obey injected instructions, leak its system prompt, or return unescaped active content.",
        steps: [`POST an OWASP-LLM canary (${attack}) to ${ep.path}`, "Assert the reply does not exhibit the attack signature"],
        expectedEvidence: ["http_transcript"], dataNeeds: [],
        acceptanceCriteria: `The ${ep.path} reply resists the ${attack} canary (OWASP LLM Top 10).`,
        exec: [{ action: "llm_probe", path: ep.path, method: ep.method ?? "POST", promptField: ep.promptField ?? "message", replyPath: ep.replyPath, cookie: ep.cookie, attack }],
      });
    }
  }
  return cards;
}
