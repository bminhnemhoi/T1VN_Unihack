/**
 * viem implementation of the keeper port. Sends DIRECTLY from the keeper wallet (not through the relayer, ADR-21)
 * with gas limit = estimate x 1.2, hard cap 5,000,000 (docs/04 section 7.1). Revert reasons are decoded to the
 * custom error name by the SDK; no key or signature is ever logged.
 */
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  fallback,
  http,
  type Chain,
  type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalancheFuji } from 'viem/chains';
import { loadAddresses } from 'config/addresses';
import { decodeError, huiCircleFullAbi, huiFactoryAbi } from 'sdk';
import { REVERT_BACKOFF_SECONDS, gasLimitFor, type KeeperConfig } from './config.js';
import type { AttemptResult, CircleSnapshot, KeeperFn, KeeperPort } from './keeper.js';

type Address = `0x${string}`;

const anvil: Chain = defineChain({
  id: 31337,
  name: 'Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
});

export class NotDeployedError extends Error {}

export function createViemPort(cfg: KeeperConfig): { port: KeeperPort; keeper: Address } {
  const { network } = cfg;
  const deployment = loadAddresses(network.deploymentFile, [network.chainId]);
  if (!deployment.deployed || !deployment.factory) {
    throw new NotDeployedError(`no deployment file for ${network.name}`);
  }
  const factory = deployment.factory;
  const chain = network.name === 'anvil' ? anvil : avalancheFuji;
  // JSON-RPC batching and Multicall3: the 6 reads of one circle snapshot become one request instead of six, which
  // matters on Fuji's public RPC (it throttles bursts). Same setup as the web client; viem skips Multicall3 where the
  // chain has none (anvil), and calls that carry an account (simulate, estimate) are never batched.
  const transports = network.rpcUrls.map((u) => http(u, { batch: true }));
  const transport = transports.length > 1 ? fallback(transports) : transports[0]!;
  const publicClient = createPublicClient({ chain, transport, batch: { multicall: true } }) as PublicClient;
  const account = privateKeyToAccount(cfg.privateKey);
  const wallet = createWalletClient({ account, chain, transport });

  const read = <T>(circle: Address, functionName: string, args: readonly unknown[] = []): Promise<T> =>
    publicClient.readContract({ address: circle, abi: huiCircleFullAbi, functionName, args } as never) as Promise<T>;

  // Terminal circles never come back; remember them to skip their reads.
  const terminal = new Set<Address>();
  // (circle, action) pairs whose transaction was mined but reverted: do not burn gas on them every scan.
  const revertedUntil = new Map<string, number>();

  const port: KeeperPort = {
    async nowSec() {
      const block = await publicClient.getBlock({ blockTag: 'latest' });
      return Number(block.timestamp);
    },
    async circles() {
      const all = await publicClient.readContract({ address: factory, abi: huiFactoryAbi, functionName: 'allCircles' });
      return all.filter((c) => !terminal.has(c));
    },
    async snapshot(circle): Promise<CircleSnapshot> {
      const [state, params, settledRounds, members, bondRemaining, bondDeposited, organizer] = await Promise.all([
        read<number>(circle, 'state'),
        read<{ memberCount: number; joinDeadline: bigint; roundDuration: number }>(circle, 'params'),
        read<number>(circle, 'settledRounds'),
        read<readonly Address[]>(circle, 'members'),
        read<bigint>(circle, 'bondRemaining'),
        read<bigint>(circle, 'bondDeposited'),
        read<Address>(circle, 'organizer'),
      ]);
      if (state >= 3) terminal.add(circle);
      return {
        state: Number(state),
        memberCount: Number(params.memberCount),
        joinDeadline: BigInt(params.joinDeadline),
        roundDuration: Number(params.roundDuration),
        settledRounds: Number(settledRounds),
        members,
        bondRemaining: BigInt(bondRemaining),
        bondDeposited: BigInt(bondDeposited),
        organizer,
      };
    },
    retire(circle) {
      terminal.add(circle);
    },
    deadline: (circle, round) => read<bigint>(circle, 'deadline', [round]),
    async finalizeDueAt(circle, lastRound) {
      const [params, pausedTotal, info] = await Promise.all([
        read<{ graceSeconds: number }>(circle, 'params'),
        read<bigint>(circle, 'pausedTotal'),
        read<{ settledAt: bigint }>(circle, 'roundInfo', [lastRound]),
      ]);
      if (info.settledAt === 0n) return undefined;
      return BigInt(info.settledAt) + BigInt(params.graceSeconds) + BigInt(pausedTotal) + 1n;
    },
    async owes(circle, member) {
      const info = await read<{ defaulted: boolean; debt: bigint }>(circle, 'memberInfo', [member]);
      return !info.defaulted && info.debt > 0n;
    },
    async attempt(circle, fn: KeeperFn, args): Promise<AttemptResult> {
      const backoffKey = `${circle}:${fn}:${String(args[0] ?? '')}`;
      const until = revertedUntil.get(backoffKey);
      if (until !== undefined && Date.now() < until) {
        return { sent: false, code: 'BackingOff', message: 'a previous attempt reverted on-chain; waiting to retry' };
      }
      const call = { address: circle, abi: huiCircleFullAbi, functionName: fn, args, account } as never;
      let gas: bigint;
      try {
        await publicClient.simulateContract(call);
        const estimate = await publicClient.estimateContractGas(call);
        const limit = gasLimitFor(estimate);
        if (limit === undefined) {
          return {
            sent: false,
            code: 'GasAboveCap',
            message: `estimate ${estimate} exceeds the 5,000,000 cap; mark defaulters first`,
          };
        }
        gas = limit;
      } catch (e) {
        const d = decodeError(e);
        return { sent: false, code: d.code, message: d.message };
      }
      try {
        const txHash = await wallet.writeContract({ ...(call as object), gas } as never);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        const ok = receipt.status === 'success';
        if (!ok) revertedUntil.set(backoffKey, Date.now() + REVERT_BACKOFF_SECONDS * 1000);
        return { sent: true, txHash, gasUsed: receipt.gasUsed, ok };
      } catch (e) {
        const d = decodeError(e);
        return { sent: false, code: d.code === 'Unknown' ? 'SendFailed' : d.code, message: d.message };
      }
    },
  };
  return { port, keeper: account.address };
}
