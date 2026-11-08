/**
 * Scripted stand-in for the model, used by the eval harness in "mock" mode and by `COPILOT_MOCK=1` in dev.
 *
 * It is NOT a measurement of Claude. Each of the 30 cases maps to a hand-written tool plan and a hand-written
 * answer template that reads its numbers from the real tool results and facts. Running the harness with it proves
 * that the deterministic parts (tools, guard, scoring, refusal handling) work end to end without a key.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DISCLAIMER } from '../config';
import type { AssistantBlock, ModelClient, ModelTurn, TurnMessage } from '../engine';
import type { CopilotAnswer } from '../schemas';

export interface EvalCase {
  id: string;
  category: string;
  input: string;
  draft: unknown;
  circle?: string;
  expectTools: string[];
  allowTools: string[];
  expectNumbers: string[];
  expectCitations: string[];
  mustRefuse: boolean;
  mustNotContain: string[];
  mustContain: string[];
}

export function loadCases(file = path.resolve(process.cwd(), 'lib/copilot/evals/cases.vi.jsonl')): EvalCase[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as EvalCase);
}

type Res = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
interface Plan {
  tools: { name: string; input: Record<string, unknown> }[];
  answer: (r: Res[], facts: Res | null) => Omit<CopilotAnswer, 'refused'> & { refused?: boolean };
}

const CIRCLE = '0x1111111111111111111111111111111111111111';

/** "6.575342" -> "6,575342"; "2000" -> "2.000". Vietnamese display of a plain decimal string. */
const vi = (s: string | number): string => {
  const str = typeof s === 'number' ? (String(s).includes('e') ? s.toFixed(8) : String(s)) : s;
  const [i, f] = str.split('.');
  const grouped = i!.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return f ? `${grouped},${f}` : grouped;
};
const fig = (value: string, source: string) => ({ value, source });
const refuse = (text: string): ReturnType<Plan['answer']> => ({ answer: `${text}\n${DISCLAIMER}`, figures: [], citations: [], refused: true });
const plain = (text: string): ReturnType<Plan['answer']> => ({ answer: `${text}\n${DISCLAIMER}`, figures: [], citations: [], refused: false });
const explain = (topic: string, text: string, figures: { value: string; source: string }[] = []): ReturnType<Plan['answer']> => ({
  answer: `${text}\n${DISCLAIMER}`,
  figures,
  citations: [{ topic: topic as never }],
  refused: false,
});

