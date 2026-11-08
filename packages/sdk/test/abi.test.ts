import { describe, expect, it } from 'vitest';
import { huiCircleFullAbi } from '../src/abi';

describe('huiCircleFullAbi', () => {
  const fnNames = huiCircleFullAbi.filter((i) => i.type === 'function').map((i) => i.name);
  it('has the lens-served views next to the circle functions, once each', () => {
    for (const n of ['roundInfo', 'memberInfo', 'shortfallOf', 'deadline', 'params', 'members', 'coverageIndexBps']) {
      expect(fnNames.filter((x) => x === n)).toHaveLength(1);
    }
    for (const n of ['settleRound', 'markDefault', 'bondRemaining', 'state', 'settledRounds', 'requiredAllowance']) {
      expect(fnNames.filter((x) => x === n)).toHaveLength(1);
    }
  });
  it('keeps the errors for decoding', () => {
    expect(huiCircleFullAbi.some((i) => i.type === 'error' && i.name === 'BidTooHigh')).toBe(true);
  });
});
