/**
 * Contract custom errors decoded into stable codes and plain Vietnamese sentences (docs/05 sections 4.2 and 8.2,
 * docs/02 section 8 wording rules). The relay returns `{ code, message }`; the UI never shows raw hex.
 */
import { decodeErrorResult, type Abi } from 'viem';
import { erc2771ForwarderAbi, huiCircleAbi, huiFactoryAbi, mockUsdcAbi } from './generated';
import { formatUsdc } from './format';

type Hex = `0x${string}`;

export interface DecodedError {
  /** The Solidity error name, e.g. `BidTooHigh`; `Unknown` when the selector is not in any ABI. */
  code: string;
  /** Vietnamese sentence for the user. */
  message: string;
  args: readonly unknown[];
}

const ABIS: readonly Abi[] = [huiCircleAbi, huiFactoryAbi, erc2771ForwarderAbi, mockUsdcAbi];

const usdc = (v: unknown): string => (typeof v === 'bigint' ? formatUsdc(v) : '?');

type Describe = (args: readonly unknown[]) => string;

const MESSAGES: Record<string, string | Describe> = {
  NotFactory: 'Chỉ nhà máy tạo dây mới gọi được thao tác này.',
  NotOrganizer: 'Chỉ chủ hụi mới làm được việc này.',
  NotAdmin: 'Chỉ quản trị mới làm được việc này.',
  NotMember: 'Ví này chưa là thành viên của dây.',
  AlreadyMember: 'Ví này đã ở trong dây.',
  AlreadyLeft: 'Ví này đã rời dây này, không vào lại được.',
  WrongState: 'Dây đang ở trạng thái không cho phép thao tác này.',
  InvalidParams: (a) => `Thông số dây không hợp lệ (mã ${String(a[0])}).`,
  CircleFull: 'Dây đã đủ người.',
  CircleNotFull: 'Dây chưa đủ người để kích hoạt.',
  JoinClosed: 'Đã hết hạn vào dây.',
  BadAttestation: 'Xác nhận danh tính không hợp lệ. Hãy xin xác nhận mới.',
  AttestationUsed: 'Xác nhận danh tính này đã được dùng.',
  AttestationExpired: 'Xác nhận danh tính đã hết hạn. Hãy xin xác nhận mới.',
  InsufficientAllowance: (a) =>
    `Chưa cho phép trích đủ tiền: cần ${usdc(a[0])}, đang cho phép ${usdc(a[1])}.`,
  CoverageTooLow: 'Chỉ số bảo chứng chưa đủ mức tối thiểu. Chủ hụi cần nạp thêm ký quỹ.',
  NotInCommitWindow: 'Chưa hoặc không còn trong thời gian nộp thăm kín.',
  NotInRevealWindow: 'Chưa hoặc không còn trong thời gian mở thăm.',
  NotEligibleToBid: 'Bạn chưa đủ điều kiện bỏ thăm kỳ này.',
  NoCommit: 'Bạn chưa nộp thăm kín ở kỳ này.',
  CommitMismatch: 'Số tiền thăm hoặc mã bí mật không khớp với thăm đã nộp.',
  AlreadyRevealed: 'Bạn đã mở thăm kỳ này rồi.',
  BidTooHigh: (a) => `Tiền thăm vượt trần của kỳ này (tối đa ${usdc(a[1])}).`,
  TooEarly: 'Chưa đến thời điểm được làm việc này.',
  RoundAlreadySettled: 'Kỳ này đã được chốt.',
  PreviousRoundNotSettled: 'Kỳ trước chưa được chốt.',
  NoShortfall: 'Không có khoản thiếu nào cần xử lý.',
  GraceExpired: 'Đã quá ân hạn, không trả trễ được nữa.',
  GraceNotOver: 'Chưa hết ân hạn.',
  AlreadyDefaulted: 'Người này đã bị đánh dấu vỡ nợ.',
  NothingToClaim: 'Không có khoản nào để nhận.',
  NothingToWithdraw: 'Không còn ký quỹ để rút.',
  RepayTooLarge: 'Số tiền trả vượt quá khoản còn nợ.',
  CircleIsPaused: 'Dây đang tạm dừng, chỉ nhận tiền được.',
  UnwindTooEarly: 'Chưa đủ 48 giờ tạm dừng liên tục.',
  NotCircle: 'Địa chỉ này không phải một dây của HụiSafe.',
  NotActivated: 'Dây chưa được kích hoạt.',
  AlreadyActivated: 'Dây đã được kích hoạt.',
  InvalidConfig: 'Cấu hình không hợp lệ.',
  ZeroAddress: 'Thiếu địa chỉ bắt buộc.',
  ERC2771ForwarderInvalidSigner: 'Chữ ký yêu cầu không đúng người gửi.',
  ERC2771ForwarderMismatchedValue: 'Yêu cầu có giá trị chuyển không hợp lệ.',
  ERC2771ForwarderExpiredRequest: 'Yêu cầu đã hết hạn. Hãy thử lại.',
  ERC2771UntrustfulTarget: 'Địa chỉ đích không tin cậy yêu cầu này.',
  ERC20InsufficientBalance: (a) => `Số dư USDC không đủ (đang có ${usdc(a[1])}, cần ${usdc(a[2])}).`,
  ERC20InsufficientAllowance: (a) =>
    `Chưa cho phép trích đủ tiền: đang cho phép ${usdc(a[1])}, cần ${usdc(a[2])}.`,
  ERC2612ExpiredSignature: 'Chữ ký cho phép trích tiền đã hết hạn. Hãy ký lại.',
  ERC2612InvalidSigner: 'Chữ ký cho phép trích tiền không đúng người.',
  InvalidAccountNonce: 'Chữ ký đã được dùng hoặc lỗi thứ tự. Hãy ký lại.',
  Blacklisted: 'Ví này bị chặn chuyển USDC.',
  ReentrancyGuardReentrantCall: 'Giao dịch bị từ chối vì gọi lồng nhau.',
  LensNotDeployed: 'Hệ thống triển khai chưa đầy đủ.',
};

