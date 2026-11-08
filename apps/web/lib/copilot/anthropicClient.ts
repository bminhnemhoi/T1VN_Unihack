/**
 * Claude API adapter (server only). Receives the key from the route handler and never reads or logs it.
 * Settings (docs/07 3.2 item 1): model `claude-sonnet-5-5`; no temperature/top_p/top_k (Sonnet 5.5 accepts defaults only);
 * thinking left at the model default (adaptive, always on); effort `medium`; no forced tool_choice (rejected by this model).
 */
import Anthropic from '@anthropic-ai/sdk';
import { COPILOT_EFFORT, COPILOT_MODEL, MAX_OUTPUT_TOKENS, MODEL_TIMEOUT_MS } from './config';
import type { AssistantBlock, ModelClient, ModelTurn, TurnMessage } from './engine';
import { toolDefinitions } from './tools';

export function createAnthropicModelClient(apiKey: string): ModelClient {
  const client = new Anthropic({ apiKey, timeout: MODEL_TIMEOUT_MS, maxRetries: 1 });
  const tools = toolDefinitions();
  // Thinking blocks must be sent back unchanged inside a tool loop, so keep each turn's raw content by identity.
  const rawByContent = new WeakMap<object, Anthropic.ContentBlock[]>();

  const toParam = (m: TurnMessage): Anthropic.MessageParam => {
    if (m.role === 'user') return { role: 'user', content: m.content };
    const raw = rawByContent.get(m.content);
    return { role: 'assistant', content: (raw ?? m.content) as Anthropic.ContentBlockParam[] };
  };

  return {
    async complete({ system, messages, signal }): Promise<ModelTurn> {
      const stream = client.messages.stream(
        {
          model: COPILOT_MODEL,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
          tools,
          output_config: { effort: COPILOT_EFFORT },
          messages: messages.map(toParam),
        },
        { signal },
      );
      const message = await stream.finalMessage();
      const content: AssistantBlock[] = [];
      for (const b of message.content) {
        if (b.type === 'text') content.push({ type: 'text', text: b.text });
        else if (b.type === 'tool_use') content.push({ type: 'tool_use', id: b.id, name: b.name, input: b.input });
      }
      rawByContent.set(content, message.content);
      const stopReason: ModelTurn['stopReason'] =
        message.stop_reason === 'end_turn' ||
        message.stop_reason === 'tool_use' ||
        message.stop_reason === 'refusal' ||
        message.stop_reason === 'max_tokens'
          ? message.stop_reason
          : 'other';
      return {
        content,
        stopReason,
        usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
      };
    },
  };
}
