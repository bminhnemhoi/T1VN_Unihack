/**
 * Fill the seats of a circle someone created on the web with demo wallets, leaving the last seat for a person who joins
 * with Privy (the demo video, docs/pitch/kich-ban-video.md scenes 4-6). It goes through the SAME code as the web:
 * `join` of `lib/chain/write.ts` -> the `/api/attest` and `/api/relay` handlers -> the forwarder on chain. The only
 * stand-in is Privy: the script holds the demo keys, so a local verifier maps a token to its wallet (as worked-example
 * does). The entry rules of the real `/api/attest` are applied here too: a wallet with an unresolved default, or with less
 * than one round (C + reveal deposit), is refused.
 *
 *   pnpm --filter web seat:fuji -- --circle 0x...                  PREFLIGHT ONLY: reads the circle and the wallets
 *   pnpm --filter web seat:fuji -- --circle 0x... --yes            Fuji for real
 *   ... [--members 1,2,3,5]                                        which demo wallets join (default M1, M2, M3, M5)
 *
 * Environment (values are never printed): DEMO_M<i>_PRIVATE_KEY for each chosen member, ATTESTER_PRIVATE_KEY,
 * RELAYER_PRIVATE_KEY; optional FUJI_RPC_URL. Fuji only. It never activates the circle: the organizer does that on the web.
 */
import { createPublicClient, createWalletClient, fallback, http, type Hex, type PublicClient, type Transport, type WalletClient } from 'viem';
import { privateKeyToAccount, type LocalAccount } from 'viem/accounts';
import { avalancheFuji } from 'viem/chains';
import { loadAddresses } from 'config/addresses';
import { resolveNetwork } from 'config/network';
import { erc2771ForwarderAbi, formatUsdc, huiCircleFullAbi, huiFactoryAbi, iReputationRegistryAbi, memorySaltStore, mockUsdcAbi, type FetchLike } from 'sdk';
import type { ChainConfig } from '../lib/chain/config';
import { join as joinFlow, type TxContext } from '../lib/chain/write';
import { createAttestHandler } from '../lib/server/attest';
import { createMutex, createRelayHandler } from '../lib/server/relay';
import { SlidingWindowLimiter } from '../lib/server/ratelimit';
import { InvalidTokenError, type PrivyVerifier } from '../lib/server/privy';

