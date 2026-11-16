/**
 * Copilot engine: model loop + deterministic tool runner + output guard (docs/07 3.2).
 * The model is injected (`ModelClient`) so tests and the eval harness run with no key and no network.
 */
import { AI_LABEL, DISCLAIMER, LIMITS } from './config';
import { buildFacts } from './facts';
import { checkAnswer, detectActionRequest } from './guard';
import { SYSTEM_PROMPT } from './prompt';
import { prepareUserText } from './scrub';
import { stripReasoning } from './text';
import { answerSchema, type CopilotAnswer, type CopilotRequest } from './schemas';
import { runTool, ToolError, type ToolContext } from './tools';
import { calculatorAnswer, refusalAnswer } from './templates';
import { ProviderError } from './providers/error';

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
  /** The router sent `arguments` that were not valid JSON: answer with an error so the model retries (never throw). */
  invalidArguments?: true;
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
  /** `raw` is the assistant message exactly as the provider returned it; adapters replay it (Gemini thought signatures). */
  | { role: 'assistant'; content: AssistantBlock[]; raw?: unknown };

export interface ModelTurn {
  content: AssistantBlock[];
  stopReason: 'end_turn' | 'tool_use' | 'refusal' | 'max_tokens' | 'other';
  usage?: { inputTokens: number; outputTokens: number };
  /** Model id the provider says it used (a gateway may differ from the one requested). */
  model?: string;
  raw?: unknown;
}

export interface CompleteArgs {
  system: string;
  messages: TurnMessage[];
  /** `none` on the last tool round forces a final answer. */
  toolChoice?: 'auto' | 'none';
  signal?: AbortSignal;
}

