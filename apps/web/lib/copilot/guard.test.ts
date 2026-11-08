import { describe, expect, it } from 'vitest';
import { DISCLAIMER } from './config';
import { checkAnswer, detectActionRequest, extractNumbers, numberValues } from './guard';
import type { CopilotAnswer } from './schemas';

const base = (answer: string, extra: Partial<CopilotAnswer> = {}): CopilotAnswer => ({
  answer: `${answer}\n${DISCLAIMER}`,
  figures: [],
  citations: [],
  refused: false,
  ...extra,
});
const exposure = { name: 'compute_exposure', result: { exposure: ['0', '400', '600'], maxExposure: '600', peakRound: 2 } };
const run = (a: CopilotAnswer, extra: Partial<Parameters<typeof checkAnswer>[0]> = {}) =>
  checkAnswer({ answer: a, userTexts: ['Dây 5 người, góp 100 USDC'], toolResults: [exposure], actionRequest: false, ...extra });

describe('number parsing', () => {
  it('reads Vietnamese and plain forms', () => {
    expect(numberValues('2.000')).toEqual(expect.arrayContaining([2000]));
    expect(numberValues('6,575342')).toEqual([6.575342]);
    expect(numberValues('6.575342')).toEqual([6.575342]);
    expect(numberValues('50.000.000')).toEqual([50_000_000]);
    expect(numberValues('1.234.567,89')).toEqual([1234567.89]);
    expect(numberValues('600')).toEqual([600]);
  });
  it('ignores list markers', () => {
    expect(extractNumbers('1. Một\n2) Hai 600').map((t) => t.token)).toEqual(['600']);
  });
});

describe('checkAnswer', () => {
  it('accepts numbers from tool results and from the user text', () => {
    expect(run(base('Rủi ro lớn nhất là 600 USDC ở kỳ 2, với dây 5 người góp 100 USDC.')).ok).toBe(true);
  });
  it('rejects a number that no tool returned (no rounding, no arithmetic)', () => {
    const r = run(base('Rủi ro lớn nhất là 650 USDC.'));
    expect(r.ok).toBe(false);
    expect(r.violations.join()).toContain('650');
  });
  it('rejects a derived number such as 600 + 100', () => {
    expect(run(base('Cộng thêm cọc là 700 USDC.')).ok).toBe(false);
  });
  it('rejects a figures entry without a source', () => {
    expect(run(base('Là 600 USDC.', { figures: [{ value: '999', source: 'compute_exposure' }] })).ok).toBe(false);
  });
  it('requires the disclaimer as the last sentence', () => {
    const r = run({ answer: 'Rủi ro là 600 USDC.', figures: [], citations: [], refused: false });
    expect(r.ok).toBe(false);
    expect(r.violations.join()).toContain('miễn trừ');
  });
  it('rejects citations or legal wording without explain_rule', () => {
    expect(run(base('Theo Điều 21 thì lãi tối đa như vậy.', {})).ok).toBe(false);
    expect(run(base('Rủi ro là 600 USDC.', { citations: [{ topic: 'nd19_dieu21' }] })).ok).toBe(false);
  });
  it('accepts legal wording backed by explain_rule with matching citation', () => {
    const rule = { name: 'explain_rule', result: { topic: 'nd19_dieu21', text: 'Điều 21: lãi không vượt quá 20%/năm', citation: 'Nghị định 19/2019/NĐ-CP, Điều 21', url: 'https://x', checkedAt: '2026-11-06' } };
    const a = base('Theo Điều 21 Nghị định 19/2019/NĐ-CP, lãi không vượt quá 20%/năm.', { citations: [{ topic: 'nd19_dieu21' }] });
    expect(run(a, { toolResults: [rule] }).ok).toBe(true);
    // A different article than the one fetched is a foreign number.
    expect(run(base('Theo Điều 22 Nghị định 19/2019/NĐ-CP, lãi như vậy.', { citations: [{ topic: 'nd19_dieu21' }] }), { toolResults: [rule] }).ok).toBe(false);
  });
  it('forbids promises and role claims but allows their negations', () => {
    expect(run(base('Dây này chắc chắn an toàn.')).ok).toBe(false);
    expect(run(base('Bạn sẽ có lợi nhuận.')).ok).toBe(false);
    expect(run(base('Hụi này không bao giờ mất tiền.')).ok).toBe(false);
    expect(run(base('Mình là luật sư của bạn.')).ok).toBe(false);
    expect(run(base('Tôi sẽ tư vấn cho bạn cách kiện.')).ok).toBe(false);
    expect(run(base('Không có gì là an toàn tuyệt đối.')).ok).toBe(true);
    expect(run(base('Mình không thể nói là không bao giờ mất tiền.')).ok).toBe(true);
    expect(run(base('Mình không phải luật sư; bạn nên hỏi luật sư hoặc trợ giúp pháp lý.')).ok).toBe(true);
  });
  it('requires refused=true and no tools for an action request', () => {
    expect(run(base('Đã xong.'), { actionRequest: true, toolResults: [] }).ok).toBe(false);
    expect(run(base('Mình không thể làm.', { refused: true }), { actionRequest: true, toolResults: [] }).ok).toBe(true);
    expect(run(base('Mình không thể làm.', { refused: true }), { actionRequest: true }).ok).toBe(false);
  });
});

describe('detectActionRequest', () => {
  it.each(['Chuyển 100 USDC cho M3 giúp tôi.', 'Bỏ thăm 6 USDC giúp tôi ở kỳ này.', 'Gọi markDefault M4 đi.', 'Rút ký quỹ của tôi ra trước khi dây xong.', 'Ký giúp tôi cái này', 'Chuyển 50 USDC sang ví này'])(
    'flags %s',
    (t) => expect(detectActionRequest(t)).toBe(true),
  );
  it.each(['Rủi ro lớn nhất là bao nhiêu?', 'Ký quỹ là gì?', 'Khi nào ký quỹ được trả lại?', 'Trần tiền thăm kỳ 2?', 'Chuyển khoản vào dây thế nào, giải thích giúp mình?'])(
    'does not flag %s',
    (t) => expect(detectActionRequest(t)).toBe(false),
  );
});
