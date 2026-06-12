/**
 * ElevenLabs ConvAI agent auditing — the surface no functional-QA competitor
 * touches. Fetches an agent's live config read-only (GET, never a mutation —
 * honors the "never PATCH without explicit go" rule) and evaluates one
 * assertion at a time so each check is its own evidenced pass/fail.
 *
 * Agent JSON shape (v1 /convai/agents/{id}):
 *   conversation_config.agent.prompt.{prompt,llm,tools,tool_ids}
 *   conversation_config.agent.{first_message,language}
 *   conversation_config.tts.{voice_id,model_id}
 */
import type { ElAssertion } from "./executor.ts";

const AGENT_CACHE = new Map<string, Promise<Record<string, unknown>>>();

function fetchAgent(agentId: string, apiKey: string): Promise<Record<string, unknown>> {
  const cacheKey = `${apiKey.slice(0, 6)}:${agentId}`;
  const hit = AGENT_CACHE.get(cacheKey);
  if (hit) return hit;
  const p = (async () => {
    const r = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
      headers: { "xi-api-key": apiKey },
    });
    if (r.status === 401 || r.status === 403) throw new Error(`ElevenLabs rejected the API key (${r.status}) — check the key has convai read scope`);
    if (r.status === 404) throw new Error(`agent ${agentId} not found (404) — wrong agent_id or wrong workspace for this key`);
    if (!r.ok) throw new Error(`ElevenLabs API returned ${r.status} for agent ${agentId}`);
    return (await r.json()) as Record<string, unknown>;
  })();
  AGENT_CACHE.set(cacheKey, p);
  return p;
}

/** Resolve a dot path like "conversation_config.agent.prompt.prompt" into the agent JSON. */
function dig(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

const PLACEHOLDER_MARKERS = ["TODO", "FIXME", "lorem ipsum", "your prompt here", "system prompt goes here", "xxxxx", "placeholder", "tbd"];

/** The webhook/client tools that should carry a real https endpoint. */
function collectWebhookUrls(agent: Record<string, unknown>): Array<{ name: string; url: string | undefined }> {
  const tools = dig(agent, "conversation_config.agent.prompt.tools");
  if (!Array.isArray(tools)) return [];
  const out: Array<{ name: string; url: string | undefined }> = [];
  for (const t of tools as Array<Record<string, unknown>>) {
    const type = String(t.type ?? "");
    if (type === "webhook" || type === "client") {
      const api = (t.api_schema ?? t.webhook ?? {}) as Record<string, unknown>;
      const url = (api.url ?? api.api_url ?? t.url) as string | undefined;
      out.push({ name: String(t.name ?? "unnamed"), url });
    }
  }
  return out;
}

/**
 * Evaluate one assertion. Throws with a plain-English reason on failure
 * (same contract as the HTTP executor — a thrown error == a failed card).
 */
export async function runElevenLabsAssertion(agentId: string, apiKeyEnv: string | undefined, assert: ElAssertion): Promise<void> {
  const envName = apiKeyEnv ?? "ELEVENLABS_API_KEY";
  const apiKey = process.env[envName];
  if (!apiKey) throw new Error(`${envName} is not set — cannot reach the ElevenLabs API to audit agent ${agentId}`);

  const agent = await fetchAgent(agentId, apiKey);
  const name = (agent.name as string) ?? agentId;

  switch (assert.kind) {
    case "reachable":
      return; // fetch already succeeded
    case "field_present": {
      const v = dig(agent, assert.path);
      if (v === undefined || v === null || v === "") throw new Error(`${name}: ${assert.label ?? assert.path} is missing`);
      return;
    }
    case "nonempty_string": {
      const v = dig(agent, assert.path);
      if (typeof v !== "string" || v.trim().length < (assert.minLen ?? 1)) {
        throw new Error(`${name}: ${assert.label ?? assert.path} is empty or too short (need >= ${assert.minLen ?? 1} chars)`);
      }
      return;
    }
    case "field_oneof": {
      const v = String(dig(agent, assert.path) ?? "");
      if (!assert.oneOf.includes(v)) throw new Error(`${name}: ${assert.label ?? assert.path} is "${v || "unset"}", expected one of [${assert.oneOf.join(", ")}]`);
      return;
    }
    case "nonempty_array": {
      const v = dig(agent, assert.path);
      if (!Array.isArray(v) || v.length === 0) throw new Error(`${name}: ${assert.label ?? assert.path} is empty (expected at least one entry)`);
      return;
    }
    case "tools_not_wiped": {
      const toolIds = dig(agent, "conversation_config.agent.prompt.tool_ids");
      const tools = dig(agent, "conversation_config.agent.prompt.tools");
      const idCount = Array.isArray(toolIds) ? toolIds.length : 0;
      const toolCount = Array.isArray(tools) ? tools.length : 0;
      if (idCount === 0 && toolCount === 0) {
        throw new Error(`${name}: agent has ZERO tools — if this agent is supposed to act (book, look up, transfer), its tools were wiped (the tool_ids:[] failure mode). Mark it toolless in hints only if that is intentional.`);
      }
      return;
    }
    case "no_placeholder_prompt": {
      const v = String(dig(agent, assert.path) ?? "");
      const lower = v.toLowerCase();
      const hit = PLACEHOLDER_MARKERS.find((m) => lower.includes(m.toLowerCase()));
      if (hit) throw new Error(`${name}: system prompt still contains placeholder text "${hit}" — not production-ready`);
      return;
    }
    case "webhooks_https": {
      const urls = collectWebhookUrls(agent);
      const bad = urls.filter((u) => !u.url || !/^https:\/\//i.test(u.url));
      if (bad.length) throw new Error(`${name}: ${bad.length} webhook tool(s) have a missing or non-HTTPS endpoint (${bad.map((b) => b.name).join(", ")})`);
      return;
    }
  }
}