const FALLBACK = 'Giao dịch bị từ chối. Hãy thử lại hoặc báo cho chủ hụi.';

/** Decode raw revert data (`0x` + selector + args) into a code and a Vietnamese message. */
export function decodeContractError(data: Hex): DecodedError {
  for (const abi of ABIS) {
    try {
      const decoded = decodeErrorResult({ abi, data });
      const args = decoded.args ?? [];
      const entry = MESSAGES[decoded.errorName];
      const message = typeof entry === 'function' ? entry(args) : (entry ?? FALLBACK);
      return { code: decoded.errorName, message, args };
    } catch {
      // selector not in this ABI; try the next one
    }
  }
  return { code: 'Unknown', message: FALLBACK, args: [] };
}

/** Walk a viem error chain for revert data. Returns undefined when the failure was not a revert with data. */
export function extractRevertData(err: unknown): Hex | undefined {
  let cur: unknown = err;
  for (let depth = 0; depth < 8 && cur && typeof cur === 'object'; depth++) {
    const o = cur as { data?: unknown; raw?: unknown; cause?: unknown };
    for (const candidate of [o.data, o.raw]) {
      if (typeof candidate === 'string' && /^0x[0-9a-fA-F]{8,}$/.test(candidate)) return candidate as Hex;
      if (candidate && typeof candidate === 'object') {
        const inner = (candidate as { data?: unknown }).data;
        if (typeof inner === 'string' && /^0x[0-9a-fA-F]{8,}$/.test(inner)) return inner as Hex;
      }
    }
    cur = o.cause;
  }
  return undefined;
}

/** Decode a thrown viem error; `Unknown` when it carries no revert data. */
export function decodeError(err: unknown): DecodedError {
  const data = extractRevertData(err);
  return data ? decodeContractError(data) : { code: 'Unknown', message: FALLBACK, args: [] };
}
