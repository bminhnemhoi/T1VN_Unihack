/**
 * Copilot engine: model loop + deterministic tool runner + output guard (docs/07 3.2).
 * The model is injected (`ModelClient`) so tests and the eval harness run with no key and no network.
 */
import { AI_LABEL, DISCLAIMER, LIMITS } from './config';
import { buildFacts } from './facts';
import { checkAnswer, detectActionRequest } from './guard';
import { SYSTEM_PROMPT } from './prompt';
import { prepareUserText } from './scrub';
import { answerSchema, type CopilotAnswer, type CopilotRequest } from './schemas';
import { runTool, ToolError, type ToolContext } from './tools';
import { calculatorAnswer, refusalAnswer } from './templates';

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}
export interface TextBlock {
  type: 'text';
  text: string;
}
export type AssistantBlock = TextBlock | ToolUseBlock;
export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}
export type TurnMessage =
  | { role: 'user'; content: string | ToolResultBlock[] }
  | { role: 'assistant'; content: AssistantBlock[] };

export interface ModelTurn {
  content: AssistantBlock[];
  stopReason: 'end_turn' | 'tool_use' | 'refusal' | 'max_tokens' | 'other';
  usage?: { inputTokens: number; outputTokens: number };
}

export interface ModelClient {
  complete(args: { system: string; messages: TurnMessage[]; signal?: AbortSignal }): Promise<ModelTurn>;
}

export type CopilotEvent =
  | { type: 'status'; text: string }
  | { type: 'tool'; name: string; result: unknown; error?: string }
  | {
      type: 'answer';
      answer: CopilotAnswer;
      /** `model` passed the guard; `calculator` is the deterministic fallback of docs/07 section 8. */
      source: 'model' | 'calculator' | 'refusal';
      label: string;
    }
  | { type: 'error'; code: string; message: string };

export interface RunOptions {
  request: CopilotRequest;
  model: ModelClient;
  toolContext?: ToolContext;
  requestId: string;
  /** Receives metadata only (docs/07 3.8 item 3): never message content. */
  log?: (entry: Record<string, unknown>) => void;
  signal?: AbortSignal;
}

const STATUS: Record<string, string> = {
  compute_exposure: 'Đang tính rủi ro theo kỳ...',
  recommend_bond: 'Đang tính ký quỹ...',
  max_bid_table: 'Đang lập bảng trần thăm...',
  simulate_circle: 'Đang tra kết quả mô phỏng...',
  explain_rule: 'Đang lấy nội dung quy định...',
  draft_ubnd_notice: 'Đang soạn nháp thông báo...',
};

/** The one user message every model call starts from: facts, history and the question, all delimited. */
export function buildUserMessage(req: CopilotRequest): string {
  const keep = req.circle;
  const facts = req.draft ? buildFacts(req.draft, keep) : keep ? { circle: keep } : null;
  const history = req.messages
    .slice(0, -1)
    .map((m) => `${m.role === 'user' ? 'Người dùng' : 'Trợ lý'}: ${prepareUserText(m.content, keep)}`)
    .join('\n');
  const last = req.messages[req.messages.length - 1]!;
  return [
    `<du_kien>${facts ? JSON.stringify(facts) : 'Không có bản nháp dây.'}</du_kien>`,
    `<lich_su>${history || 'Không có.'}</lich_su>`,
    `<cau_hoi>${prepareUserText(last.content, keep)}</cau_hoi>`,
  ].join('\n');
}

function parseAnswer(blocks: AssistantBlock[]): { ok: true; answer: CopilotAnswer } | { ok: false; why: string } {
  const text = blocks
    .filter((b): b is TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  const json = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const parsed = answerSchema.safeParse(JSON.parse(json));
    if (!parsed.success) return { ok: false, why: parsed.error.issues.map((i) => i.message).join('; ') };
    return { ok: true, answer: parsed.data };
  } catch {
    return { ok: false, why: 'Đầu ra không phải JSON hợp lệ' };
  }
}

const withLabel = (answer: CopilotAnswer, source: 'model' | 'calculator' | 'refusal'): CopilotEvent => ({
  type: 'answer',
  answer,
  source,
  label: AI_LABEL,
});