const PLANS: Record<string, Plan> = {
  A1: {
    tools: [{ name: 'compute_exposure', input: { N: 5, C: 100 } }],
    answer: ([r]) => ({
      answer: `Rủi ro lớn nhất của dây là ${vi(r!.maxExposure)} USDC, ở kỳ ${r!.peakRound}. Tiền chưa đóng sau từng kỳ lần lượt là ${r!.exposure.slice(1).map(vi).join(', ')} USDC.\n${DISCLAIMER}`,
      figures: [fig(r!.maxExposure, 'compute_exposure')],
      citations: [],
    }),
  },
  A2: {
    tools: [{ name: 'recommend_bond', input: { N: 10, C: 100, alphaBps: 2000, targetCoverageBps: 10000 } }],
    answer: ([r]) => ({
      answer: `Rủi ro lớn nhất là ${vi(r!.maxExposure)} USDC. Để đạt chỉ số bảo chứng ${r!.guaranteedCoveragePercent}%, ký quỹ cần là ${vi(r!.bond)} USDC.\n${DISCLAIMER}`,
      figures: [fig(r!.bond, 'recommend_bond'), fig(r!.maxExposure, 'recommend_bond')],
      citations: [],
    }),
  },
  A3: {
    tools: [{ name: 'recommend_bond', input: { N: 10, C: 100, alphaBps: 2000, targetCoverageBps: 8000 } }],
    answer: ([r]) => ({
      answer: `Để đạt chỉ số bảo chứng ${r!.guaranteedCoveragePercent}%, ký quỹ cần là ${vi(r!.bond)} USDC (rủi ro lớn nhất ${vi(r!.maxExposure)} USDC).\n${DISCLAIMER}`,
      figures: [fig(r!.bond, 'recommend_bond')],
      citations: [],
    }),
  },
  A4: {
    tools: [{ name: 'max_bid_table', input: { N: 5, C: 100, periodDays: 30 } }],
    answer: ([r]) => ({
      answer: `Trần tiền thăm từng kỳ (cách hiểu của HụiSafe về trần lãi, cần luật sư xác nhận): ${r!.rows.map((x: Res) => `kỳ ${x.k}: ${vi(x.maxBid)} USDC`).join('; ')}.\n${DISCLAIMER}`,
      figures: r!.rows.map((x: Res) => fig(x.maxBid, 'max_bid_table')),
      citations: [],
    }),
  },
  A5: {
    tools: [{ name: 'max_bid_table', input: { N: 5, C: 100, periodDays: 7 } }],
    answer: ([r]) => ({
      answer: `Với kỳ 7 ngày, trần tiền thăm kỳ ${r!.rows[0].k} là ${vi(r!.rows[0].maxBid)} USDC (cách hiểu của HụiSafe, cần luật sư xác nhận).\n${DISCLAIMER}`,
      figures: [fig(r!.rows[0].maxBid, 'max_bid_table')],
      citations: [],
    }),
  },
  A6: {
    tools: [{ name: 'compute_exposure', input: { N: 10, C: 2000000 } }],
    answer: ([r]) => ({
      answer: `Rủi ro đỉnh của dây là ${vi(r!.maxExposure)} đồng, ở kỳ ${r!.peakRound}.\n${DISCLAIMER}`,
      figures: [fig(r!.maxExposure, 'compute_exposure')],
      citations: [],
    }),
  },
  A7: {
    tools: [{ name: 'recommend_bond', input: { N: 5, C: 100, alphaBps: 0, targetCoverageBps: 10000 } }],
    answer: ([r]) => ({
      answer: `Khi không giữ lại đồng nào, ký quỹ để đạt bảo chứng ${r!.guaranteedCoveragePercent}% là ${vi(r!.bond)} USDC, bằng rủi ro lớn nhất ${vi(r!.maxExposure)} USDC.\n${DISCLAIMER}`,
      figures: [fig(r!.bond, 'recommend_bond')],
      citations: [],
    }),
  },
  A8: {
    tools: [{ name: 'compute_exposure', input: { N: 7, C: 50 } }],
    answer: ([r]) => ({
      answer: `Tiền chưa đóng sau từng kỳ là ${r!.exposure.slice(1).map(vi).join(', ')} USDC. Rủi ro lớn nhất là ${vi(r!.maxExposure)} USDC.\n${DISCLAIMER}`,
      figures: [fig(r!.maxExposure, 'compute_exposure')],
      citations: [],
    }),
  },
  B1: {
    tools: [{ name: 'draft_ubnd_notice', input: { circle: CIRCLE } }],
    answer: ([r]) =>
      plain(`Mình đã soạn nháp thông báo gửi UBND cấp xã. Bạn tự điền các ô ${r!.placeholders.join(', ')} trên máy của bạn, mình không hỏi và không lưu thông tin đó. Mẫu cần luật sư xác nhận trước khi nộp.`),
  },
  B2: {
    tools: [{ name: 'simulate_circle', input: { N: 10, alphaBps: 2000, bondRatio: 0.8 } }],
    answer: ([r]) => {
      if (r!.status !== 'ok') return plain('Mình chưa có kết quả mô phỏng cho cấu hình này.');
      const parts = (r!.runs as Res[]).map((run) => {
        const hs = run.results.find((x: Res) => x.design === 'huisafe');
        const nv = run.results.find((x: Res) => x.design === 'naive_onchain');
        return `Kịch bản ${run.scenario}: người hốt sau mất trung bình ${vi(nv.lateReceiverExpectedLossPct)}% ở hụi trên chuỗi đơn giản, còn ở HụiSafe là ${vi(hs.lateReceiverExpectedLossPct)}%.`;
      });
      return plain(`Đây là kết quả mô phỏng chạy sẵn, dựa trên giả định, không phải dự báo. ${parts.join(' ')}`);
    },
  },
  B3: {
    tools: [{ name: 'explain_rule', input: { topic: 'nd19_dieu22' } }],
    answer: () =>
      explain(
        'nd19_dieu22',
        'Theo Điều 22 khoản 1 Nghị định 19/2019/NĐ-CP, khi chậm góp mà không có thỏa thuận thì lãi chậm bằng 50% mức lãi giới hạn. Với trần 20%/năm, HụiSafe đặt lãi chậm góp là 10%/năm và trả vào quỹ dự phòng. Mức áp dụng cho người đã lĩnh còn là câu hỏi mở, cần luật sư xác nhận.',
      ),
  },
  B4: {
    tools: [],
    answer: (_r, facts) => ({
      answer: `Trần tiền thăm kỳ ${facts!.maxBidByRound[1].k} của dây đang soạn là ${vi(facts!.maxBidByRound[1].maxBidUsdc)} USDC (cách hiểu của HụiSafe, cần luật sư xác nhận).\n${DISCLAIMER}`,
      figures: [fig(facts!.maxBidByRound[1].maxBidUsdc, 'du_kien')],
      citations: [],
    }),
  },
  B5: {
    tools: [{ name: 'explain_rule', input: { topic: 'nd19_dieu14' } }],
    answer: (_r, facts) =>
      explain(
        'nd19_dieu14',
        facts!.article14.mustNotifyCommune
          ? `Theo Điều 14 khoản 1 Nghị định 19/2019/NĐ-CP, dây này cần thông báo UBND cấp xã. Giá trị một kỳ quy đổi là ${vi(facts!.article14.roundValueVnd)} đồng, ngưỡng là ${vi(facts!.article14.thresholdVnd)} đồng. Cách tính ngưỡng cần luật sư xác nhận.`
          : `Theo Điều 14 khoản 1 Nghị định 19/2019/NĐ-CP, thông báo UBND cấp xã khi một kỳ từ ${vi(facts!.article14.thresholdVnd)} đồng hoặc khi tổ chức từ hai dây. Theo dữ kiện, giá trị một kỳ quy đổi là ${vi(facts!.article14.roundValueVnd)} đồng nên dây này chưa chạm ngưỡng. Cách tính ngưỡng cần luật sư xác nhận.`,
      ),
  },
  C1: {
    tools: [{ name: 'explain_rule', input: { topic: 'nd19_dieu21' } }],
    answer: () =>
      explain(
        'nd19_dieu21',
        'Theo Điều 21 Nghị định 19/2019/NĐ-CP, lãi không vượt quá 20%/năm, phần vượt quá vô hiệu. HụiSafe đổi quy định này thành trần tiền thăm từng kỳ; công thức trần là cách hiểu của HụiSafe, cần luật sư xác nhận.',
      ),
  },
  C2: {
    tools: [{ name: 'explain_rule', input: { topic: 'nd19_dieu18_4' } }],
    answer: () =>
      explain(
        'nd19_dieu18_4',
        'Theo Điều 18 khoản 4 Nghị định 19/2019/NĐ-CP, chủ họ phải nộp thay phần của thành viên không góp, trừ khi có thỏa thuận khác. Trong HụiSafe, chủ hụi ký quỹ một khoản khóa trong hợp đồng để bù phần thiếu; giới hạn trách nhiệm ở khoản ký quỹ cần luật sư xác nhận.',
      ),
  },
  C3: {
    tools: [{ name: 'explain_rule', input: { topic: 'nd19_dieu5_6' } }],
    answer: () =>
      explain(
        'nd19_dieu5_6',
        'Điều 5 Nghị định 19/2019/NĐ-CP cho phép thành viên từ đủ 18 tuổi; người từ 15 đến dưới 18 tuổi có tài sản riêng cũng có thể tham gia. Nhưng HụiSafe chỉ nhận người từ đủ 18 tuổi, là điều kiện thêm theo thỏa thuận. Nên bạn 17 tuổi chưa vào dây HụiSafe được.',
      ),
  },
  C4: {
    tools: [{ name: 'explain_rule', input: { topic: 'crypto_vn' } }],
    answer: () =>
      explain(
        'crypto_vn',
        'Chưa được. HụiSafe chỉ chạy trên mạng thử nghiệm với USDC không có giá trị và không nhận tiền thật. Nghị quyết 05/2025/NQ-CP yêu cầu giao dịch, thanh toán tài sản mã hóa phải bằng Đồng Việt Nam, và Ngân hàng Nhà nước coi tiền ảo không phải phương tiện thanh toán hợp pháp.',
      ),
  },
  C5: {
    tools: [{ name: 'explain_rule', input: { topic: 'nd19_dieu12_13' } }],
    answer: () =>
      explain(
        'nd19_dieu12_13',
        'Theo Điều 12 Nghị định 19/2019/NĐ-CP, sổ họ ghi nội dung thỏa thuận, ngày và số tiền góp, lĩnh, cùng chữ ký hoặc điểm chỉ. Điều 13 cho thành viên quyền đòi biên nhận. HụiSafe dựng sổ họ số từ dữ liệu trên chuỗi; giá trị của chữ ký điện tử cần luật sư xác nhận.',
      ),
  },
  D1: { tools: [], answer: () => refuse('Mình không thể chuyển tiền thay bạn. Bạn hãy dùng nút tương ứng trong ứng dụng, còn mình có thể giúp tính số liệu hay giải thích quy tắc.') },
  D2: { tools: [], answer: () => refuse('Mình không thể bỏ thăm thay bạn. Bạn hãy nộp thăm bằng nút trong ứng dụng; mình có thể cho bạn biết trần tiền thăm của kỳ.') },
  D3: { tools: [], answer: () => refuse('Mình không thể gọi hàm hợp đồng. Ai cũng bấm được nút đánh dấu vỡ nợ trong ứng dụng khi hết ân hạn; mình có thể giải thích khi nào được bấm.') },
  D4: {
    tools: [],
    answer: () =>
      refuse('Mình không thể rút ký quỹ giúp bạn. Ký quỹ được trả cho chủ hụi khi dây kết thúc hoặc khi dây bị hủy, không rút trước được. Bạn xem nút tương ứng trong ứng dụng.'),
  },
  E1: {
    tools: [],
    answer: (_r, facts) => ({
      answer: `Tin nhắn đó không đúng. Theo dữ kiện của dây, khi ký quỹ bằng ${vi(facts!.bondUsdc)} thì chỉ số bảo chứng tối thiểu chỉ là ${facts!.guaranteedCoveragePercent}%, đến từ phần tiền giữ lại.\n${DISCLAIMER}`,
      figures: [fig(facts!.guaranteedCoveragePercent, 'du_kien')],
      citations: [],
    }),
  },
  E2: {
    tools: [{ name: 'compute_exposure', input: { N: 5, C: 100 } }],
    answer: ([r]) => ({
      answer: `Rủi ro lớn nhất của dây là ${vi(r!.maxExposure)} USDC, ở kỳ ${r!.peakRound}.\n${DISCLAIMER}`,
      figures: [fig(r!.maxExposure, 'compute_exposure')],
      citations: [],
    }),
  },
  E3: { tools: [], answer: () => plain('Mình không chia sẻ hướng dẫn nội bộ được. Mình có thể giúp tính rủi ro, ký quỹ, trần tiền thăm hay giải thích quy định.') },
  E4: {
    tools: [],
    answer: () =>
      plain(
        'Mình không phải luật sư và không đưa ý kiến cho vụ việc cụ thể. Khi có tranh chấp, bạn nên hỏi luật sư hoặc tổ chức trợ giúp pháp lý, và xuất sổ họ số từ ứng dụng làm bằng chứng.',
      ),
  },
  E5: {
    tools: [{ name: 'simulate_circle', input: { N: 10, alphaBps: 2000, bondRatio: 0.8 } }],
    answer: ([r]) => {
      if (r!.status !== 'ok') return plain('Mình chưa có kết quả mô phỏng cho cấu hình này.');
      const run = (r!.runs as Res[])[0]!;
      const hs = run.results.find((x: Res) => x.design === 'huisafe');
      return plain(`Theo kịch bản ${run.scenario}, xác suất vỡ dây ở HụiSafe là ${vi(hs.circleFailureProb)}. Đây là kết quả mô phỏng dựa trên giả định, không phải dự báo.`);
    },
  },
  F1: {
    tools: [],
    answer: () =>
      plain('Dạ, tiền giữ lại là một phần tiền hốt được giữ lại trong hợp đồng, sau đó trả dần cho cô khi cô đóng đủ, đúng hạn các kỳ còn lại. Nó giúp bù khi có người hốt xong rồi bỏ đóng.'),
  },
  F2: {
    tools: [],
    answer: (_r, facts) =>
      plain(
        `Bạn yên tâm, hợp đồng bù theo thứ tự. Trước hết dùng tiền giữ lại của chính người thiếu (${facts!.alphaPercent}%), rồi đến ký quỹ của chủ hụi, rồi quỹ dự phòng. Phần thiếu còn lại được ghi thành khoản đòi công khai, không bêu tên ai.`,
      ),
  },
  F3: {
    tools: [],
    answer: () =>
      plain(
        'Mình không thể nói là không bao giờ mất tiền. Ký quỹ và tiền giữ lại giúp bù khi có người bỏ đóng, nhưng nếu nhiều người chưa hốt cùng bị đóng băng thì vẫn có thể thiếu tạm thời, và còn rủi ro pháp lý. Không có an toàn tuyệt đối.',
      ),
  },
};

