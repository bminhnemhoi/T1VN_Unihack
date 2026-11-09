import { formatBps, formatUsdc } from 'sdk';
import { keccak256, toHex } from 'viem';
import { capOf } from '@/lib/hui-calc';
import type { SampleCircleData } from '@/lib/sample-circles';

/** Plain-language agreement of a circle, built from its parameters so the text and the contract can never disagree. */
export function agreementClauses(c: SampleCircleData): string[] {
  const t = c.terms;
  const fixed = t.mode === 'fixed';
  return [
    `Dây "${c.label}" có ${t.n} phần, mỗi thành viên giữ một phần. Chủ hụi (${c.organizerAddr}) tổ chức dây nhưng không cầm tiền góp của ai.`,
    `Mỗi kỳ (${t.periodDays} ngày) mỗi phần góp ${formatUsdc(t.c)}. Tiền chỉ được trích từ ví của chính thành viên, đúng phần góp của kỳ đó, và chi cho người hốt ngay trong cùng giao dịch.`,
    fixed
      ? 'Kiểu cố định: người hốt từng kỳ theo thứ tự vào dây, đã ghi công khai. Không bỏ thăm, không bốc thăm ngẫu nhiên.'
      : `Kiểu bỏ thăm: mỗi kỳ người cần tiền nộp thăm kín. Thăm cao nhất hốt; bằng nhau thì người ít lần trễ hơn thắng; vẫn bằng thì ai nộp trước thắng. Thăm không vượt trần lãi 20%/năm (kỳ 1 tối đa ${formatUsdc(capOf(t, 1))}). Không có may rủi.`,
    `Người đã hốt bị giữ lại ${formatBps(t.alphaBps)} tiền hốt còn lại phải góp, nhả dần sau mỗi kỳ đóng đủ, đúng hạn. Đóng đủ thì nhận lại hết.`,
    `Chủ hụi khóa ký quỹ ${formatUsdc(c.bond)} để bù khi người đã hốt bỏ đóng. Hết dây chủ hụi lấy lại phần chưa dùng.`,
    `Tiền công chủ hụi ${formatBps(t.feeBps)} mỗi kỳ, chỉ trả cho kỳ không có người vỡ nợ. Quỹ dự phòng ${formatBps(t.reserveBps)} mỗi kỳ, cuối dây chia lại cho người không vỡ nợ.`,
    'Góp trễ có ân hạn 48 giờ, kèm lãi chậm góp 10%/năm (Nghị định 19/2019/NĐ-CP, Điều 22 khoản 1). Quá ân hạn thì bị đánh dấu vỡ nợ; phần thiếu được bù lần lượt từ tiền giữ lại của người đó, ký quỹ, quỹ dự phòng.',
    'Thành viên rời dây được trước khi dây bắt đầu, rời rồi thì không vào lại dây này. Thông tin cá nhân không đưa lên mạng, chỉ có địa chỉ ví.',
    'Văn bản này là bản tham khảo của HụiSafe, cần luật sư xác nhận trước khi dùng cho dây thật.',
  ];
}

export const agreementText = (c: SampleCircleData): string => agreementClauses(c).map((x, i) => `${i + 1}. ${x}`).join('\n');

/** keccak256 of the exact text shown: this is the value that will be written on the network when a real circle is created. */
export const agreementHash = (c: SampleCircleData): string => keccak256(toHex(agreementText(c)));
