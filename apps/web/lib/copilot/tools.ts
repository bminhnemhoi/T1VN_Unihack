/**
 * The 6 read-only tools of docs/05 section 12 / docs/07 3.3. Pure, deterministic functions over `sdk`'s
 * `huiMath` and the generated `sim/outputs`. No network, no writes, no signing, no randomness.
 */
import { formatBps, huiMath, previewCircle } from 'sdk';
import { z } from 'zod';
import { explainRule } from './rules';
import { ubndNoticeMarkdown, UBND_PLACEHOLDERS } from './rules/ubnd';
import { RULE_TOPICS, TOOL_NAMES, toolInputSchemas, type ToolInput, type ToolName } from './schemas';
import { lookupSimulation } from './simResults';
import { amountToUnits, toDecimal } from './units';

const BPS = huiMath.BPS;
const ceilDiv = (a: bigint, b: bigint): bigint => (a + b - 1n) / b;

export class ToolError extends Error {
  constructor(
    readonly code: 'invalid_input' | 'unknown_tool' | 'too_many_calls' | 'unavailable',
    message: string,
  ) {
    super(message);
  }
}

export interface ToolContext {
  /** Optional on-chain `factory.isCircle` check (docs/07 3.3). Absent in unit tests and before the factory is deployed. */
  isCircle?: (address: string) => Promise<boolean>;
}

function units(label: string, v: number): bigint {
  const u = amountToUnits(v);
  if (u === undefined || u === 0n) throw new ToolError('invalid_input', `${label} phải dương và có tối đa 6 chữ số thập phân`);
  return u;
}

function computeExposure(i: ToolInput<'compute_exposure'>) {
  const n = BigInt(i.N);
  const c = units('C', i.C);
  const exposure: string[] = [];
  let peak = 0n;
  let peakRound = 0;
  for (let k = 0n; k <= n; k++) {
    const o = huiMath.exposure(n, k, c);
    exposure.push(toDecimal(o));
    if (o > peak) {
      peak = o;
      peakRound = Number(k);
    }
  }
  return { exposure, maxExposure: toDecimal(huiMath.maxExposure(n, c)), peakRound };
}

function recommendBond(i: ToolInput<'recommend_bond'>) {
  const n = BigInt(i.N);
  const c = units('C', i.C);
  const alpha = BigInt(i.alphaBps);
  const target = BigInt(i.targetCoverageBps);
  const oMax = huiMath.maxExposure(n, c);
  // Same formula as `previewCircle` (bondFor100 / bondForMin): ceil((target - alpha) * O_max / 10_000), at least 0.
  const raw = target > alpha ? ceilDiv((target - alpha) * oMax, BPS) : 0n;
  const coverage = huiMath.coverageIndexBps(alpha, raw, 0n, n, c);
  return {
    maxExposure: toDecimal(oMax),
    bond: toDecimal(raw),
    guaranteedCoverageBps: Number(coverage),
    // Display form of the same value, so the model never converts basis points itself.
    guaranteedCoveragePercent: formatBps(coverage).replace('%', ''),
  };
}

function maxBidTable(i: ToolInput<'max_bid_table'>) {
  const n = BigInt(i.N);
  const c = units('C', i.C);
  const p = previewCircle({ n, c, periodDays: BigInt(i.periodDays), alphaBps: 0n, bond: 0n, capBps: BigInt(i.capBps) });
  return { rows: p.bidRows.map((r) => ({ k: r.k, payers: r.payers, maxBid: toDecimal(r.maxBid) })) };
}

function simulateCircle(i: ToolInput<'simulate_circle'>) {
  return lookupSimulation(i);
}

function explain(i: ToolInput<'explain_rule'>) {
  const r = explainRule(i.topic);
  return { topic: r.topic, text: r.text, citation: r.citation, url: r.url, checkedAt: r.checkedAt };
}