/** The seam for providers, tests and the eval harness (the Goblin bot calls it `LlmLike`). */
export interface ModelClient {
  info?: { provider: string; model: string };
  complete(args: CompleteArgs): Promise<ModelTurn>;
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
  /** Per-tool timeout; defaults to `LIMITS.toolTimeoutMs`. */
  toolTimeoutMs?: number;
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
  const text = stripReasoning(
    blocks
      .filter((b): b is TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join(''),
  );
  const unfenced = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  // Some models add a sentence around the JSON: fall back to the outermost braces.
  const braces = unfenced.slice(unfenced.indexOf('{'), unfenced.lastIndexOf('}') + 1);
  for (const candidate of [unfenced, braces]) {
    try {
      const parsed = answerSchema.safeParse(JSON.parse(candidate));
      if (parsed.success) return { ok: true, answer: { ...parsed.data, answer: stripReasoning(parsed.data.answer) } };
      return { ok: false, why: parsed.error.issues.map((i) => i.message).join('; ') };
    } catch {
      // try the next candidate
    }
  }
  return { ok: false, why: 'Đầu ra không phải JSON hợp lệ' };
}

const withLabel = (answer: CopilotAnswer, source: 'model' | 'calculator' | 'refusal'): CopilotEvent => ({
  type: 'answer',
  answer,
  source,
  label: AI_LABEL,
});

function withTimeout<T>(p: Promise<T>, ms: number, name: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ToolError('unavailable', `Tool ${name} quá ${ms / 1000} giây`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

type Executed = { use: ToolUseBlock; result?: unknown; error?: string };

/** Runs one user turn. Yields events as they happen; the final event is always `answer` or `error`. */
export async function* runCopilot(opts: RunOptions): AsyncGenerator<CopilotEvent> {
  const { request, model, requestId } = opts;
  const log = opts.log ?? (() => {});
  const started = Date.now();
  const last = request.messages[request.messages.length - 1]!;
  const actionRequest = detectActionRequest(last.content);
  const facts = request.draft ? buildFacts(request.draft, request.circle) : request.circle ? { circle: request.circle } : undefined;
  const userTexts = request.messages.map((m) => m.content);
  const toolTimeoutMs = opts.toolTimeoutMs ?? LIMITS.toolTimeoutMs;

  const toolResults: { name: string; result: unknown }[] = [];
  const messages: TurnMessage[] = [{ role: 'user', content: buildUserMessage(request) }];
  let toolCalls = 0;
  let toolRounds = 0;
  let retried = false;
  let tokensIn = 0;
  let tokensOut = 0;
  let returnedModel: string | undefined;

  const finish = (e: CopilotEvent): CopilotEvent => {
    // Metadata only (docs/07 3.8 item 3): never message content, never a key.
    log({
      requestId,
      event: 'done',
      provider: model.info?.provider,
      requestedModel: model.info?.model,
      returnedModel,
      ms: Date.now() - started,
      rounds: toolRounds,
      tools: toolResults.map((t) => t.name),
      tokensIn,
      tokensOut,
      kind: e.type === 'answer' ? e.source : 'error',
    });
    return e;
  };

  try {
    for (let call = 0; call < LIMITS.maxToolRounds + 2; call++) {
      if (opts.signal?.aborted) throw new Error('aborted');
      // On the last tool round no tools may be called: the model must answer.
      const lastRound = toolRounds >= LIMITS.maxToolRounds;
      const turn = await model.complete({ system: SYSTEM_PROMPT, messages, toolChoice: lastRound ? 'none' : 'auto', signal: opts.signal });
      tokensIn += turn.usage?.inputTokens ?? 0;
      tokensOut += turn.usage?.outputTokens ?? 0;
      returnedModel = turn.model ?? returnedModel;

      if (turn.stopReason === 'refusal' || turn.stopReason === 'max_tokens') {
        yield finish(withLabel(toolResults.length ? calculatorAnswer(toolResults) : refusalAnswer('model'), 'calculator'));
        return;
      }

      const allUses = turn.content.filter((b): b is ToolUseBlock => b.type === 'tool_use');
      const uses = lastRound ? [] : allUses;
      if (uses.length > 0) {
        toolRounds++;
        // Replay the assistant message exactly as returned (keeps Gemini's thought signature), before the tool results.
        messages.push({ role: 'assistant', content: turn.content, raw: turn.raw });

        const planned = uses.map((use) => {
          if (toolCalls >= LIMITS.maxToolCallsPerTurn) return { use, rejected: 'Đã vượt số lần gọi tool tối đa của lượt này.' };
          toolCalls++;
          if (use.invalidArguments) return { use, rejected: 'Lỗi: arguments không phải JSON hợp lệ, gọi lại với JSON đúng.' };
          return { use, rejected: undefined };
        });
        for (const p of planned) if (!p.rejected) yield { type: 'status', text: STATUS[p.use.name] ?? 'Đang tính...' };

        // All six tools are read-only and deterministic, so parallel execution is safe.
        const executed: Executed[] = await Promise.all(
          planned.map(async (p): Promise<Executed> => {
            if (p.rejected) return { use: p.use, error: p.rejected };
            try {
              const result = await withTimeout(runTool(p.use.name, p.use.input, opts.toolContext), toolTimeoutMs, p.use.name);
              return { use: p.use, result };
            } catch (e) {
              if (e instanceof ToolError) return { use: p.use, error: e.message };
              throw e;
            }
          }),
        );

        const results: ToolResultBlock[] = [];
        for (const ex of executed) {
          if (ex.error === undefined) {
            toolResults.push({ name: ex.use.name, result: ex.result });
            yield { type: 'tool', name: ex.use.name, result: ex.result };
            results.push({ type: 'tool_result', tool_use_id: ex.use.id, content: JSON.stringify(ex.result) });
          } else {
            yield { type: 'tool', name: ex.use.name, result: null, error: ex.error };
            results.push({ type: 'tool_result', tool_use_id: ex.use.id, is_error: true, content: ex.error });
          }
        }
        messages.push({ role: 'user', content: results });
        continue;
      }

      // Final answer: parse, guard, retry once, then fall back to the calculator table.
      // Tool calls the model made on the last round are dropped, so the history never has a call without a result.
      messages.push(
        allUses.length > 0
          ? { role: 'assistant', content: turn.content.filter((b) => b.type === 'text') }
          : { role: 'assistant', content: turn.content, raw: turn.raw },
      );
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
    log({ requestId, event: 'error', name: e instanceof Error ? e.name : 'unknown', ...(e instanceof ProviderError && e.status ? { status: e.status } : {}) });
    if (actionRequest) {
      yield finish(withLabel(refusalAnswer('action'), 'refusal'));
      return;
    }
    yield finish({ type: 'error', code: 'model_unavailable', message: 'Trợ lý đang bận. Bạn dùng chế độ máy tính hoặc thử lại sau ít phút.' });
  }
}

export { DISCLAIMER };
