/**
 * Deterministic output checker (docs/07 3.6 row 3). Runs before the user sees an answer:
 *  1. every number in `answer` and `figures` comes from a tool result, the facts block or the user's own text;
 *  2. `citations` and legal wording are backed by an `explain_rule` call;
 *  3. the answer ends with the mandatory disclaimer;
 *  4. no forbidden promises or role claims;
 *  5. `refused = true` when the request is an action request (move money, bid, sign, call a contract).
 */
import { DISCLAIMER } from './config';
import type { CopilotAnswer, RuleTopic } from './schemas';

/** A number token: digits with optional vi/en separators ("2.000", "6,575342", "6.575342", "100"). */
const NUMBER_RE = /\d+(?:[.,]\d+)*/g;

/** Candidate values of a token. Dot-only tokens are read both as decimal and as thousands grouping when ambiguous. */
export function numberValues(token: string): number[] {
  const hasDot = token.includes('.');
  const hasComma = token.includes(',');
  const out = new Set<number>();
  if (hasDot && hasComma) {
    out.add(Number(token.replace(/\./g, '').replace(',', '.')));
  } else if (hasComma) {
    const parts = token.split(',');
    out.add(Number(parts.length === 2 ? `${parts[0]}.${parts[1]}` : parts.join('')));
    if (parts.length === 2 && parts[1]!.length === 3) out.add(Number(parts.join('')));
  } else if (hasDot) {
    const parts = token.split('.');
    const grouped = parts.slice(1).every((p) => p.length === 3) && parts[0]!.length <= 3;
    if (parts.length === 2) out.add(Number(token));
    if (grouped) out.add(Number(parts.join('')));
  } else {
    out.add(Number(token));
  }
  return [...out].filter((v) => Number.isFinite(v));
}

/** Numbers in free text, ignoring list markers ("1." / "2)") at the start of a line. */
export function extractNumbers(text: string): { token: string; values: number[] }[] {
  const cleaned = text.replace(/^\s*\d+[.)]\s+/gm, '');
  const out: { token: string; values: number[] }[] = [];
  for (const m of cleaned.matchAll(NUMBER_RE)) {
    // A trailing separator ("... kỳ 3.") is sentence punctuation, never part of the number (regex already excludes it).
    out.push({ token: m[0], values: numberValues(m[0]) });
  }
  return out;
}

/** Every number found anywhere inside a JSON value (strings are scanned, numbers taken as is). */
export function collectNumbers(value: unknown, into: Set<number> = new Set()): Set<number> {
  if (typeof value === 'number') {
    if (Number.isFinite(value)) into.add(value);
  } else if (typeof value === 'string') {
    for (const t of extractNumbers(value)) for (const v of t.values) into.add(v);
  } else if (Array.isArray(value)) {
    for (const v of value) collectNumbers(v, into);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectNumbers(v, into);
  }
  return into;
}

export interface GuardInput {
  answer: CopilotAnswer;
  /** The user's latest message and recent turns (numbers the user wrote themselves are allowed). */
  userTexts: string[];
  facts?: unknown;
  toolResults: { name: string; result: unknown }[];
  /** Whether the request is an action request (see `detectActionRequest`). */
  actionRequest: boolean;
}

export interface GuardResult {
  ok: boolean;
  violations: string[];
}

/**
 * JS `\b` only knows ASCII word characters, so it fails next to Vietnamese letters ("ký quỹ", "chị").
 * `B` and `E` are Unicode-aware start and end boundaries for the `u` flag.
 */
const B = '(?<![\\p{L}\\p{N}])';
const E = '(?![\\p{L}\\p{N}])';
const re = (source: string): RegExp => new RegExp(source, 'iu');

const NEGATION = re(`${B}(không|chưa|chẳng|đừng)${E}`);
const HEDGE_PROMISES = /(chắc chắn|đảm bảo|tuyệt đối|cam kết)/i;
const PROFIT = /(lợi nhuận|sinh lời|siêu lợi|lãi lớn)/i;
const NEVER_LOSE = /không bao giờ mất tiền/i;
const NEVER_LOSE_EXEMPT = /(không\s+(thể|có thể|dám)\s+(nói|hứa|khẳng định|đảm bảo|cam kết)|không có nghĩa|không phải|không nên tin)/i;
const SELF_CLAIM = re(
  `${B}(tôi|mình|em|trợ lý)\\s+(là|xin là|sẽ là)\\s+(một\\s+)?luật sư|luật sư\\s+ai${E}|tư vấn\\s+(cho\\s+)?(bạn|anh|chị|cô|chú|bác)${E}|${B}(tôi|mình)\\s+tư vấn`,
);
const LEGAL_MENTION = /(Điều\s+\d+|khoản\s+\d+|Nghị định|NĐ\s*\d+|Nghị quyết|NQ\s*\d+|Bộ luật)/i;

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