async function draftUbnd(i: ToolInput<'draft_ubnd_notice'>, ctx: ToolContext) {
  if (ctx.isCircle && !(await ctx.isCircle(i.circle))) {
    throw new ToolError('invalid_input', 'Địa chỉ này không phải dây hụi của HụiSafe');
  }
  return { markdown: ubndNoticeMarkdown(i.circle), placeholders: [...UBND_PLACEHOLDERS] };
}

/** Validate then run one tool. Unknown tool names and unknown or out-of-range fields throw `ToolError`. */
export async function runTool(name: string, rawInput: unknown, ctx: ToolContext = {}): Promise<unknown> {
  if (!(TOOL_NAMES as readonly string[]).includes(name)) throw new ToolError('unknown_tool', `Không có tool ${name}`);
  const tool = name as ToolName;
  const parsed = toolInputSchemas[tool].safeParse(rawInput);
  if (!parsed.success) {
    throw new ToolError('invalid_input', parsed.error.issues.map((x) => `${x.path.join('.') || 'input'}: ${x.message}`).join('; '));
  }
  try {
    switch (tool) {
      case 'compute_exposure':
        return computeExposure(parsed.data as ToolInput<'compute_exposure'>);
      case 'recommend_bond':
        return recommendBond(parsed.data as ToolInput<'recommend_bond'>);
      case 'max_bid_table':
        return maxBidTable(parsed.data as ToolInput<'max_bid_table'>);
      case 'simulate_circle':
        return simulateCircle(parsed.data as ToolInput<'simulate_circle'>);
      case 'explain_rule':
        return explain(parsed.data as ToolInput<'explain_rule'>);
      case 'draft_ubnd_notice':
        return await draftUbnd(parsed.data as ToolInput<'draft_ubnd_notice'>, ctx);
    }
  } catch (e) {
    if (e instanceof ToolError) throw e;
    if (e instanceof RangeError) throw new ToolError('invalid_input', e.message);
    throw e;
  }
}

const DESCRIPTIONS: Record<ToolName, string> = {
  compute_exposure:
    'Tính tiền chưa đóng theo từng kỳ O(k) và đỉnh O_max cho dây N phần, mức góp C (giữ nguyên đơn vị tiền người dùng nêu, không quy đổi).',
  recommend_bond: 'Tính ký quỹ cần để đạt chỉ số bảo chứng mục tiêu với tỷ lệ giữ lại alphaBps (đơn vị basis point, 2000 = 20%).',
  max_bid_table: 'Bảng trần tiền thăm theo từng kỳ, tính theo cách hiểu của HụiSafe về trần lãi (cần luật sư xác nhận). Muốn nói về điều luật thì gọi thêm explain_rule.',
  simulate_circle:
    'Tra kết quả mô phỏng đã chạy sẵn (tổn thất người hốt sau, xác suất vỡ dây) ở ba thiết kế; chỉ khớp đúng N, alphaBps, bondRatio đã chạy, nếu không có thì trả no_results.',
  explain_rule: 'Trả nội dung đã duyệt về một quy định (NĐ 19 các điều 5, 6, 12, 13, 14, 18, 20, 21, 22, 25; tiền mã hóa; luật cuộc thi) để trích dẫn.',
  draft_ubnd_notice: 'Soạn bản nháp thông báo tổ chức dây họ gửi UBND cấp xã khi chạm ngưỡng NĐ 19 Điều 14. Chỉ trả ô trống nhân thân.',
};

/** Tool definitions for the Messages API, generated from the same Zod schemas that validate calls. */
export function toolDefinitions() {
  return TOOL_NAMES.map((name) => {
    const schema = z.toJSONSchema(toolInputSchemas[name], { target: 'draft-7', io: 'input' }) as Record<string, unknown>;
    delete schema.$schema;
    return {
      name,
      description: DESCRIPTIONS[name],
      input_schema: { ...schema, type: 'object' as const },
    };
  });
}

export { RULE_TOPICS };
