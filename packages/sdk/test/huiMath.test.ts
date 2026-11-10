import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { encodeAbiParameters, keccak256 } from 'viem';
import { describe, expect, it } from 'vitest';
import * as m from '../src/huiMath';

type Hex = `0x${string}`;
interface FnCase {
  in: Record<string, string>;
  out: string;
}
interface CommitCase {
  circle: Hex;
  round: string;
  member: Hex;
  bid: string;
  salt: Hex;
  hash: Hex;
}
interface Vectors {
  version: number;
  seed: number;
  functions: Record<string, FnCase[]>;
  commitHash: CommitCase[];
}

const vectorPath = fileURLToPath(
  new URL('../../../contracts/test/vectors/huimath.json', import.meta.url),
);
const vectors = JSON.parse(readFileSync(vectorPath, 'utf8')) as Vectors;

// Parameter order per docs/05 section 3.5; keys are the names used in the vector file.
const impls: Record<string, { params: string[]; fn: (...a: bigint[]) => bigint }> = {
  exposure: { params: ['n', 'k', 'c'], fn: m.exposure },
  maxExposure: { params: ['n', 'c'], fn: m.maxExposure },
  holdbackFor: { params: ['alphaBps', 'n', 'k', 'c'], fn: m.holdbackFor },
  releasePerRound: { params: ['alphaBps', 'c'], fn: m.releasePerRound },
  coverageIndexBps: {
    params: ['alphaBps', 'bond', 'reserve', 'n', 'c'],
    fn: m.coverageIndexBps,
  },
  maxBid: {
    params: ['capBps', 'n', 'k', 'c', 'periodSec', 'payers'],
    fn: m.maxBid,
  },
  lateFee: {
    params: ['amount', 'lateRateBps', 'elapsedSec', 'periodSec', 'roundDuration'],
    fn: m.lateFee,
  },
  bpsOf: { params: ['amount', 'bps'], fn: m.bpsOf },
  bidCapAfterShare: { params: ['statutoryMaxBid', 'shareBps'], fn: m.bidCapAfterShare },
  commissionRoom: { params: ['statutoryMaxBid', 'payers'], fn: m.commissionRoom },
  commission: { params: ['pot', 'feeBps', 'shareBps', 'room'], fn: m.commission },
  reserveShare: { params: ['total', 'weight', 'weightSum'], fn: m.reserveShare },
  onTimeWeight: { params: ['n', 'lateCount', 'defaulted'], fn: m.onTimeWeight },
};

describe('huiMath vs shared vectors (contracts/test/vectors/huimath.json)', () => {
  it('has a vector set for every HuiMath function', () => {
    expect(vectors.version).toBe(1);
    expect(Object.keys(vectors.functions).sort()).toEqual(Object.keys(impls).sort());
  });

  for (const [name, impl] of Object.entries(impls)) {
    it(`${name}: every case matches`, () => {
      const cases = vectors.functions[name];
      expect(cases).toBeDefined();
      expect(cases!.length).toBeGreaterThan(0);
      for (const c of cases!) {
        expect(Object.keys(c.in)).toEqual(impl.params);
        const args = impl.params.map((p) => BigInt(c.in[p]!));
        expect(impl.fn(...args), `${name}(${args.join(', ')})`).toBe(BigInt(c.out));
      }
    });
  }

  it('commitHash: keccak256(abi.encode(circle, round, member, bid, salt)) matches', () => {
    expect(vectors.commitHash.length).toBeGreaterThan(0);
    for (const c of vectors.commitHash) {
      const hash = keccak256(
        encodeAbiParameters(
          [
            { type: 'address' },
            { type: 'uint32' },
            { type: 'address' },
            { type: 'uint256' },
            { type: 'bytes32' },
          ],
          [c.circle, Number(c.round), c.member, BigInt(c.bid), c.salt],
        ),
      );
      expect(hash).toBe(c.hash);
    }
  });
});

