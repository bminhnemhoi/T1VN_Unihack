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
  },
];
