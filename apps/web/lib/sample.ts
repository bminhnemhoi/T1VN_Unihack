/** Sample data for the mock screens. Numbers follow docs/03 section 8 (N = 5, C = 100 USDC, alpha 20%, bond 480). */
const U = 1_000_000n;
export const usdc = (whole: number, cents = 0): bigint => BigInt(whole) * U + BigInt(cents) * 10_000n;

export type MemberStatus = 'live' | 'dead' | 'frozen' | 'defaultedDead';

export interface SampleMember {
  name: string;
  status: MemberStatus;
  receivedRound?: number;
  holdback: bigint;
  note?: string;
}

/**
 * State of the demo circle right after round 2 settles, branch B (M4 stopped paying).
 * The viewer is Thành viên 2: still "live" (has not received), so they may bid in kỳ 3 (docs/03 section 6.1).
 */
export const VIEWER = 1; // index into DEMO_MEMBERS
export const DEMO_MEMBERS: SampleMember[] = [
  { name: 'Thành viên 1', status: 'dead', receivedRound: 2, holdback: usdc(60) },
  { name: 'Thành viên 2', status: 'live', holdback: 0n },
  { name: 'Thành viên 3', status: 'live', holdback: 0n },
  { name: 'Thành viên 4', status: 'defaultedDead', receivedRound: 1, holdback: 0n, note: 'Ngừng đóng từ kỳ 2' },
  { name: 'Thành viên 5', status: 'live', holdback: 0n },
];

export interface SampleCircle {
  id: string;
  label: string;
  role: 'organizer' | 'member';
  /** `cancelled`: never started (not enough people before the deadline). `unwound`: stopped by the admin after a 48 h pause. Neither is "done". */
  state: 'active' | 'forming' | 'completed' | 'cancelled' | 'unwound';
  /** Cancelled or unwound circles: the organizer still has bond to withdraw (docs/03 section 5.1 step 6). */
  bondLeft?: boolean;
  round: number;
  n: number;
  contribution: bigint;
  todo: string;
  /** Seconds until the deadline of the next action (fixed so the countdown is the same on every render). */
  secondsLeft: number;
  href: string;
  /** Who received the pot in each settled round (index 0 = kỳ 1), when known. "Bạn" = the viewer. */
  winners?: string[];
  /** The round the viewer received the pot in, if any. */
  myRound?: number;
  /** Forming circles: members joined so far. */
  joined?: number;
  /** Button text for the next action on this circle. */
  action: string;
}

export const SAMPLE_CIRCLES: SampleCircle[] = [
  {
    id: 'a',
    label: 'Hụi tổ dân phố 7',
    role: 'member',
    state: 'active',
    round: 2,
    n: 5,
    contribution: usdc(100),
    todo: 'Nộp thăm kín cho kỳ 3',
    secondsLeft: 4 * 3600 + 12 * 60 + 9,
    href: '/circles/demo',
    winners: ['Thành viên 4', 'Thành viên 1'], // docs/03 section 8: M4 kỳ 1, M1 kỳ 2; you are M2 and have not received
    action: 'Vào phòng thăm',
  },
  {
    id: 'd',
    label: 'Hụi cố định gia đình',
    role: 'member',
    state: 'active',
    round: 2,
    n: 5,
    contribution: usdc(20),
    todo: 'Trả khoản thiếu 20 USDC của kỳ 2',
    secondsLeft: 36 * 3600,
    href: '/circles/co-dinh',
    winners: ['Thành viên 1', 'Thành viên 2'], // Fixed: order of joining; you are Thành viên 3 and receive in kỳ 3
    myRound: 3,
    action: 'Xem và trả ngay',
  },
  {
    id: 'b',
    label: 'Hụi bạn đại học',
    role: 'organizer',
    state: 'forming',
    round: 0,
    n: 5,
    contribution: usdc(10),
    todo: 'Chờ đủ người (3 trên 5), rồi bấm bắt đầu dây',
    secondsLeft: 6 * 86_400 + 3 * 3600,
    href: '/circles/dang-gom',
    joined: 3,
    action: 'Mời thêm người',
  },
  {
    id: 'c',
    label: 'Hụi chị em văn phòng',
    role: 'member',
    state: 'completed',
    round: 8,
    n: 8,
    contribution: usdc(50),
    todo: 'Đã xong. Xem sổ hụi hoặc nhận lại phần còn lại',
    secondsLeft: 0,
    href: '/circles/da-xong',
    myRound: 5,
    action: 'Xem lại dây',
  },
];

/** What the viewer (Thành viên 2 of "Hụi tổ dân phố 7") has put in so far. Numbers from docs/03 section 8. */
export const SAMPLE_WALLET = {
  perRound: usdc(100), // only "Hụi tổ dân phố 7" is collecting now
  paidSoFar: usdc(94) + usdc(97), // kỳ 1: 100 - bid 6; kỳ 2: 100 - bid 3
};

/** One cell of the ledger grid: what one member did in one settled round. */
export type LedgerCell =
  | { kind: 'paid'; amount: bigint }
  | { kind: 'won' }
  | { kind: 'short'; amount: bigint; fromHoldback: bigint; fromBond: bigint; fromReserve: bigint };

export interface LedgerRound {
  k: number;
  state: 'settled' | 'running' | 'later';
  /** Index into DEMO_MEMBERS. */
  winner?: number;
  bid?: bigint;
  /** What the winner received after fee, reserve premium and holdback. */
  payout?: bigint;
  cells?: LedgerCell[];
}

/** "Bảng sổ hụi" of the demo circle, docs/03 section 8 branch B. Each settled row sums to its pot (376 and 391 USDC). */
export const DEMO_LEDGER: LedgerRound[] = [
  {
    k: 1,
    state: 'settled',
    winner: 3,
    bid: usdc(6),
    payout: usdc(288, 48), // 376 - 3,76 fee - 3,76 reserve - 80 holdback
    cells: [{ kind: 'paid', amount: usdc(94) }, { kind: 'paid', amount: usdc(94) }, { kind: 'paid', amount: usdc(94) }, { kind: 'won' }, { kind: 'paid', amount: usdc(94) }],
  },
  {
    k: 2,
    state: 'settled',
    winner: 0,
    bid: usdc(3),
    payout: usdc(323, 18), // 391 - 3,91 - 3,91 - 60 holdback
    cells: [
      { kind: 'won' },
      { kind: 'paid', amount: usdc(97) },
      { kind: 'paid', amount: usdc(97) },
      { kind: 'short', amount: usdc(100), fromHoldback: usdc(80), fromBond: usdc(20), fromReserve: 0n },
      { kind: 'paid', amount: usdc(97) },
    ],
  },
  { k: 3, state: 'running' },
  { k: 4, state: 'later' },
  { k: 5, state: 'later' },
];