type Address = `0x${string}`;

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const need = (name: string): Hex => {
  const v = process.env[name];
  if (!v) throw new Error(`missing environment variable ${name} (set the key before running; it is never printed)`);
  const hex = v.startsWith('0x') ? v : `0x${v}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) throw new Error(`${name} is not a 32-byte hex private key`);
  return hex as Hex;
};

async function main(): Promise<void> {
  const network = resolveNetwork(process.env);
  if (network.name !== 'fuji') throw new Error('this script runs on Fuji only; HUISAFE_NETWORK must be unset or "fuji"');
  const circle = arg('--circle') as Address | undefined;
  if (!circle || !/^0x[0-9a-fA-F]{40}$/.test(circle)) throw new Error('pass --circle 0x... (the circle created on the web)');
  const picked = (arg('--members') ?? '1,2,3,5').split(',').map((s) => Number(s.trim()));
  if (picked.some((i) => !Number.isInteger(i) || i < 1 || i > 5) || new Set(picked).size !== picked.length) throw new Error('--members takes distinct numbers 1..5, e.g. 1,2,3,5');
  const go = process.argv.includes('--yes');

  const members = picked.map((i) => ({ i, account: privateKeyToAccount(need(`DEMO_M${i}_PRIVATE_KEY`)) }));
  const attester = privateKeyToAccount(need('ATTESTER_PRIVATE_KEY'));
  const relayer = privateKeyToAccount(need('RELAYER_PRIVATE_KEY'));
  const dep = loadAddresses(network.deploymentFile, [43113]);
  if (!dep.deployed || !dep.factory || !dep.forwarder || !dep.usdc || !dep.reputation) throw new Error('contracts/deployments/fuji.json is incomplete');
  const factory = dep.factory as Address;
  const transports = network.rpcUrls.map((u) => http(u, { batch: true }));
  const transport: Transport = transports.length > 1 ? fallback(transports) : transports[0]!;
  const pub = createPublicClient({ chain: avalancheFuji, transport, batch: { multicall: true } }) as PublicClient;
  const rd = <T,>(functionName: string, args: readonly unknown[] = []) =>
    pub.readContract({ address: circle, abi: huiCircleFullAbi, functionName, args } as never) as Promise<T>;

  // ---------------------------------------------------------------- preflight (reads only)
  console.log(`circle ${circle}`);
  if (Number(await pub.getChainId()) !== 43113) throw new Error('not Fuji (chain id is not 43113)');
  if (!(await pub.readContract({ address: factory, abi: huiFactoryAbi, functionName: 'isCircle', args: [circle] }))) throw new Error('not a HụiSafe circle');
  const cfg = await pub.readContract({ address: factory, abi: huiFactoryAbi, functionName: 'config' });
  if (cfg.attester.toLowerCase() !== attester.address.toLowerCase()) throw new Error('ATTESTER_PRIVATE_KEY is not the factory attester');
  const state = await rd<number>('state');
  if (state !== 0) throw new Error(`the circle is not gathering members (state ${state}; 0 = Forming)`);
  const params = await rd<{ memberCount: number; contribution: bigint; revealBondBps: number; mode: number; joinDeadline: bigint }>('params');
  const now = Number((await pub.getBlock({ blockTag: 'latest' })).timestamp);
  if (now > Number(params.joinDeadline)) throw new Error('the join deadline has passed');
  const seated = (await rd<Address[]>('members')).length;
  const free = Number(params.memberCount) - seated;
  console.log(`seats: ${seated}/${params.memberCount} taken, join deadline in ${Number(params.joinDeadline) - now} s`);
  const organizer = (await rd<Address>('organizer')).toLowerCase();
  const minNeeded = params.contribution + (Number(params.mode) === 1 ? (params.contribution * BigInt(params.revealBondBps)) / 10_000n : 0n);
  const todo: typeof members = [];
  for (const m of members) {
    const a = m.account.address;
    if (a.toLowerCase() === organizer) throw new Error(`M${m.i} is the organizer of this circle`);
    if ((await rd<{ joined: boolean }>('memberInfo', [a])).joined) {
      console.log(`  M${m.i} ${a}: already in the circle`);
      continue;
    }
    const rep = (await pub.readContract({ address: dep.reputation as Address, abi: iReputationRegistryAbi, functionName: 'reputationOf', args: [a] })) as { defaults: number; repaid: number };
    if (Number(rep.defaults) > Number(rep.repaid)) throw new Error(`M${m.i} has an unresolved default; the web refuses it (UnresolvedDefault). Pick another with --members`);
    const bal = (await pub.readContract({ address: dep.usdc as Address, abi: mockUsdcAbi, functionName: 'balanceOf', args: [a] })) as bigint;
    if (bal < minNeeded) throw new Error(`M${m.i} has ${formatUsdc(bal)}, needs ${formatUsdc(minNeeded)} (one round)`);
    console.log(`  M${m.i} ${a}: ${formatUsdc(bal)}, no unresolved default: will join`);
    todo.push(m);
  }
  if (todo.length > free) throw new Error(`only ${free} seat(s) left for ${todo.length} demo wallet(s)`);
  if (free - todo.length < 1) console.log('  note: no seat stays free for a person joining with Privy');
  if (!go) {
    console.log('\nPREFLIGHT OK. Nothing was sent. Run again with --yes to seat them.');
    return;
  }

  // ---------------------------------------------------------------- the web's own join flow, through the real handlers
  const tokens = new Map<string, LocalAccount>(todo.map((m) => [`m${m.i}`, m.account]));
  const verifier: PrivyVerifier = {
    async verifyToken(token) {
      if (!tokens.has(token)) throw new InvalidTokenError('unknown token');
      return { userId: `did:privy:seat-${token}` };
    },
    async walletOf(userId) {
      return tokens.get(userId.replace('did:privy:seat-', ''))!.address;
    },
  };
  let n = 0;
  const log = (): void => undefined;
  const requestId = () => `seat-${++n}`;
  const attestHandler = createAttestHandler({
    verifier,
    attester: { address: attester.address, signTypedData: (a) => attester.signTypedData(a as never) },
    idSecret: 'seat-demo-members',
    chainId: 43113,
    isCircle: (c) => pub.readContract({ address: factory, abi: huiFactoryAbi, functionName: 'isCircle', args: [c] }),
    userLimiter: new SlidingWindowLimiter(100),
    ipLimiter: new SlidingWindowLimiter(1000),
    now: Date.now,
    requestId,
    log,
  });
  const relayerWallet: WalletClient = createWalletClient({ account: relayer, chain: avalancheFuji, transport });
  const relayHandler = createRelayHandler({
    publicClient: pub,
    factory,
    forwarder: dep.forwarder as Address,
    sender: {
      address: relayer.address,
      execute: ({ forwarder: f, request, gas }) =>
        relayerWallet.writeContract({ address: f, abi: erc2771ForwarderAbi, functionName: 'execute', args: [request], gas, chain: avalancheFuji, account: relayer } as never),
    },
    limiter: new SlidingWindowLimiter(1000),
    ipLimiter: new SlidingWindowLimiter(1000),
    globalLimiter: new SlidingWindowLimiter(1000),
    verifier,
    createLimiter: new SlidingWindowLimiter(5),
    sendLock: createMutex(),
    now: Date.now,
    requestId,
    log,
  });
  const fetchFn: FetchLike = async (url, init) => {
    const req = new Request(url, { method: init.method, headers: init.headers, body: init.body });
    return url.endsWith('/api/attest') ? attestHandler(req) : relayHandler(req);
  };
  const chain: ChainConfig = {
    network: 'fuji',
    chainId: 43113,
    factory,
    registry: dep.reputation as Address,
    usdc: dep.usdc as Address,
    forwarder: dep.forwarder as Address,
    fromBlock: 0n,
    vndPerUsdc: 26_000,
    pollMs: 10_000,
    client: pub,
  };
  for (const m of todo) {
    const ctx: TxContext = {
      chain,
      wallet: { kind: 'dev', address: m.account.address, chainId: 43113, signer: { address: m.account.address, signTypedData: (a) => m.account.signTypedData(a as never) } },
      getAccessToken: async () => `m${m.i}`,
      fetchFn,
      relayUrl: 'http://x/api/relay',
      attestUrl: 'http://x/api/attest',
      saltStore: memorySaltStore(),
    };
    const r = await joinFlow(ctx, circle, { ageConfirmed: true }); // demo wallets held by the (adult) team
    if (!r.ok) throw new Error(`M${m.i} join failed: ${r.code}: ${r.message}`);
    console.log(`  M${m.i} joined: ${r.txHash}`);
  }
  const after = (await rd<Address[]>('members')).length;
  console.log(`\nDONE: ${after}/${params.memberCount} seats taken. ${Number(params.memberCount) - after} left for Privy; the organizer starts the circle on the web when it is full.`);
}

main().catch((e: unknown) => {
  console.error(`STOPPED: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
