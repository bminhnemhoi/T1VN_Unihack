/**
 * Circle agreement text and its hash (ADR-27, docs/03 section 3.1 `termsHash`).
 *
 * `buildTermsText` is deterministic: the same parameters always give the same UTF-8 text, so the web can show the text a
 * member agrees to and the chain keeps only `keccak256(text)`. The text states EVERY parameter a member relies on
 * (kind, N, C, nominal period, real round length, bid windows, grace, alpha, phi, fee ceiling, reserve share, reveal
 * bond, interest cap), the fallback order of taking and the on-time reserve split; it never holds a person's name or
 * any personal data (CLAUDE.md hard rule 4). `verifyTerms` rebuilds the text from the parameters read from the chain
 * and compares the hash, so a circle whose stored hash does not describe its own parameters is flagged (audit L-02).
 */
import { keccak256, toBytes, type Hex } from 'viem';

export const TERMS_VERSION = 'v1.3';

export interface TermsInput {
  mode: 'fixed' | 'bidding';
  memberCount: number;
  /** Contribution per round, USDC base units (6 decimals). */
  contribution: bigint;
  /** Nominal period P (interest cap, late fee), seconds. */
  periodSeconds: number;
  /** Real time between two rounds D_r, seconds (= P on a real circle, 180 in demo timing). */
  roundDuration: number;
  /** Sealed-bid window W_c, seconds; 0 for a `fixed` circle. */
  commitWindow: number;
  /** Reveal window W_r, seconds; 0 for a `fixed` circle. */
  revealWindow: number;
  graceSeconds: number;
  alphaBps: number;
  commissionMode: boolean;
  /** Fixed fee (phi = 0) or per-pot ceiling (phi > 0), in bps of the pot. */
  feeBps: number;
  /** phi, in bps of the interest room. 0 = fixed fee. */
  commissionShareBps: number;
  reserveBps: number;
  /** Reveal bond, bps of C. */
  revealBondBps: number;
  capBps: number;
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

/**
 * Whole days, hours or minutes when the value divides evenly, else seconds (the demo uses 90 s and 120 s). `hours`
 * keeps 48 hours as "48 giờ" (the wording of the grace period) instead of "2 ngày".
 */
function duration(seconds: number, hours = false): string {
  if (!hours && seconds >= 86_400 && seconds % 86_400 === 0) return `${seconds / 86_400} ngày`;
  if (seconds >= 3600 && seconds % 3600 === 0) return `${seconds / 3600} giờ`;
  if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60} phút`;
  return `${seconds} giây`;
}

export function buildTermsText(t: TermsInput): string {
  const bidding = t.mode === 'bidding';
  const lines = [
    `Thỏa thuận dây hụi HụiSafe (${TERMS_VERSION})`,
    `1. Kiểu: ${bidding ? 'hụi có lãi, bỏ thăm kín' : 'hụi không lãi, hốt theo thứ tự vào dây'}.`,
    `2. Số phần: ${t.memberCount}. Mức góp mỗi kỳ: ${usdc(t.contribution)} USDC.`,
    `3. Kỳ danh nghĩa (tính trần lãi và lãi chậm góp): ${duration(t.periodSeconds)}. Thời gian thật giữa hai kỳ: ${duration(t.roundDuration)}.`,
    bidding
      ? `4. Nộp thăm kín trong ${duration(t.commitWindow)} đầu của kỳ, mở thăm trong ${duration(t.revealWindow)} kế tiếp. Cọc mở thăm: ${pct(t.revealBondBps)}% mức góp mỗi lần nộp thăm, trả lại khi mở thăm; không mở thì cọc vào quỹ dự phòng và tính một lần trễ.`
      : '4. Không có bỏ thăm và không có cọc mở thăm.',
    `5. Tiền giữ lại của người đã hốt: ${pct(t.alphaBps)}% mỗi phần còn phải góp; nhả dần mỗi kỳ đóng đúng hạn.`,
    t.commissionMode
      ? t.commissionShareBps > 0
        ? `6. Hoa hồng chủ hụi nằm trong trần lãi: ${pct(t.commissionShareBps)}% quỹ lãi tối đa của kỳ, không quá ${pct(t.feeBps)}% pot; thăm tối đa là ${pct(10_000 - t.commissionShareBps)}% trần luật. Kỳ chủ hụi tự hốt không thu hoa hồng.`
        : `6. Hoa hồng chủ hụi: ${pct(t.feeBps)}% pot mỗi kỳ. Kỳ chủ hụi tự hốt không thu hoa hồng.`
      : '6. Chủ hụi không thu hoa hồng.',
    `7. Quỹ dự phòng: ${pct(t.reserveBps)}% pot mỗi kỳ. Cuối dây chia theo số kỳ đóng đúng hạn: trọng số của mỗi thành viên là số phần còn lại sau khi trừ số lần trễ (tối đa ${t.memberCount - 1}, thấp nhất 0); người vỡ nợ nhận 0; phần dư lẻ cho người vào dây sớm nhất có trọng số lớn hơn 0; nếu mọi trọng số bằng 0 thì chia đều cho người không vỡ nợ.`,
    `8. Trần lãi năm: ${pct(t.capBps)}% (Nghị định 19/2019/NĐ-CP, Điều 21). Ân hạn trả trễ: ${duration(t.graceSeconds, true)}.`,
    bidding
      ? '9. Thứ tự hốt dự phòng khi không ai bỏ thăm: thứ tự vào dây, công khai trên chuỗi.'
      : '9. Thứ tự hốt: thứ tự vào dây, công khai trên chuỗi; người bị đóng băng bị đẩy xuống cuối hàng.',
    '10. Chủ hụi không giữ tiền, nhưng ký quỹ bảo lãnh. Tham số trên không đổi sau khi dây bắt đầu.',
  ];
  return lines.join('\n');
}

/** `keccak256` of the UTF-8 text: the value stored in `CircleParams.termsHash`. */
export function termsHashOf(text: string): Hex {
  return keccak256(toBytes(text));
}

export interface TermsCheck {
  /** True when the hash stored on the circle is the hash of the standard text of its own parameters. */
  match: boolean;
  expected: Hex;
  actual: Hex;
  /** The standard text the hash should describe; show it to the member. */
  text: string;
}

/**
 * Rebuilds the standard text from circle parameters and compares its hash with the circle's `termsHash`. A mismatch
 * means the creator hashed some other document (or a different version of this text): warn before joining.
 */
export function verifyTerms(params: TermsInput & { termsHash: Hex }): TermsCheck {
  const text = buildTermsText(params);
  const expected = termsHashOf(text);
  return { match: expected.toLowerCase() === params.termsHash.toLowerCase(), expected, actual: params.termsHash, text };
}

/** Terms input from the SDK view (`readCircle`); `termsHash` is present only when `readCircle` produced the view. */
export function termsInputOfView(view: {
  mode: 'fixed' | 'bidding';
  params: {
    N: number;
    C: bigint;
    periodSeconds: number;
    roundDuration: number;
    commitWindow: number;
    revealWindow: number;
    graceSeconds: number;
    alphaBps: number;
    commissionMode: boolean;
    feeBps: number;
    commissionShareBps?: number;
    reserveBps: number;
    revealBondBps: number;
    capBps: number;
    termsHash?: Hex;
  };
}): TermsInput & { termsHash?: Hex } {
  const p = view.params;
  return {
    mode: view.mode,
    memberCount: p.N,
    contribution: p.C,
    periodSeconds: p.periodSeconds,
    roundDuration: p.roundDuration,
    commitWindow: p.commitWindow,
    revealWindow: p.revealWindow,
    graceSeconds: p.graceSeconds,
    alphaBps: p.alphaBps,
    commissionMode: p.commissionMode,
    feeBps: p.feeBps,
    commissionShareBps: p.commissionShareBps ?? 0,
    reserveBps: p.reserveBps,
    revealBondBps: p.revealBondBps,
    capBps: p.capBps,
    termsHash: p.termsHash,
  };
}

/**
 * The demo circle of `script/CreateDemoCircle.s.sol` (docs/03 section 8 scaled to C = 10 USDC, demo timing). The script
 * hashes exactly `buildTermsText(DEMO_TERMS_INPUT)`; `contracts/test/vectors/terms.json` pins text and hash for the
 * TypeScript test and for the Foundry test that compares them with the script's constant.
 */
export const DEMO_TERMS_INPUT: TermsInput = {
  mode: 'bidding',
  memberCount: 5,
  contribution: 10_000_000n,
  periodSeconds: 30 * 86_400,
  roundDuration: 180,
  commitWindow: 90,
  revealWindow: 60,
  graceSeconds: 120,
  alphaBps: 2000,
  commissionMode: true,
  feeBps: 100,
  commissionShareBps: 0,
  reserveBps: 100,
  revealBondBps: 100,
  capBps: 2000,
};
