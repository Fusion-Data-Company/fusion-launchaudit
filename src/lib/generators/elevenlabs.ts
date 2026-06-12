import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard, type ElevenLabsAgent } from "./types.ts";

/**
 * ElevenLabs ConvAI agent audit — the launch-blocker surface NO functional-QA
 * competitor tests. Every FDC client build ships a voice agent; a wiped tool
 * list, an empty system prompt, a missing voice, or a non-HTTPS webhook is a
 * silent production failure. All checks are READ-ONLY GETs against the EL API
 * (never a PATCH — honors the agent-safety halt protocol).
 *
 * Fires only when the audit is given agent IDs + an API key env (via the hints
 * file). No agents configured -> no cards -> no false penalty.
 */
export function generateElevenLabs(_scan: RepoScan | null, _crawl: RuntimeCrawl, hints: AuditHints, c: Counter): GeneratedCard[] {
  const agents = hints.elevenLabsAgents ?? [];
  if (agents.length === 0) return [];

  const cards: GeneratedCard[] = [];
  const defaultKeyEnv = hints.elevenLabsApiKeyEnv ?? "ELEVENLABS_API_KEY";

  for (const agent of agents) {
    const keyEnv = agent.apiKeyEnv ?? defaultKeyEnv;
    const label = agent.name ?? agent.agentId;
    const keyPresent = Boolean(process.env[keyEnv]);

    // No key in env -> declare the dependency honestly instead of failing blind.
    if (!keyPresent) {
      cards.push({
        id: c.next("TC-EL"), title: `ElevenLabs agent reachable: ${label}`, category: "voice_agent", status: "blocked", risk: "high",
        goal: "Audit the live ElevenLabs agent config (tools, prompt, voice, webhooks).",
        steps: [`Set ${keyEnv} to the workspace xi-api-key`, "Re-run"], expectedEvidence: ["agent config"], dataNeeds: [keyEnv],
        acceptanceCriteria: `BLOCKED: ${keyEnv} unset — cannot reach the ElevenLabs API.`, exec: [],
      });
      continue;
    }

    const el = (assert: Record<string, unknown>) => ({ action: "elevenlabs", agentId: agent.agentId, apiKeyEnv: keyEnv, assert });

    cards.push({
      id: c.next("TC-EL"), title: `Agent config reachable: ${label}`, category: "voice_agent", status: "ready", risk: "critical",
      goal: "The agent must exist and its config must be fetchable with the provided key.",
      steps: [`GET /v1/convai/agents/${agent.agentId}`], expectedEvidence: ["agent config"], dataNeeds: [],
      acceptanceCriteria: "Agent config returns 200 for the workspace key.",
      exec: [el({ kind: "reachable" })],
    });

    cards.push({
      id: c.next("TC-EL"), title: `System prompt is real, not placeholder: ${label}`, category: "voice_agent", status: "ready", risk: "high",
      goal: "A voice agent with an empty or placeholder system prompt has no behavior — it will improvise on a live call.",
      steps: ["Prompt is a substantial string", "Contains no TODO/placeholder markers"], expectedEvidence: ["agent config"], dataNeeds: [],
      acceptanceCriteria: "conversation_config.agent.prompt.prompt is >= 50 chars and placeholder-free.",
      exec: [
        el({ kind: "nonempty_string", path: "conversation_config.agent.prompt.prompt", minLen: 50, label: "system prompt" }),
        el({ kind: "no_placeholder_prompt", path: "conversation_config.agent.prompt.prompt" }),
      ],
    });

    // The signature failure mode: tool_ids:[] silently wipes ALL tools. Skip only if the agent is intentionally toolless.
    if (!agent.toolless) {
      cards.push({
        id: c.next("TC-EL"), title: `Tools not wiped: ${label}`, category: "voice_agent", status: "ready", risk: "critical",
        goal: "An agent meant to book/look-up/transfer must have its tools attached — an empty tool list is the classic silent wipe.",
        steps: ["tool_ids or tools is non-empty"], expectedEvidence: ["agent config"], dataNeeds: [],
        acceptanceCriteria: "conversation_config.agent.prompt has at least one tool.",
        exec: [el({ kind: "tools_not_wiped" })],
      });
      cards.push({
        id: c.next("TC-EL"), title: `Webhook tools use HTTPS endpoints: ${label}`, category: "voice_agent", status: "ready", risk: "high",
        goal: "Every webhook/client tool must call a real HTTPS endpoint — a missing or http:// URL means the tool fails on a live call.",
        steps: ["Each webhook tool has an https:// api_url"], expectedEvidence: ["agent config"], dataNeeds: [],
        acceptanceCriteria: "All webhook/client tools carry an https endpoint.",
        exec: [el({ kind: "webhooks_https" })],
      });
    }

    cards.push({
      id: c.next("TC-EL"), title: `Voice + TTS model configured: ${label}`, category: "voice_agent", status: "ready", risk: "high",
      goal: "No voice_id or TTS model means the agent cannot speak.",
      steps: ["tts.voice_id present", "tts.model_id present"], expectedEvidence: ["agent config"], dataNeeds: [],
      acceptanceCriteria: "conversation_config.tts.voice_id and model_id are set.",
      exec: [
        el({ kind: "field_present", path: "conversation_config.tts.voice_id", label: "voice_id" }),
        el({ kind: "field_present", path: "conversation_config.tts.model_id", label: "TTS model" }),
      ],
    });

    cards.push({
      id: c.next("TC-EL"), title: `LLM + first message + language set: ${label}`, category: "voice_agent", status: "ready", risk: "medium",
      goal: "A missing LLM, empty first message, or unset language degrades the call experience.",
      steps: ["prompt.llm present", "first_message non-empty", "language present"], expectedEvidence: ["agent config"], dataNeeds: [],
      acceptanceCriteria: "LLM, first_message, and language are all set.",
      exec: [
        el({ kind: "field_present", path: "conversation_config.agent.prompt.llm", label: "LLM" }),
        el({ kind: "nonempty_string", path: "conversation_config.agent.first_message", minLen: 1, label: "first message" }),
        el({ kind: "field_present", path: "conversation_config.agent.language", label: "language" }),
      ],
    });
  }

  return cards;
}
