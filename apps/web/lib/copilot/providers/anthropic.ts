/**
 * Anthropic backend (official SDK, server only). The key and model id come from `provider.ts`; nothing is read here.
 * No temperature/top_p/top_k (Sonnet 5.5 accepts defaults only), thinking left at the model default (adaptive),
 * `tool_choice` is only ever `auto` or `none` (forced tool use is rejected by these models).
 */
import Anthropic from '@anthropic-ai/sdk';
import { COPILOT_EFFORT, MAX_OUTPUT_TOKENS, MODEL_TIMEOUT_MS } from '../config';
import type { AssistantBlock, ModelClient, ModelTurn, TurnMessage } from '../engine';
import { toolDefinitions } from '../tools';
import { ProviderError } from './error';

/** `output_config.effort` exists on the 5.x family; older ids would answer 400. */
const SUPPORTS_EFFORT = /^claude-(sonnet-5|opus-5|fable-5|haiku-5|mythos)/;

export function createAnthropicModelClient(cfg: { apiKey: string; model: string }): ModelClient {
  const client = new Anthropic({ apiKey: cfg.apiKey, timeout: MODEL_TIMEOUT_MS, maxRetries: 1 });
  const tools = toolDefinitions();

  // Thinking blocks must be sent back unchanged inside a tool loop: replay the raw content when we have it.
  const toParam = (m: TurnMessage): Anthropic.MessageParam =>
    m.role === 'user'
      ? { role: 'user', content: m.content }
      : { role: 'assistant', content: (m.raw ?? m.content) as Anthropic.ContentBlockParam[] };

  return {
    info: { provider: 'anthropic', model: cfg.model },
    async complete({ system, messages, toolChoice, signal }): Promise<ModelTurn> {
      let message: Anthropic.Message;
      try {
        message = await client
          .messages.stream(
            {
              model: cfg.model,
              max_tokens: MAX_OUTPUT_TOKENS,
              system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
              tools,
              ...(toolChoice === 'none' ? { tool_choice: { type: 'none' as const } } : {}),
              ...(SUPPORTS_EFFORT.test(cfg.model) ? { output_config: { effort: COPILOT_EFFORT } } : {}),
              messages: messages.map(toParam),
            },
            { signal },
          )
          .finalMessage();
      } catch (e) {
        throw ProviderError.from(e);
      }
      const content: AssistantBlock[] = [];
      for (const b of message.content) {
        if (b.type === 'text') content.push({ type: 'text', text: b.text });
        else if (b.type === 'tool_use') content.push({ type: 'tool_use', id: b.id, name: b.name, input: b.input });
      }
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
        model: message.model,
        raw: message.content,
        usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
      };
    },
  };
}