describe('docs/03 section 8 worked example', () => {
  const usdc = (x: number): bigint => BigInt(Math.round(x * 1_000_000));
  const N = 5n;
  const C = usdc(100);
  const MONTH = 30n * m.DAY;

  it('maxBid table (kappa 1..5)', () => {
    const table = [6.575342, 4.931506, 3.287671, 1.643835, 0].map(usdc);
    for (let k = 1n; k <= 5n; k++) {
      const payers = N - k;
      expect(m.maxBid(2000n, N, k, C, MONTH, payers)).toBe(table[Number(k) - 1]);
    }
  });

  it('coverage index is 100% with bond 480 and alpha 20%', () => {
    expect(m.maxExposure(N, C)).toBe(usdc(600));
    expect(m.coverageIndexBps(2000n, usdc(480), 0n, N, C)).toBe(10_000n);
  });

  it('round 1: M4 bids 6 and receives 288.48', () => {
    const bid = usdc(6);
    const pot = 4n * (C - bid);
    expect(pot).toBe(usdc(376));
    const fee = m.bpsOf(pot, 100n);
    const premium = m.bpsOf(pot, 100n);
    const holdback = m.holdbackFor(2000n, N, 1n, C);
    expect(fee).toBe(usdc(3.76));
    expect(holdback).toBe(usdc(80));
    expect(pot - fee - premium - holdback).toBe(usdc(288.48));
  });

  it('round 2: M1 bids 3 and receives 323.18', () => {
    const bid = usdc(3);
    const pot = 3n * (C - bid) + C; // M4 shortfall covered
    expect(pot).toBe(usdc(391));
    const fee = m.bpsOf(pot, 100n);
    const premium = m.bpsOf(pot, 100n);
    const holdback = m.holdbackFor(2000n, N, 2n, C);
    expect(holdback).toBe(usdc(60));
    expect(pot - fee - premium - holdback).toBe(usdc(323.18));
    // M4 shortfall 100 = 80 holdback + 20 bond; M4 holdback after release catch-up
    expect(m.releasePerRound(2000n, C)).toBe(usdc(20));
  });

  it('branch A: late fee after one nominal day is 0.027397', () => {
    expect(m.lateFee(C, 1000n, m.DAY, MONTH, MONTH)).toBe(27_397n);
  });

  it('branch B: M4 covers 80 holdback + 320 bond = 400, bond ends at 160', () => {
    let bond = usdc(480);
    bond -= usdc(20); // round 2
    for (let k = 3; k <= 5; k++) bond -= C;
    expect(bond).toBe(usdc(160));
    expect(usdc(80) + usdc(320)).toBe(4n * C);
  });

  it('scaled demo (C = 10): bond 48, bid 0.6, M4 28.848, M1 32.318', () => {
    const c = usdc(10);
    expect(m.coverageIndexBps(2000n, usdc(48), 0n, N, c)).toBe(10_000n);
    const pot1 = 4n * (c - usdc(0.6));
    const fee1 = m.bpsOf(pot1, 100n);
    const h1 = m.holdbackFor(2000n, N, 1n, c);
    expect(pot1 - 2n * fee1 - h1).toBe(usdc(28.848));
    const pot2 = 3n * (c - usdc(0.3)) + c;
    const fee2 = m.bpsOf(pot2, 100n);
    const h2 = m.holdbackFor(2000n, N, 2n, c);
    expect(pot2 - 2n * fee2 - h2).toBe(usdc(32.318));
  });
});

describe('docs/03 section 8.1 commission inside the interest cap (phi = 50%)', () => {
  const usdc = (x: number): bigint => BigInt(Math.round(x * 1_000_000));
  it('bid cap, room and fee per round', () => {
    expect(m.bidCapAfterShare(6_575_342n, 5000n)).toBe(3_287_671n);
    expect(m.bidCapAfterShare(3_287_671n, 5000n)).toBe(1_643_835n);
    expect(m.commissionRoom(6_575_342n, 4n)).toBe(26_301_368n);
    expect(m.commission(usdc(388), 300n, 5000n, 26_301_368n)).toBe(11_640_000n);
    expect(m.commission(392_800_000n, 300n, 5000n, 14_794_518n)).toBe(7_397_259n);
    expect(m.commission(usdc(376), 100n, 0n, 0n)).toBe(3_760_000n);
    expect(m.commission(usdc(400), 300n, 5000n, 0n)).toBe(0n);
  });

  it('vector V1: reserve split by on-time weight', () => {
    const r = 19_697_396n;
    expect(m.reserveShare(r, 4n, 19n)).toBe(4_146_820n);
    expect(m.reserveShare(r, 3n, 19n)).toBe(3_110_115n);
    expect(4n * m.reserveShare(r, 4n, 19n) + m.reserveShare(r, 3n, 19n)).toBe(r - 1n);
    expect(m.onTimeWeight(5n, 0n, false)).toBe(4n);
    expect(m.onTimeWeight(5n, 1n, false)).toBe(3n);
    expect(m.onTimeWeight(5n, 6n, false)).toBe(0n);
    expect(m.onTimeWeight(5n, 0n, true)).toBe(0n);
  });
});

describe('huiMath guards', () => {
  it('rejects negatives, k > n and zero denominators', () => {
    expect(() => m.exposure(5n, 6n, 1n)).toThrow(RangeError);
    expect(() => m.bpsOf(-1n, 1n)).toThrow(RangeError);
    expect(() => m.coverageIndexBps(0n, 0n, 0n, 5n, 0n)).toThrow(RangeError);
    expect(() => m.lateFee(1n, 1n, 1n, 1n, 0n)).toThrow(RangeError);
    expect(m.maxBid(2000n, 5n, 5n, 100n, 1n, 0n)).toBe(0n);
  });
});
