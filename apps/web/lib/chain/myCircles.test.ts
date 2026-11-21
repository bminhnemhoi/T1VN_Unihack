import { describe, expect, it } from 'vitest';
import { listMyCircleAddresses } from './myCircles';

type Addr = `0x${string}`;
const A = '0x00000000000000000000000000000000000000a1' as Addr;
const B = '0x00000000000000000000000000000000000000b2' as Addr;
const C = '0x00000000000000000000000000000000000000c3' as Addr;
const ME = '0x000000000000000000000000000000000000beef' as Addr;
const FACTORY = '0x000000000000000000000000000000000000f00d' as Addr;

/** Fake client: A is organised by ME, B has ME as a member, C has nothing to do with ME. Counts reads per function. */
function fakeClient() {
  const calls: Record<string, number> = {};
  const client = {
    async readContract({ address, functionName, args }: { address: Addr; functionName: string; args?: unknown[] }) {
      calls[functionName] = (calls[functionName] ?? 0) + 1;
      if (functionName === 'allCircles') return [A, B, C];
      if (functionName === 'circlesOf') return (args?.[0] as Addr).toLowerCase() === ME.toLowerCase() ? [A] : [];
      if (functionName === 'memberInfo') return { joined: address === B && (args?.[0] as Addr).toLowerCase() === ME.toLowerCase() };
      throw new Error(`unexpected read ${functionName}`);
    },
  };
  return { client, calls };
}

describe('listMyCircleAddresses (issue #12: read in full only the circles of the viewer)', () => {
  it('returns the circles the viewer organises or sits in, nothing else', async () => {
    const { client } = fakeClient();
    expect(await listMyCircleAddresses(client as never, FACTORY, ME)).toEqual([A, B]);
  });
  it('uses one light memberInfo read per circle (batched into one multicall by the web client)', async () => {
    const { client, calls } = fakeClient();
    await listMyCircleAddresses(client as never, FACTORY, ME);
    expect(calls.memberInfo).toBe(3);
  });
  it('a stranger gets no circle', async () => {
    const { client } = fakeClient();
    expect(await listMyCircleAddresses(client as never, FACTORY, '0x0000000000000000000000000000000000000001')).toEqual([]);
  });
});
