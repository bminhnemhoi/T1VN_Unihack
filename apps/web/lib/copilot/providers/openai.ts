/**
 * OpenAI-compatible backend (a router such as 9router serving Gemini). Patterns from the Goblin bot:
 * official `openai` SDK with `baseURL`, non-streaming tool rounds, the assistant message is replayed exactly as
 * returned (`raw`, keeps Gemini's thought signature), `tool_choice: none` on the last round, arguments accepted
 * as string or object and never allowed to throw.
 */
import OpenAI from 'openai';
import { MAX_OUTPUT_TOKENS, MODEL_TIMEOUT_MS } from '../config';
import type { AssistantBlock, ModelClient, ModelTurn, ToolUseBlock, TurnMessage } from '../engine';
import { toolDefinitions } from '../tools';
import { ProviderError } from './error';

type Msg = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type Tool = OpenAI.Chat.Completions.ChatCompletionTool;

const SAFE_INT = Number.MAX_SAFE_INTEGER;
const KEEP = new Set(['type', 'properties', 'required', 'enum', 'description', 'items', 'minimum', 'maximum']);

/**
 * Gemini's OpenAI layer accepts a plain subset of JSON Schema. Constraints dropped here are still enforced by the
 * zod schema that validates every call on our side.
 */
export function simplifySchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(simplifySchema);
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === 'properties' && v && typeof v === 'object') {
      out.properties = Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([name, schema]) => [name, simplifySchema(schema)]));
    } else if (KEEP.has(k)) {
      if ((k === 'minimum' || k === 'maximum') && typeof v === 'number' && Math.abs(v) >= SAFE_INT) continue;
      out[k] = k === 'items' ? simplifySchema(v) : v;
    }
  }
  return out;
}

export function toOpenAiTool(def: { name: string; description: string; input_schema: object }): Tool {
  return { type: 'function', function: { name: def.name, description: def.description, parameters: simplifySchema(def.input_schema) as Record<string, unknown> } };
}

function parseArguments(a: unknown): { input: unknown; invalid?: true } {
  if (a === undefined || a === null) return { input: {} };
  if (typeof a === 'string') {
    if (a.trim() === '') return { input: {} };
    try {
      const v: unknown = JSON.parse(a);
      return v && typeof v === 'object' && !Array.isArray(v) ? { input: v } : { input: {}, invalid: true };
    } catch {
      return { input: {}, invalid: true };
    }
  }
  return typeof a === 'object' && !Array.isArray(a) ? { input: a } : { input: {}, invalid: true };
}

function toWire(m: TurnMessage): Msg[] {
  if (m.role === 'user') {
    if (typeof m.content === 'string') return [{ role: 'user', content: m.content }];
    return m.content.map((r): Msg => ({ role: 'tool', tool_call_id: r.tool_use_id, content: r.content }));
  }
  if (m.raw) return [m.raw as Msg]; // exactly as the router returned it
  const text = m.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('');
  const calls = m.content.filter((b): b is ToolUseBlock => b.type === 'tool_use');
  return [
    {
      role: 'assistant',
      content: text || null,
      ...(calls.length ? { tool_calls: calls.map((c) => ({ id: c.id, type: 'function' as const, function: { name: c.name, arguments: JSON.stringify(c.input) } })) } : {}),
    },
  ];
}

function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((p) => (p && typeof (p as { text?: unknown }).text === 'string' ? (p as { text: string }).text : '')).join('');
  return '';
}

export function createOpenAiCompatibleClient(cfg: { baseUrl: string; apiKey: string; model: string }): ModelClient {
  const client = new OpenAI({ baseURL: cfg.baseUrl, apiKey: cfg.apiKey, timeout: MODEL_TIMEOUT_MS, maxRetries: 1 });
  const tools = toolDefinitions().map(toOpenAiTool);

  return {
    info: { provider: 'openai-compatible', model: cfg.model },
    async complete({ system, messages, toolChoice, signal }): Promise<ModelTurn> {
      let res: OpenAI.Chat.Completions.ChatCompletion;
      try {
        res = await client.chat.completions.create(
          {
            model: cfg.model,
            // Explicit: some OpenAI-compatible routers (9router Gemini routes) answer with SSE when `stream` is absent.
            stream: false,
            messages: [{ role: 'system', content: system }, ...messages.flatMap(toWire)],
            // Sampling is pinned to the most repeatable setting; the product has no random choices (CLAUDE.md rule 3).
            temperature: 0,
            max_tokens: MAX_OUTPUT_TOKENS,
            tools,
            tool_choice: toolChoice ?? 'auto',
          },
          signal ? { signal } : undefined,
        );
      } catch (e) {
        throw ProviderError.from(e);
      }

      const choice = res.choices?.[0];
      const message = (choice?.message ?? { role: 'assistant', content: '' }) as unknown as Record<string, unknown> & {
        tool_calls?: { id?: string; type?: string; function?: { name?: string; arguments?: unknown } }[];
      };
      const rawCalls = (message.tool_calls ?? []).filter((c) => c && (c.type === undefined || c.type === 'function') && c.function?.name);
      const content: AssistantBlock[] = [];
      const text = textOf(message.content);
      if (text) content.push({ type: 'text', text });
      let raw: unknown = message;
      rawCalls.forEach((c, i) => {
        const parsed = parseArguments(c.function?.arguments);
        content.push({ type: 'tool_use', id: c.id || `call_${i}`, name: c.function!.name!, input: parsed.input, ...(parsed.invalid ? { invalidArguments: true as const } : {}) });
      });
      if (rawCalls.some((c) => !c.id)) {
        // A call without an id cannot be answered with a `tool` message: give it one in the replayed copy too.
        raw = { ...message, tool_calls: (message.tool_calls ?? []).map((c, i) => ({ ...c, id: c.id || `call_${i}` })) };
      }
      // Some gateways report finish_reason "stop" even when tool_calls are present, so the calls decide.
      const stopReason: ModelTurn['stopReason'] =
        rawCalls.length > 0 ? 'tool_use' : choice?.finish_reason === 'length' ? 'max_tokens' : choice?.finish_reason === 'content_filter' ? 'refusal' : 'end_turn';
      return {
        content,
        stopReason,
        model: typeof res.model === 'string' ? res.model : undefined,
        raw,
        usage: res.usage ? { inputTokens: Number(res.usage.prompt_tokens) || 0, outputTokens: Number(res.usage.completion_tokens) || 0 } : undefined,
      };
    },
  };
}
