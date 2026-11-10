/**
 * Who may seal or open a bid, mirroring `HuiCircle._requireEligible` and the `liveCount` check in `commitBid`
 * (docs/03 section 6.1). Pure, so the room can lock the button with a reason before the chain answers `NotEligibleToBid`.
 */
import type { CircleView } from 'sdk';

type Address = `0x${string}`;

export const REASON = {
  paused: 'Dây đang tạm dừng nên chưa nộp hay mở thăm được. Dây mở lại thì bạn quay lại.',
  login: 'Hãy đăng nhập để nộp thăm.',
  notMember: 'Bạn chưa ở trong dây này nên không bỏ thăm được.',
  notLive: 'Bạn đã hốt hoặc đang bị đóng băng nên không bỏ thăm kỳ này.',
  owes: 'Bạn còn khoản góp chưa trả của kỳ trước nên chưa nộp thăm được. Trả khoản đó trước, rồi quay lại nộp thăm.',
  soleLive: 'Bạn là người duy nhất còn chưa hốt, nên kỳ này bạn hốt với thăm 0. Không cần nộp thăm.',
} as const;

/** Reason `commitBid` or `revealBid` would revert for this wallet, or undefined when eligible. */
export function eligibilityBlocker(view: CircleView, viewer: Address | undefined): string | undefined {
  if (view.state === 'paused') return REASON.paused;
  if (!viewer) return REASON.login;
  const member = view.members.find((m) => m.address.toLowerCase() === viewer.toLowerCase());
  if (!member) return REASON.notMember;
  if (member.status !== 'live') return REASON.notLive;
  if (member.debt > 0n) return REASON.owes;
  return undefined;
}

/**
 * Reason `commitBid` would revert. Adds the "last live member" rule, which only the commit checks: a reveal of a
 * commit made while two members were still live stays allowed, so reveal uses `eligibilityBlocker` alone.
 */
export function commitBlocker(view: CircleView, viewer: Address | undefined): string | undefined {
  const base = eligibilityBlocker(view, viewer);
  if (base) return base;
  return view.members.filter((m) => m.status === 'live').length <= 1 ? REASON.soleLive : undefined;
}