/** Runs one user turn. Yields events as they happen; the final event is always `answer` or `error`. */
export async function* runCopilot(opts: RunOptions): AsyncGenerator<CopilotEvent> {
  const { request, model, requestId } = opts;
  const log = opts.log ?? (() => {});
  const started = Date.now();
  const last = request.messages[request.messages.length - 1]!;
  const actionRequest = detectActionRequest(last.content);
  const facts = request.draft ? buildFacts(request.draft, request.circle) : request.circle ? { circle: request.circle } : undefined;
  const userTexts = request.messages.map((m) => m.content);

  const toolResults: { name: string; result: unknown }[] = [];
  const messages: TurnMessage[] = [{ role: 'user', content: buildUserMessage(request) }];
  let toolCalls = 0;
  let retried = false;
  let tokensIn = 0;
  let tokensOut = 0;

  const finish = (e: CopilotEvent): CopilotEvent => {
    log({ requestId, event: 'done', ms: Date.now() - started, tools: toolResults.map((t) => t.name), tokensIn, tokensOut, kind: e.type === 'answer' ? e.source : 'error' });
    return e;
  };

  try {
    for (let iter = 0; iter < LIMITS.maxModelIterations; iter++) {
      const turn = await model.complete({ system: SYSTEM_PROMPT, messages, signal: opts.signal });
      tokensIn += turn.usage?.inputTokens ?? 0;
      tokensOut += turn.usage?.outputTokens ?? 0;

      if (turn.stopReason === 'refusal' || turn.stopReason === 'max_tokens') {
        yield finish(withLabel(toolResults.length ? calculatorAnswer(toolResults) : refusalAnswer('model'), 'calculator'));
        return;
      }

      const uses = turn.content.filter((b): b is ToolUseBlock => b.type === 'tool_use');
      if (uses.length > 0) {
        messages.push({ role: 'assistant', content: turn.content });
        const results: ToolResultBlock[] = [];
        for (const use of uses) {
          if (toolCalls >= LIMITS.maxToolCallsPerTurn) {
            results.push({ type: 'tool_result', tool_use_id: use.id, is_error: true, content: 'Đã vượt số lần gọi tool tối đa của lượt này.' });
            continue;
          }
          toolCalls++;
          yield { type: 'status', text: STATUS[use.name] ?? 'Đang tính...' };
          try {
            const result = await runTool(use.name, use.input, opts.toolContext);
            toolResults.push({ name: use.name, result });
            yield { type: 'tool', name: use.name, result };
            results.push({ type: 'tool_result', tool_use_id: use.id, content: JSON.stringify(result) });
          } catch (e) {
            if (!(e instanceof ToolError)) throw e;
            yield { type: 'tool', name: use.name, result: null, error: e.message };
            results.push({ type: 'tool_result', tool_use_id: use.id, is_error: true, content: e.message });
          }
        }
        messages.push({ role: 'user', content: results });
        continue;
      }

      // Final answer: parse, guard, retry once, then fall back to the calculator table.
      messages.push({ role: 'assistant', content: turn.content });
      const parsed = parseAnswer(turn.content);
      let violations: string[];
      if (parsed.ok) {
        const g = checkAnswer({ answer: parsed.answer, userTexts, facts, toolResults, actionRequest });
        if (g.ok) {
          yield finish(withLabel(parsed.answer, parsed.answer.refused ? 'refusal' : 'model'));
          return;
        }
        violations = g.violations;
      } else {
        violations = [parsed.why];
      }
      log({ requestId, event: 'guard_reject', violations: violations.length, retried });
      if (!retried) {
        retried = true;
        messages.push({
          role: 'user',
          content: `Câu trả lời trước chưa đạt kiểm tra: ${violations.join(' | ')}. Hãy viết lại đúng một đối tượng JSON, chỉ dùng số từ kết quả tool hoặc dữ kiện, và kết thúc "answer" bằng câu miễn trừ.`,
        });
        continue;
      }
      break;
    }
    // Guard failed twice or the loop ran out: deterministic fallback (docs/07 3.2 item 4).
    if (actionRequest) yield finish(withLabel(refusalAnswer('action'), 'refusal'));
    else yield finish(withLabel(calculatorAnswer(toolResults), 'calculator'));
  } catch (e) {
    log({ requestId, event: 'error', name: e instanceof Error ? e.name : 'unknown' });
    if (actionRequest) {
      yield finish(withLabel(refusalAnswer('action'), 'refusal'));
      return;
    }
    yield finish({ type: 'error', code: 'model_unavailable', message: 'Trợ lý đang bận. Bạn dùng chế độ máy tính hoặc thử lại sau ít phút.' });
  }
}

export { DISCLAIMER };
