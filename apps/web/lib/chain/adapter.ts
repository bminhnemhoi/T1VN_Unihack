/**
 * Maps the chain `CircleView` (packages/sdk) to the shapes the current screens use in `lib/sample.ts`
 * (`SampleCircle`, `SampleMember`, `LedgerRound`), so the UI can swap the sample import for the hook and call the
 * adapter. Pure and read-only. The product shows USDC only: nothing here converts to VND.
 */
import { formatUsdc, type CircleView, type MemberView } from 'sdk';
import type { LedgerCell, LedgerRound, SampleCircle, SampleMember } from '../sample';

type Address = `0x${string}`;

/** Display name of a wallet; the owner's nicknames live in the browser (docs/05 section 13). */
export type NameOf = (address: Address, joinIndex: number) => string;

export const defaultName: NameOf = (_a, i) => `Thành viên ${i + 1}`;

const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

const nameFor = (m: MemberView, names: NameOf): string => names(m.address, m.joinIndex);

/** `SampleMember[]` plus the viewer's index (`VIEWER` in the sample file; -1 when the viewer is not a member). */
export function toSampleMembers(
  v: CircleView,
  viewer?: Address,
  names: NameOf = defaultName,
): { members: SampleMember[]; viewer: number } {
  const sorted = [...v.members].sort((a, b) => a.joinIndex - b.joinIndex);
  const members = sorted.map(
    (m): SampleMember => ({
      name: nameFor(m, names),
      status: m.status,
      receivedRound: m.receivedRound,
      holdback: m.holdback,
      note: m.debt > 0n ? `Còn nợ ${formatUsdc(m.debt)}` : undefined,
    }),
  );
  return { members, viewer: viewer ? sorted.findIndex((m) => same(m.address, viewer)) : -1 };
}

/** `LedgerRound[]` of the circle: one row per round, one cell per member (joinIndex order). */
export function toLedger(v: CircleView): LedgerRound[] {
  const sorted = [...v.members].sort((a, b) => a.joinIndex - b.joinIndex);
  const C = v.params.C;
  return v.rounds.map((r): LedgerRound => {
    if (r.phase !== 'done' || r.winner === undefined) {
      const running = v.state === 'active' && r.k === v.currentRound;
      return { k: r.k, state: running ? 'running' : 'later' };
    }
    const bid = r.bid ?? 0n;
    const cells = sorted.map((m): LedgerCell => {
      if (same(m.address, r.winner!)) return { kind: 'won' };
      const sf = r.shortfalls.find((s) => same(s.member, m.address));
      if (sf) {
        const cv = sf.covered ?? { holdback: sf.fromHoldback, bond: sf.fromBond, reserve: sf.fromReserve };
        return { kind: 'short', amount: sf.amount, fromHoldback: cv.holdback, fromBond: cv.bond, fromReserve: cv.reserve };
      }
      const alreadyReceived = m.receivedRound !== undefined && m.receivedRound < r.k;
      return { kind: 'paid', amount: alreadyReceived ? C : C - bid };
    });
    return {
      k: r.k,
      state: 'settled',
      winner: sorted.findIndex((m) => same(m.address, r.winner!)),
      bid,
      payout: r.payout,
      cells,
    };
  });
}

/** Chain state -> list state. A cancelled or unwound circle is NOT "completed": it never paid out (audit by Towfienes 15/11). */
export const STATE_MAP = { forming: 'forming', active: 'active', paused: 'active', completed: 'completed', cancelled: 'cancelled', unwound: 'unwound' } as const;