export function checkAnswer(input: GuardInput): GuardResult {
  const v: string[] = [];
  const { answer } = input;

  // (3) disclaimer: the last sentence, exactly.
  const trimmed = answer.answer.trimEnd();
  if (!trimmed.endsWith(DISCLAIMER)) v.push('Thiếu câu miễn trừ ở cuối câu trả lời');
  const body = trimmed.endsWith(DISCLAIMER) ? trimmed.slice(0, -DISCLAIMER.length) : trimmed;

  // (1) numbers.
  const allowed = new Set<number>();
  collectNumbers(input.facts, allowed);
  for (const r of input.toolResults) collectNumbers(r.result, allowed);
  for (const t of input.userTexts) collectNumbers(t, allowed);
  const foreign = new Set<string>();
  for (const t of extractNumbers(body)) {
    if (!t.values.some((x) => allowed.has(x))) foreign.add(t.token);
  }
  if (foreign.size > 0) v.push(`Số không có trong kết quả tool hoặc dữ kiện: ${[...foreign].join(', ')}`);
  for (const f of answer.figures) {
    const ok = numberValues(f.value.replace(/\s/g, '')).some((x) => allowed.has(x));
    if (!ok) v.push(`figures chứa số không có nguồn: ${f.value}`);
  }

  // (2) citations and legal wording.
  const called = new Set<string>(
    input.toolResults
      .filter((r) => r.name === 'explain_rule')
      .map((r) => (r.result as { topic?: string } | null)?.topic)
      .filter((t): t is string => typeof t === 'string'),
  );
  for (const c of answer.citations) {
    if (!called.has(c.topic)) v.push(`Trích dẫn ${c.topic} nhưng chưa gọi explain_rule cho chủ đề này`);
  }
  if (LEGAL_MENTION.test(body) && called.size === 0) v.push('Nói về điều luật nhưng chưa gọi explain_rule');
  if (LEGAL_MENTION.test(body) && answer.citations.length === 0 && called.size > 0) v.push('Có điều luật nhưng citations rỗng');

  // (4) forbidden promises and role claims.
  for (const s of sentences(body)) {
    if (NEVER_LOSE.test(s) && !NEVER_LOSE_EXEMPT.test(s)) v.push(`Lời hứa tuyệt đối: "${s.slice(0, 60)}"`);
    if ((HEDGE_PROMISES.test(s) || PROFIT.test(s)) && !NEGATION.test(s)) v.push(`Từ cấm trong câu: "${s.slice(0, 60)}"`);
    if (SELF_CLAIM.test(s) && !NEGATION.test(s)) v.push(`Nhận vai luật sư hoặc tư vấn: "${s.slice(0, 60)}"`);
  }

  // (5) action requests must be refused.
  if (input.actionRequest && !answer.refused) v.push('Yêu cầu hành động (chuyển tiền, bỏ thăm, ký, gọi hàm) nhưng refused = false');
  if (input.actionRequest && input.toolResults.length > 0) v.push('Yêu cầu hành động nhưng đã gọi tool');

  return { ok: v.length === 0, violations: v };
}

/** Topics for which `explain_rule` ran, used by the harness and tests. */
export function calledRuleTopics(toolResults: { name: string; result: unknown }[]): RuleTopic[] {
  return toolResults
    .filter((r) => r.name === 'explain_rule')
    .map((r) => (r.result as { topic: RuleTopic }).topic);
}

/**
 * Action requests (docs/07 3.1 "không làm"): move money, place a bid, call a contract function, sign.
 * Conservative on purpose: a hit forces a refusal, a miss leaves the model's own refusal rule in charge.
 */
const ACTION_PATTERNS: RegExp[] = [
  re(`${B}(chuyển|gửi|trả|rút)${E}.{0,40}${B}(tiền|usdc|avax|ký quỹ)${E}.{0,40}${B}(giúp|hộ|dùm|giùm|cho tôi|cho mình|đi|ngay|luôn)${E}`),
  re(`${B}(chuyển|gửi)\\s+\\d[\\d.,]*\\s*(usdc|avax|đồng|vnd)`),
  re(`${B}(bỏ thăm|nộp thăm|đấu thăm|mở thăm)${E}.{0,40}${B}(giúp|hộ|dùm|giùm|đi|ngay)${E}`),
  re(`${B}(gọi|chạy|thực hiện|kích hoạt)${E}.{0,30}${B}(markdefault|settleround|finalize|activate|paylate|repaydebt|claim|emergencyunwind)${E}`),
  re(`${B}rút${E}.{0,20}${B}ký quỹ${E}.{0,40}${B}(ra|trước|ngay|đi)${E}`),
  re(`${B}(ký|kí)${E}.{0,20}${B}(giúp|hộ|dùm|giùm|thay)${E}`),
];

export function detectActionRequest(text: string): boolean {
  return ACTION_PATTERNS.some((re) => re.test(text));
}
