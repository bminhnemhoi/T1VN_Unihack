/**
 * Circle agreement text and its hash (ADR-27, docs/03 section 3.1 `termsHash`).
 *
 * `buildTermsText` is deterministic: the same parameters always give the same UTF-8 text, so the web can show the text a
 * member agrees to and the chain keeps only `keccak256(text)`. The text holds circle parameters, phi, alpha and the
 * fallback order of taking; it never holds a person's name or any personal data (CLAUDE.md hard rule 4).
 */
import { keccak256, toBytes, type Hex } from 'viem';

export const TERMS_VERSION = 'v1.2';

export interface TermsInput {
  mode: 'fixed' | 'bidding';
  memberCount: number;
  /** Contribution per round, USDC base units (6 decimals). */
  contribution: bigint;
  periodSeconds: number;
  alphaBps: number;
  commissionMode: boolean;
  /** Fixed fee (phi = 0) or per-pot ceiling (phi > 0), in bps of the pot. */
  feeBps: number;
  /** phi, in bps of the interest room. 0 = fixed fee. */
  commissionShareBps: number;
  reserveBps: number;
  capBps: number;
  graceSeconds: number;
}

function usdc(base: bigint): string {
  const whole = base / 1_000_000n;
  const frac = (base % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole.toString();
}

/** Percent with at most two decimals from basis points, e.g. 5000 -> "50", 250 -> "2.5". */
function pct(bps: number): string {
  const v = bps / 100;
  return Number.isInteger(v) ? v.toString() : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

/** Grace in hours when it is at least one hour, else in minutes or seconds (the demo uses 120 s). */
function graceText(seconds: number): string {
  if (seconds >= 3600) return `${Math.round(seconds / 3600)} giờ`;
  if (seconds >= 60) return `${Math.round(seconds / 60)} phút`;
  return `${seconds} giây`;
}

export function buildTermsText(t: TermsInput): string {
  const lines = [
    `Thỏa thuận dây hụi HụiSafe (${TERMS_VERSION})`,
    `1. Kiểu: ${t.mode === 'bidding' ? 'hụi có lãi, bỏ thăm kín' : 'hụi không lãi, hốt theo thứ tự vào dây'}.`,
    `2. Số phần: ${t.memberCount}. Mức góp mỗi kỳ: ${usdc(t.contribution)} USDC. Kỳ danh nghĩa: ${Math.round(t.periodSeconds / 86_400)} ngày.`,
    `3. Tiền giữ lại của người đã hốt: ${pct(t.alphaBps)}% mỗi phần còn phải góp; nhả dần mỗi kỳ đóng đúng hạn.`,
    t.commissionMode
      ? t.commissionShareBps > 0
        ? `4. Hoa hồng chủ hụi nằm trong trần lãi: ${pct(t.commissionShareBps)}% quỹ lãi tối đa của kỳ, không quá ${pct(t.feeBps)}% pot; thăm tối đa là ${pct(10_000 - t.commissionShareBps)}% trần luật. Kỳ chủ hụi tự hốt không thu hoa hồng.`
        : `4. Hoa hồng chủ hụi: ${pct(t.feeBps)}% pot mỗi kỳ. Kỳ chủ hụi tự hốt không thu hoa hồng.`
      : '4. Chủ hụi không thu hoa hồng.',
    `5. Quỹ dự phòng: ${pct(t.reserveBps)}% pot mỗi kỳ; cuối dây chia cho thành viên không vỡ nợ theo số kỳ đóng đúng hạn.`,
    `6. Trần lãi năm: ${pct(t.capBps)}% (Nghị định 19/2019/NĐ-CP, Điều 21). Ân hạn trả trễ: ${graceText(t.graceSeconds)}.`,
    '7. Thứ tự hốt dự phòng khi không ai bỏ thăm: thứ tự vào dây, công khai trên chuỗi.',
    '8. Chủ hụi không giữ tiền, nhưng ký quỹ bảo lãnh. Tham số trên không đổi sau khi dây bắt đầu.',
  ];
  return lines.join('\n');
}

/** `keccak256` of the UTF-8 text: the value stored in `CircleParams.termsHash`. */
export function termsHashOf(text: string): Hex {
  return keccak256(toBytes(text));
}