function nextStep(v: CircleView, isOrganizer: boolean, mine?: MemberView): { todo: string; action: string; secondsLeft: (now: number) => number } {
  const k = v.currentRound;
  const round = v.rounds.find((r) => r.k === k);
  if (v.state === 'forming') {
    return {
      todo: isOrganizer ? `Chờ đủ người (${v.members.length} trên ${v.params.N}), rồi bấm bắt đầu dây` : 'Chờ đủ người vào dây',
      action: isOrganizer ? 'Mời thêm người' : 'Xem dây',
      secondsLeft: (now) => Math.max(0, v.params.joinDeadline - now),
    };
  }
  if (v.state === 'active' || v.state === 'paused') {
    if (v.state === 'paused') return { todo: 'Dây đang tạm dừng', action: 'Xem dây', secondsLeft: () => 0 };
    if (v.settledRounds >= v.params.N) {
      return { todo: 'Đã chi đủ các kỳ · Chờ tự động tất toán', action: 'Xem tất toán', secondsLeft: () => 0 };
    }
    const phase = round?.phase ?? 'not-started';
    const until = phase === 'commit' ? round!.commitEndsAt : phase === 'reveal' ? round!.revealEndsAt : (round?.deadline ?? 0);
    if (isOrganizer && !mine) {
      const todo = phase === 'awaiting-settle' ? `Đang tự động khui kỳ ${k}` : `Giám sát kỳ ${k} đang chạy`;
      return { todo, action: 'Xem bàn hụi', secondsLeft: (now) => Math.max(0, until - now) };
    }
    if (mine && mine.status !== 'live') {
      const todo = mine.receivedRound
        ? `Đã hốt kỳ ${mine.receivedRound} · Kỳ ${k} tự động trích góp`
        : `Đang đóng băng · Theo dõi kỳ ${k}`;
      return { todo, action: 'Xem dây', secondsLeft: (now) => Math.max(0, until - now) };
    }
    if (v.mode === 'bidding') {
      const liveCount = v.members.filter((m) => m.status === 'live').length;
      if (liveCount <= 1) {
        return {
          todo: `Kỳ cuối · Hốt trọn không cần bỏ thăm`,
          action: 'Vào phòng hụi',
          secondsLeft: (now) => Math.max(0, (round?.deadline ?? until) - now),
        };
      }
    }
    if (v.mode === 'fixed') {
      return {
        todo: `Kỳ ${k} đang chạy theo thứ tự cố định`,
        action: 'Xem dây',
        secondsLeft: (now) => Math.max(0, (round?.deadline ?? until) - now),
      };
    }
    const myCommit = mine ? round?.commits?.find((c) => same(c.member, mine.address)) : undefined;
    const todo =
      phase === 'commit'
        ? myCommit
          ? `Đã niêm phong kỳ ${k} · Chờ tới giờ mở thăm`
          : `Nộp thăm kín cho kỳ ${k}`
        : phase === 'reveal'
          ? myCommit && !myCommit.revealed
            ? `Mở thăm kỳ ${k} ngay để không mất cọc`
            : myCommit?.revealed
              ? `Đã mở thăm kỳ ${k} · Chờ tự động khui`
              : `Mở thăm kỳ ${k}`
          : phase === 'awaiting-settle'
            ? `Đang tự động khui kỳ ${k}`
            : `Chờ kỳ ${k} bắt đầu`;
    return { todo, action: 'Vào phòng thăm', secondsLeft: (now) => Math.max(0, until - now) };
  }
  if (v.state === 'cancelled') {
    return {
      todo: isOrganizer && v.bondRemaining > 0n ? 'Dây đã hủy vì không đủ người trước hạn. Rút ký quỹ về ví' : 'Dây đã hủy vì không đủ người trước hạn',
      action: isOrganizer && v.bondRemaining > 0n ? 'Rút ký quỹ' : 'Xem dây',
      secondsLeft: () => 0,
    };
  }
  if (v.state === 'unwound') return { todo: 'Dây đã dừng khẩn cấp, tiền trả theo sổ', action: 'Xem dây', secondsLeft: () => 0 };
  return { todo: 'Đã xong. Xem sổ hụi hoặc nhận lại phần còn lại', action: 'Xem lại dây', secondsLeft: () => 0 };
}

/** `SampleCircle` for the home / "Dây của tôi" lists. `href` points to `/circles/<address>`. */
export function toSampleCircle(v: CircleView, viewer?: Address, nowSec: number = Math.floor(Date.now() / 1000), names: NameOf = defaultName): SampleCircle {
  const isOrganizer = viewer !== undefined && same(v.organizer, viewer);
  const sorted = [...v.members].sort((a, b) => a.joinIndex - b.joinIndex);
  const mine = viewer ? sorted.find((m) => same(m.address, viewer)) : undefined;
  const step = nextStep(v, isOrganizer, mine);
  const settledRounds = v.rounds.filter((r) => r.phase === 'done' && r.winner);
  const winners = settledRounds.map((r) => {
    const w = sorted.find((m) => same(m.address, r.winner!));
    return w ? nameFor(w, names) : '';
  });
  // Gathering circle past its deadline that nobody has cancelled: the organizer can cancel it and take the bond back.
  const expired = v.state === 'forming' && nowSec > v.params.joinDeadline;
  const expiredMine = expired && isOrganizer;
  return {
    id: v.address,
    label: v.label || 'Dây hụi',
    role: isOrganizer ? 'organizer' : 'member',
    state: STATE_MAP[v.state],
    round: v.settledRounds,
    n: v.params.N,
    contribution: v.params.C,
    todo: expiredMine ? (v.bondRemaining > 0n ? 'Hết hạn gom người mà chưa đủ. Hủy dây và rút ký quỹ về ví' : 'Hết hạn gom người mà chưa đủ') : step.todo,
    secondsLeft: expiredMine ? 0 : step.secondsLeft(nowSec),
    href: `/circles/${v.address}`,
    winners: winners.length ? winners : undefined,
    myRound: mine?.receivedRound,
    joined: v.state === 'forming' ? v.members.length : undefined,
    bondLeft: v.state === 'cancelled' && v.bondRemaining > 0n ? true : undefined,
    ...(isOrganizer && v.bondRemaining > 0n && (v.state === 'cancelled' || expired) ? { bondUnits: v.bondRemaining } : {}),
    ...(expired ? { expired: true } : {}),
    action: expiredMine && v.bondRemaining > 0n ? 'Hủy dây' : step.action,
  };
}
