import { encodeFunctionData } from 'viem';
import { describe, expect, it } from 'vitest';
import { huiCircleAbi, huiFactoryAbi } from 'sdk';
import { quietSignAllowed, type QuietSignContext, type TypedDataArgs } from './quietSign';

const A = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as `0x${string}`;
const ME = A(1), FWD = A(2), USDC = A(3), FACTORY = A(4), CIRCLE = A(5), EVIL = A(6);
const NOW = 1_800_000_000;
const REQ = 40_400_000n;
const ctx: QuietSignContext = {
  address: ME, chainId: 43113, forwarder: FWD, usdc: USDC, factory: FACTORY,
  isCircle: async (a) => a.toLowerCase() === CIRCLE.toLowerCase(),
  requiredAllowance: async () => REQ,
  nowSec: () => NOW,
};
const call = (fn: 'claim' | 'leave') => encodeFunctionData({ abi: huiCircleAbi, functionName: fn });
const fwd = (over: Record<string, unknown> = {}, dom: Record<string, unknown> = {}): TypedDataArgs => ({
  domain: { name: 'HuiSafeForwarder', version: '1', chainId: 43113, verifyingContract: FWD, ...dom },
  types: {},
  primaryType: 'ForwardRequest',
  message: { from: ME, to: CIRCLE, value: 0n, gas: 500_000n, nonce: 0n, deadline: NOW + 600, data: call('claim'), ...over },
});
const permit = (over: Record<string, unknown> = {}, dom: Record<string, unknown> = {}): TypedDataArgs => ({
  domain: { name: 'USDC', version: '2', chainId: 43113, verifyingContract: USDC, ...dom },
  types: {},
  primaryType: 'Permit',
  message: { owner: ME, spender: CIRCLE, value: REQ, nonce: 0n, deadline: BigInt(NOW + 3600), ...over },
});

describe('quiet signing only for HụiSafe-shaped requests (B28, audit M-01)', () => {
  it('signs quietly: an allow-listed circle function, factory createCircle, a capped permit to a circle', async () => {
    expect(await quietSignAllowed(fwd(), ctx)).toBe(true);
    expect(await quietSignAllowed(fwd({ data: call('leave') }), ctx)).toBe(true);
    const create = encodeFunctionData({ abi: huiFactoryAbi, functionName: 'implementation' });
    expect(await quietSignAllowed(fwd({ to: FACTORY, data: create }), ctx)).toBe(false); // factory: createCircle only
    expect(await quietSignAllowed(permit(), ctx)).toBe(true);
    expect(await quietSignAllowed(permit({ value: 2n * REQ }), ctx)).toBe(true);
  });
  it('shows the Privy pop-up for anything that points outside HụiSafe', async () => {
    expect(await quietSignAllowed(fwd({ to: EVIL }), ctx)).toBe(false);
    expect(await quietSignAllowed(fwd({}, { verifyingContract: EVIL }), ctx)).toBe(false);
    expect(await quietSignAllowed(fwd({ from: EVIL }), ctx)).toBe(false);
    expect(await quietSignAllowed(fwd({ value: 1n }), ctx)).toBe(false);
    expect(await quietSignAllowed(permit({ spender: EVIL }), ctx)).toBe(false);
    expect(await quietSignAllowed(permit({ owner: EVIL }), ctx)).toBe(false);
    expect(await quietSignAllowed(permit({}, { verifyingContract: EVIL }), ctx)).toBe(false);
  });
  it('pop-up for an unlisted function, too much gas, a far deadline or an oversized permit', async () => {
    expect(await quietSignAllowed(fwd({ data: '0xdeadbeef' }), ctx)).toBe(false);
    expect(await quietSignAllowed(fwd({ gas: 5_000_001n }), ctx)).toBe(false);
    expect(await quietSignAllowed(fwd({ deadline: NOW + 3600 }), ctx)).toBe(false);
    expect(await quietSignAllowed(permit({ deadline: BigInt(NOW + 86_400) }), ctx)).toBe(false);
    expect(await quietSignAllowed(permit({ value: 2n * REQ + 1n }), ctx)).toBe(false);
    expect(await quietSignAllowed(permit({ value: 2n ** 256n - 1n }), ctx)).toBe(false);
  });
  it('wrong chain, unknown type, or a failing check: pop-up', async () => {
    expect(await quietSignAllowed(fwd({}, { chainId: 43114 }), ctx)).toBe(false);
    expect(await quietSignAllowed({ ...permit(), primaryType: 'Mail' }, ctx)).toBe(false);
    expect(await quietSignAllowed(permit(), { ...ctx, isCircle: async () => { throw new Error('rpc down'); } })).toBe(false);
  });
});
