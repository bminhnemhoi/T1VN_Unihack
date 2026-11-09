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
        return { kind: 'short', amount: sf.amount, fromHoldback: sf.fromHoldback, fromBond: sf.fromBond, fromReserve: sf.fromReserve };
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

const STATE_MAP = { forming: 'forming', active: 'active', paused: 'active', completed: 'completed', cancelled: 'completed', unwound: 'completed' } as const;

function nextStep(v: CircleView, isOrganizer: boolean): { todo: string; action: string; secondsLeft: (now: number) => number } {
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
    const phase = round?.phase ?? 'not-started';
    const until = phase === 'commit' ? round!.commitEndsAt : phase === 'reveal' ? round!.revealEndsAt : (round?.deadline ?? 0);
    const todo =
      phase === 'commit' ? `Nộp thăm kín cho kỳ ${k}` : phase === 'reveal' ? `Mở thăm kỳ ${k}` : phase === 'awaiting-settle' ? `Chờ chốt kỳ ${k}` : `Chờ kỳ ${k} bắt đầu`;
    return { todo, action: 'Vào phòng thăm', secondsLeft: (now) => Math.max(0, until - now) };
  }
  return { todo: 'Đã xong. Xem sổ hụi hoặc nhận lại phần còn lại', action: 'Xem lại dây', secondsLeft: () => 0 };
}

/** `SampleCircle` for the home / "Dây của tôi" lists. `href` points to `/circles/<address>`. */
export function toSampleCircle(v: CircleView, viewer?: Address, nowSec: number = Math.floor(Date.now() / 1000), names: NameOf = defaultName): SampleCircle {
  const isOrganizer = viewer !== undefined && same(v.organizer, viewer);
  const sorted = [...v.members].sort((a, b) => a.joinIndex - b.joinIndex);
  const step = nextStep(v, isOrganizer);
  const mine = viewer ? sorted.find((m) => same(m.address, viewer)) : undefined;
  const settledRounds = v.rounds.filter((r) => r.phase === 'done' && r.winner);
  const winners = settledRounds.map((r) => {
    const w = sorted.find((m) => same(m.address, r.winner!));
    return w ? nameFor(w, names) : '';
  });
  return {
    id: v.address,
    label: v.label || 'Dây hụi',
    role: isOrganizer ? 'organizer' : 'member',
    state: STATE_MAP[v.state],
    round: v.settledRounds,
    n: v.params.N,
    contribution: v.params.C,
    todo: step.todo,
    secondsLeft: step.secondsLeft(nowSec),
    href: `/circles/${v.address}`,
    winners: winners.length ? winners : undefined,
    myRound: mine?.receivedRound,
    joined: v.state === 'forming' ? v.members.length : undefined,
    action: step.action,
  };
}
