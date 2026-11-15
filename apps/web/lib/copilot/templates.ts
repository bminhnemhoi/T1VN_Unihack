/**
 * Deterministic wording: the calculator-mode answer (docs/07 section 8 item 2) and canned refusals.
 * Every number comes from tool results, so these pass the same guard as model answers.
 */
import { DISCLAIMER } from './config';
import type { CopilotAnswer, RuleTopic } from './schemas';

type ToolResult = { name: string; result: unknown };

interface SimRunLike {
  scenario: string;
  results: { design: string; lateReceiverExpectedLossPct: number | null; circleFailureProb: number | null }[];
}

const DESIGN_NAME: Record<string, string> = {
  traditional: 'hụi truyền thống',
  naive_onchain: 'hụi on-chain đơn giản',
  huisafe: 'HụiSafe',
};

function describe(r: ToolResult): { line: string; figures: string[]; topic?: string } | null {
  const x = r.result as Record<string, unknown> | null;
  if (!x) return null;
  switch (r.name) {
    case 'compute_exposure': {
      const list = (x.exposure as string[]).join(', ');
      return {
        line: `Rủi ro lớn nhất (tiền chưa đóng) là ${x.maxExposure}, ở kỳ ${x.peakRound}. Theo kỳ từ 0 đến hết: ${list}.`,
        figures: [x.maxExposure as string],
      };
    }
    case 'recommend_bond':
      return {
        line: `Rủi ro lớn nhất là ${x.maxExposure}. Ký quỹ cần là ${x.bond}, cho chỉ số bảo chứng ${x.guaranteedCoveragePercent}%.`,
        figures: [x.bond as string, x.maxExposure as string],
      };
    case 'max_bid_table': {
      const rows = (x.rows as { k: number; maxBid: string }[]).map((r2) => `kỳ ${r2.k}: ${r2.maxBid}`).join('; ');
      return { line: `Trần tiền thăm (cách hiểu của HụiSafe, cần luật sư xác nhận): ${rows}.`, figures: [] };
    }
    case 'simulate_circle': {
      if (x.status !== 'ok') return { line: 'Chưa có kết quả mô phỏng cho cấu hình này.', figures: [] };
      const runs = x.runs as SimRunLike[];
      const parts = runs.flatMap((run) =>
        run.results.map(
          (d) =>
            `${DESIGN_NAME[d.design] ?? d.design} (kịch bản ${run.scenario}): người hốt sau mất trung bình ${d.lateReceiverExpectedLossPct}% số tiền, xác suất vỡ dây ${d.circleFailureProb}`,
        ),
      );
      return { line: `Kết quả mô phỏng (giả định, không phải dự báo): ${parts.join('; ')}.`, figures: [] };
    }
    case 'explain_rule':
      return { line: `${x.text} (${x.citation}; kiểm ngày ${x.checkedAt}).`, figures: [], topic: x.topic as string };
    case 'draft_ubnd_notice':
      return {
        line: `Đã soạn nháp thông báo gửi UBND cấp xã. Bạn tự điền các ô ${(x.placeholders as string[]).join(', ')} trên máy của bạn.`,
        figures: [],
      };
    default:
      return null;
  }
}

/** Calculator mode: plain statements of what the tools returned, then the disclaimer. */
export function calculatorAnswer(results: ToolResult[]): CopilotAnswer {
  const parts = results.map(describe).filter((p): p is NonNullable<ReturnType<typeof describe>> => p !== null);
  const body = parts.length > 0 ? parts.map((p) => p.line).join('\n') : 'Mình chưa có kết quả tính nào cho câu hỏi này. Bạn thử chọn một mục trong chế độ máy tính.';
  return {
    answer: `${body}\n${DISCLAIMER}`,
    figures: parts.flatMap((p) => p.figures).map((value) => ({ value, source: 'tool' })),
    citations: parts.flatMap((p) => (p.topic ? [{ topic: p.topic as RuleTopic }] : [])),
    refused: false,
  };
}

export function refusalAnswer(kind: 'action' | 'model'): CopilotAnswer {
  if (kind === 'action') {
    return {
      answer:
        'Mình không thể chuyển tiền, bỏ thăm, ký hay gọi hàm smart contract thay bạn. Bạn hãy bấm nút tương ứng trong ứng dụng. Mình có thể giúp tính rủi ro, ký quỹ, trần thăm hoặc giải thích quy tắc.\n' +
        DISCLAIMER,
      figures: [],
      citations: [],
      refused: true,
    };
  }
  return {
    answer: `Mình chưa trả lời được câu này. Bạn thử hỏi lại theo cách khác, hoặc dùng chế độ máy tính.\n${DISCLAIMER}`,
    figures: [],
    citations: [],
    refused: false,
  };
}
