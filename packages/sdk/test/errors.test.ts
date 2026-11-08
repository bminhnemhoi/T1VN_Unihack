import { describe, expect, it } from 'vitest';
import { encodeErrorResult } from 'viem';
import { huiCircleAbi, huiFactoryAbi } from '../src/generated';
import { decodeContractError, decodeError } from '../src/errors';

describe('decodeContractError', () => {
  it('decodes a circle error with arguments into a Vietnamese sentence', () => {
    const data = encodeErrorResult({ abi: huiCircleAbi, errorName: 'BidTooHigh', args: [9_000_000n, 6_575_342n] });
    const out = decodeContractError(data);
    expect(out.code).toBe('BidTooHigh');
    expect(out.message).toContain('6,575342 USDC');
  });

  it('decodes a factory error and no-argument errors', () => {
    const data = encodeErrorResult({ abi: huiFactoryAbi, errorName: 'NotAdmin' });
    expect(decodeContractError(data)).toMatchObject({ code: 'NotAdmin' });
    const grace = encodeErrorResult({ abi: huiCircleAbi, errorName: 'GraceNotOver' });
    expect(decodeContractError(grace).message).toBe('Chưa hết ân hạn.');
  });

  it('falls back to Unknown for an unknown selector', () => {
    expect(decodeContractError('0xdeadbeef').code).toBe('Unknown');
  });

  it('finds revert data inside a nested viem-style error', () => {
    const data = encodeErrorResult({ abi: huiCircleAbi, errorName: 'TooEarly', args: [123n] });
    const err = { cause: { cause: { data } } };
    expect(decodeError(err).code).toBe('TooEarly');
    expect(decodeError(new Error('network down')).code).toBe('Unknown');
  });
});
