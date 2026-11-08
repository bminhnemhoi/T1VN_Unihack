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

/** State of the demo circle right after round 2 settles, branch B (M4 stopped paying). */
export const DEMO_MEMBERS: SampleMember[] = [
  { name: 'Thành viên 1 (bạn)', status: 'dead', receivedRound: 2, holdback: usdc(60) },
  { name: 'Thành viên 2', status: 'live', holdback: 0n },
  { name: 'Thành viên 3', status: 'live', holdback: 0n },
  { name: 'Thành viên 4', status: 'defaultedDead', receivedRound: 1, holdback: 0n, note: 'Ngừng đóng từ kỳ 2' },
  { name: 'Thành viên 5', status: 'live', holdback: 0n },
];

export interface SampleCircle {
  id: string;
  label: string;
  role: 'organizer' | 'member';
  state: 'active' | 'forming' | 'completed';
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
    winners: ['Thành viên 4', 'Bạn'], // docs/03 section 8: M4 kỳ 1, M1 (you) kỳ 2
    myRound: 2,
    action: 'Vào phòng thăm',
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

/** What the viewer holds across the sample circles. Only facts from the circles above (docs/03 section 8 for "Hụi tổ dân phố 7"). */
export const SAMPLE_WALLET = {
  perRound: usdc(100), // only "Hụi tổ dân phố 7" is collecting now
  received: usdc(323, 18), // kỳ 2 of "Hụi tổ dân phố 7"
  heldBack: usdc(60), // 20% x 3 rounds left x 100, released 20 per round paid on time
};
