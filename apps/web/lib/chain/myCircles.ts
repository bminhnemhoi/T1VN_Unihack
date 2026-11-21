/**
 * Issue #12: "Tổng quan" used to read every circle of the factory in full and then keep the viewer's. That cost grew with
 * the whole system. Now we pick the viewer's circles first with light reads (the circles they organise, plus one
 * `memberInfo(viewer)` per circle, batched by the web client into one multicall) and read only those in full.
 */
import type { PublicClient } from 'viem';
import { huiCircleFullAbi, listCircles } from 'sdk';

type Address = `0x${string}`;

export async function listMyCircleAddresses(client: PublicClient, factory: Address, viewer: Address): Promise<Address[]> {
  const [organized, all] = await Promise.all([listCircles(client, factory, { organizer: viewer }), listCircles(client, factory)]);
  const flags = await Promise.all(
    all.map((c) => client.readContract({ address: c, abi: huiCircleFullAbi, functionName: 'memberInfo', args: [viewer] }) as Promise<{ joined: boolean }>),
  );
  const mine = new Set([...organized, ...all.filter((_, i) => flags[i]!.joined)].map((a) => a.toLowerCase()));
  // Keep factory order (oldest first), as before.
  return all.filter((a) => mine.has(a.toLowerCase()));
}