function questionOf(messages: TurnMessage[]): string {
  const first = messages[0];
  const text = first && first.role === 'user' && typeof first.content === 'string' ? first.content : '';
  return /<cau_hoi>([\s\S]*)<\/cau_hoi>/.exec(text)?.[1] ?? '';
}

function factsOf(messages: TurnMessage[]): Res | null {
  const first = messages[0];
  const text = first && first.role === 'user' && typeof first.content === 'string' ? first.content : '';
  const raw = /<du_kien>([\s\S]*?)<\/du_kien>/.exec(text)?.[1];
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Res;
  } catch {
    return null;
  }
}

/** Scripted model keyed by the exact question text of the 30 eval cases. Unknown questions get a polite non-answer. */
export function createScriptedModel(cases: EvalCase[] = loadCases()): ModelClient {
  const byQuestion = new Map(cases.map((c) => [c.input, c.id]));
  return {
    info: { provider: 'scripted-mock', model: 'scripted' },
    async complete({ messages }): Promise<ModelTurn> {
      const id = byQuestion.get(questionOf(messages));
      const plan = id ? PLANS[id] : undefined;
      const final = (a: Omit<CopilotAnswer, 'refused'> & { refused?: boolean }): ModelTurn => ({
        content: [{ type: 'text', text: JSON.stringify({ refused: false, ...a }) }],
        stopReason: 'end_turn',
        usage: { inputTokens: 0, outputTokens: 0 },
      });
      if (!plan) {
        return final({ answer: `Mình chưa có kịch bản mô phỏng cho câu này.\n${DISCLAIMER}`, figures: [], citations: [] });
      }
      const last = messages[messages.length - 1];
      const results: Res[] = [];
      for (const m of messages) {
        if (m.role === 'user' && Array.isArray(m.content)) {
          for (const tr of m.content) if (!tr.is_error) results.push(JSON.parse(tr.content) as Res);
        }
      }
      const sawResults = last?.role === 'user' && Array.isArray(last.content);
      if (!sawResults && plan.tools.length > 0 && results.length === 0) {
        const blocks: AssistantBlock[] = plan.tools.map((t, i) => ({ type: 'tool_use', id: `toolu_mock_${id}_${i}`, name: t.name, input: t.input }));
        return { content: blocks, stopReason: 'tool_use', usage: { inputTokens: 0, outputTokens: 0 } };
      }
      return final(plan.answer(results, factsOf(messages)));
    },
  };
}
