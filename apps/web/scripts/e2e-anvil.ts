/**
 * Local rehearsal of the whole HụiSafe flow on anvil (A8, docs/03 section 8 scaled to C = 10 USDC, branch B).
 *
 *   pnpm --filter web e2e:anvil
 *
 * What runs: a fresh anvil; `Deploy.s.sol`; `CreateDemoCircle.s.sol`; five members join through the REAL
 * `/api/attest` and `/api/relay` handlers (Privy faked, chain real) with a permit and a forward request; sealed bids
 * through the relay; the REAL keeper tick settles rounds, marks M4 as defaulted and finalizes. Time is moved with
 * anvil's evm_setNextBlockTimestamp. Only anvil's well-known default test mnemonic is used: no real key, no env file,
 * no Fuji. Every asserted number is printed. Exit code 0 only when every assertion holds.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  encodeFunctionData,
  http,
  stringToHex,
  toHex,
  type Hex,
  type PublicClient,
} from 'viem';
import { mnemonicToAccount, type HDAccount } from 'viem/accounts';
import { resolveNetwork } from 'config/network';
import { loadAddresses } from 'config/addresses';
import {
  erc2771ForwarderAbi,
  formatUsdc,
  huiCircleFullAbi,
  huiFactoryAbi,
  iReputationRegistryAbi,
  mockUsdcAbi,
  listCircles,
  memorySaltStore,
  quoteRepay,
  readCircle,
  signForwardRequest,
  termsHashOf,
  type FetchLike,
  type SignContext,
} from 'sdk';
import { createChainConfig } from '../lib/chain/config';
import { devWallet } from '../lib/chain/wallet';
import {
  activate as activateFlow,
  commitBid as commitFlow,
  createCircle as createCircleFlow,
  depositBond as depositBondFlow,
  join as joinFlow,
  payLate as payLateFlow,
  revealBid as revealFlow,
  settleRound as settleFlow,
  type TxContext,
} from '../lib/chain/write';
import { createAttestHandler } from '../lib/server/attest';
import { anvilChain } from '../lib/server/chain';
import { createRelayHandler } from '../lib/server/relay';
import { SlidingWindowLimiter } from '../lib/server/ratelimit';
import { InvalidTokenError, type PrivyVerifier } from '../lib/server/privy';
import { createViemPort } from '../../keeper/src/chain';
import { tick, type Log } from '../../keeper/src/keeper';

type Address = `0x${string}`;

const MNEMONIC = 'test test test test test test test test test test test junk'; // anvil's public default
const RPC = 'http://127.0.0.1:8545';
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CONTRACTS = `${ROOT}contracts`;
const FOUNDRY_BIN = `${process.env.HOME}/.foundry/bin`;
const ONE = 1_000_000n;

// ---------------------------------------------------------------- accounts (roles are separate, ADR-21)
const hd = (i: number): HDAccount => mnemonicToAccount(MNEMONIC, { addressIndex: i });
const keyOf = (a: HDAccount): Hex => toHex(a.getHdKey().privateKey!);
const deployer = hd(0);
const attester = hd(1);
const relayer = hd(2);
const keeperAcct = hd(3);
const organizer = hd(4);
const M = [hd(5), hd(6), hd(7), hd(8), hd(9)]; // M1..M5 in joining order

// ---------------------------------------------------------------- tiny harness
let passed = 0;
function check(label: string, actual: unknown, expected: unknown, unit?: string): void {
  const a = typeof actual === 'bigint' && !unit ? formatUsdc(actual) : String(actual);
  const e = typeof expected === 'bigint' && !unit ? formatUsdc(expected) : String(expected);
  if (a !== e) throw new Error(`ASSERT FAILED  ${label}: got ${a}, expected ${e}`);
  passed++;
  console.log(`  ok  ${label}: ${a}`);
}
const step = (s: string): void => console.log(`\n== ${s}`);

/** Minimal environment for children: nothing the operator exported (DEPLOY_OUT, keys...) leaks into the rehearsal. */
const baseEnv = (): NodeJS.ProcessEnv =>
  ({
    PATH: `${FOUNDRY_BIN}:${process.env.PATH ?? ''}`,
    HOME: process.env.HOME ?? '',
    NODE_ENV: 'development',
  }) as NodeJS.ProcessEnv;

function run(cmd: string, args: string[], cwd: string, env: Record<string, string>): string {
  const r = spawnSync(cmd, args, { cwd, env: { ...baseEnv(), ...env }, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} ${args[0]} failed:\n${(r.stdout ?? '').slice(-1500)}\n${(r.stderr ?? '').slice(-1500)}`);
  return r.stdout;
}

async function rpcChainId(): Promise<string | undefined> {
  try {
    const r = await fetch(RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
    });
    return r.ok ? ((await r.json()) as { result?: string }).result : undefined;
  } catch {
    return undefined;
  }
}

/** Kills a detached child and everything it forked (pnpm -> node keeper loop). */
function killGroup(child: ChildProcess): void {
  if (child.pid === undefined) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill();
  }
}

async function startAnvil(): Promise<ChildProcess> {
  if ((await rpcChainId()) !== undefined) throw new Error('something already listens on 127.0.0.1:8545; stop it first');
  const child = spawn('anvil', ['--silent', '--port', '8545', '--chain-id', '31337'], { env: baseEnv(), stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    if ((await rpcChainId()) === '0x7a69') return child;
    await new Promise((r) => setTimeout(r, 250));
  }
  child.kill();
  throw new Error('anvil did not start on 127.0.0.1:8545 (is another node using the port?)');
}

async function main(): Promise<void> {
  const anvil = await startAnvil();
  try {
    await scenario();
    console.log(`\nE2E OK: ${passed} assertions passed`);
  } finally {
    anvil.kill();
  }
}

async function scenario(): Promise<void> {
  const deployFile = `${CONTRACTS}/deployments/anvil.json`;
  if (existsSync(deployFile)) rmSync(deployFile);

  step('1. deploy (Deploy.s.sol) and create the demo circle (CreateDemoCircle.s.sol)');
  run(
    'forge',
    ['script', 'script/Deploy.s.sol', '--rpc-url', RPC, '--broadcast'],
    CONTRACTS,
    {
      DEPLOYER_PRIVATE_KEY: keyOf(deployer),
      ATTESTER_ADDRESS: attester.address,
      RELAYER_ADDRESS: relayer.address,
      GIT_COMMIT: 'e2e-anvil',
    },
  );
  run('forge', ['script', 'script/CreateDemoCircle.s.sol', '--rpc-url', RPC, '--broadcast'], CONTRACTS, {
    DEMO_ORGANIZER_PRIVATE_KEY: keyOf(organizer),
  });

  const network = resolveNetwork({ HUISAFE_NETWORK: 'anvil' });
  const dep = loadAddresses(network.deploymentFile, [network.chainId]);
  if (!dep.deployed || !dep.factory || !dep.forwarder || !dep.usdc || !dep.reputation) throw new Error('anvil.json incomplete');
  const { factory, forwarder, usdc, reputation } = dep;
  const pub = createPublicClient({ chain: anvilChain, transport: http(RPC) }) as PublicClient;
  const testClient = createTestClient({ chain: anvilChain, mode: 'anvil', transport: http(RPC) });
  const wallet = (a: HDAccount) => createWalletClient({ account: a, chain: anvilChain, transport: http(RPC) });

  const circles = await pub.readContract({ address: factory, abi: huiFactoryAbi, functionName: 'allCircles' });
  check('factory has one circle', circles.length, 1);
  const circle = circles[0]!;
  const rd = <T,>(functionName: string, args: readonly unknown[] = []) =>
    pub.readContract({ address: circle, abi: huiCircleFullAbi, functionName, args } as never) as Promise<T>;
  const bal = (a: Address) => pub.readContract({ address: usdc, abi: mockUsdcAbi, functionName: 'balanceOf', args: [a] });
  const chainNow = async () => Number((await pub.getBlock({ blockTag: 'latest' })).timestamp);
  const warpTo = async (ts: number) => {
    if (ts > (await chainNow())) await testClient.setNextBlockTimestamp({ timestamp: BigInt(ts) });
    await testClient.mine({ blocks: 1 });
  };
  const waitTx = async (hash: Hex) => {
    const r = await pub.waitForTransactionReceipt({ hash });
    if (r.status !== 'success') throw new Error(`tx reverted ${hash}`);
    return r;
  };

  check('coverage index (bps)', await rd<bigint>('coverageIndexBps'), 10000n, 'bps');
  check('bond deposited by the organizer', await rd<bigint>('bondRemaining'), 48n * ONE);

  step('2. fund the five members (faucet stands in for Circle faucet; anvil MockUSDC)');
  for (const m of M) {
    await waitTx(await wallet(deployer).writeContract({ address: usdc, abi: mockUsdcAbi, functionName: 'mint', args: [m.address, 100n * ONE] }));
  }

  // ------------------------------------------------------------ the real handlers, Privy faked, chain real
  const logs: string[] = [];
  const log = (_l: string, m: string, f?: Record<string, unknown>) => void logs.push(`${m} ${JSON.stringify(f ?? {})}`);
  let clockMs = (await chainNow()) * 1000;
  const verifier: PrivyVerifier = {
    async verifyToken(token) {
      if (token === 'organizer') return { userId: 'did:privy:e2e-org' };
      const i = Number(/^member-(\d)$/.exec(token)?.[1] ?? -1);
      if (!M[i - 1]) throw new InvalidTokenError('unknown token');
      return { userId: `did:privy:e2e-${i}` };
    },
    async walletOf(userId) {
      if (userId.endsWith('org')) return organizer.address;
      return M[Number(userId.slice(-1)) - 1]!.address;
    },
  };
  const attestHandler = createAttestHandler({
    verifier,
    attester: { address: attester.address, signTypedData: (a) => attester.signTypedData(a) },
    idSecret: 'e2e-secret',
    chainId: network.chainId,
    isCircle: (c) => pub.readContract({ address: factory, abi: huiFactoryAbi, functionName: 'isCircle', args: [c] }),
    userLimiter: new SlidingWindowLimiter(20),
    ipLimiter: new SlidingWindowLimiter(1000),
    now: () => clockMs,
    requestId: (() => { let n = 0; return () => `a-${++n}`; })(),
    log,
  });
  const relayWallet = wallet(relayer);
  const relayHandler = createRelayHandler({
    publicClient: pub,
    factory,
    forwarder,
    sender: {
      address: relayer.address,
      execute: ({ forwarder: f, request, gas }) =>
        relayWallet.writeContract({ address: f, abi: erc2771ForwarderAbi, functionName: 'execute', args: [request], gas }),
    },
    limiter: new SlidingWindowLimiter(1000),
    ipLimiter: new SlidingWindowLimiter(1000),
    globalLimiter: new SlidingWindowLimiter(1000),
    verifier,
    createLimiter: new SlidingWindowLimiter(5),
    now: Date.now,
    requestId: (() => { let n = 0; return () => `r-${++n}`; })(),
    log,
  });
  const post = (h: (r: Request) => Promise<Response>, url: string, body: unknown, headers: Record<string, string> = {}) =>
    h(new Request(url, { method: 'POST', headers, body: JSON.stringify(body) }));

  const ctxOf = (a: HDAccount): SignContext => ({ publicClient: pub, walletClient: wallet(a), account: a, chainId: network.chainId });
  const call = (fn: string, args: readonly unknown[] = []) => encodeFunctionData({ abi: huiCircleFullAbi, functionName: fn, args } as never);

  step('3. five members join: /api/attest -> permit -> forward request -> /api/relay (they pay no gas)');
  const requiredAllowance = await rd<bigint>('requiredAllowance');
  check('requiredAllowance = (N-1) x (C + revealBond)', requiredAllowance, 4n * (10n * ONE + ONE / 10n));
  const ethBefore = await Promise.all(M.map((m) => pub.getBalance({ address: m.address })));

  // negative checks on the public surface first
  const noAge = await post(attestHandler, 'http://x/api/attest', { circle, ageConfirmed: false }, { authorization: 'Bearer member-1' });
  check('attest refuses without the 18+ confirmation', noAge.status, 400);
  const noAuth = await post(attestHandler, 'http://x/api/attest', { circle, ageConfirmed: true });
  check('attest refuses without a token', noAuth.status, 401);
  const pauseReq = await signForwardRequest(ctxOf(M[0]!), forwarder, circle, call('pause'), { gas: 200_000n, deadlineSec: (await chainNow()) + 600 });
  const pauseRes = await post(relayHandler, 'http://x/api/relay', pauseReq);
  check('relay refuses pause() (selector not allowed)', pauseRes.status, 403);
  const tampered = { ...pauseReq, request: { ...pauseReq.request, data: call('leave') } };
  const tamperedRes = await post(relayHandler, 'http://x/api/relay', tampered);
  check('relay refuses a request whose content changed after signing (invalid signature)', tamperedRes.status, 400);

  const fetchFn: FetchLike = async (url, init) => {
    const req = new Request(url, { method: init.method, headers: init.headers, body: init.body });
    return url.endsWith('/api/attest') ? attestHandler(req) : relayHandler(req);
  };
  const chainCfg = createChainConfig({
    network: 'anvil',
    chainId: network.chainId,
    factory,
    registry: reputation,
    usdc,
    forwarder,
    fromBlock: '0',
    vndPerUsdc: 26_000,
    pollMs: 1000,
  });
  const saltStore = memorySaltStore();
  /** The A11 flows with member `i` (0 = M1) or the organizer (-1), going through the REAL handlers. */
  const flowCtx = (i: number): TxContext => ({
    chain: chainCfg,
    wallet: devWallet(i < 0 ? 4 : 5 + i, network.chainId),
    getAccessToken: async () => (i < 0 ? 'organizer' : `member-${i + 1}`),
    fetchFn,
    relayUrl: 'http://x/api/relay',
    attestUrl: 'http://x/api/attest',
    saltStore,
  });
  const noAgeFlow = await joinFlow(flowCtx(0), circle, { ageConfirmed: false });
  check('join flow refuses without the 18+ tick (no request sent)', noAgeFlow.ok ? 'ok' : noAgeFlow.code, 'AgeNotConfirmed');
  for (let i = 0; i < 5; i++) {
    clockMs = (await chainNow()) * 1000;
    const r = await joinFlow(flowCtx(i), circle, { ageConfirmed: true });
    check(`join flow: M${i + 1} joined`, r.ok ? 'ok' : `${r.code}: ${r.message}`, 'ok');
  }
  check('members joined', (await rd<Address[]>('members')).length, 5);
  const ethAfter = await Promise.all(M.map((m) => pub.getBalance({ address: m.address })));
  check('members spent no gas at all', ethAfter.every((v, i) => v === ethBefore[i]), true);

  step('4. organizer activates (relayed)');
  const act = await activateFlow(flowCtx(-1), circle);
  check('activate flow', act.ok ? 'ok' : `${act.code}: ${act.message}`, 'ok');
  check('state is Active (1)', await rd<number>('state'), 1);
  const params = await rd<{ commitWindow: number; revealWindow: number; graceSeconds: number }>('params');

  // ------------------------------------------------------------ keeper (the real tick, real viem port)
  const { port } = createViemPort({ network, privateKey: keyOf(keeperAcct), intervalSeconds: 15 });
  const keeperLog: Log = (level, message, f) => console.log(`     keeper ${level} ${message} ${JSON.stringify(f ?? {})}`);
  const keeperTick = () => tick(port, keeperLog);

  const roundStart = async (k: number) => Number(await rd<bigint>('roundStart', [k]));
  const deadline = async (k: number) => Number(await rd<bigint>('deadline', [k]));
  const memberAddrs = M.map((m) => m.address);
  async function commit(k: number, i: number, bid: bigint) {
    const r = await commitFlow(flowCtx(i), circle, k, bid);
    if (!r.ok) throw new Error(`commit flow M${i + 1} round ${k}: ${r.code} ${r.message}`);
  }
  async function reveal(k: number, i: number) {
    const r = await revealFlow(flowCtx(i), circle, k);
    if (!r.ok) throw new Error(`reveal flow M${i + 1} round ${k}: ${r.code} ${r.message}`);
  }
  const roundInfo = (k: number) =>
    rd<{ winner: Address; winningBid: bigint; pot: bigint; payout: bigint; holdback: bigint; fee: bigint; premium: bigint; uncovered: bigint; settledAt: bigint; feeForfeited: boolean }>('roundInfo', [k]);

  const view = () => readCircle(pub, circle, { factory, fromBlock: 0n });

  step('5. round 1: M2 bids 0.4, M4 bids 0.6 (sealed), reveal, keeper settles');
  await warpTo(await roundStart(1));
  await commit(1, 1, 400_000n);
  await commit(1, 3, 600_000n);
  const idleTick = await keeperTick();
  check('keeper does nothing before the deadline', idleTick.sent, 0);
  await warpTo((await roundStart(1)) + params.commitWindow);
  await reveal(1, 1);
  await reveal(1, 3);
  const m4Before1 = await bal(M[3]!.address);
  await warpTo(await deadline(1));
  const t1 = await keeperTick();
  check('keeper settled round 1 (1 tx)', t1.sent, 1);
  const r1 = await roundInfo(1);
  check('round 1 winner is M4', r1.winner, M[3]!.address);
  check('round 1 winning bid', r1.winningBid, 600_000n);
  check('round 1 pot', r1.pot, 37_600_000n);
  check('round 1 holdback kept from M4', r1.holdback, 8n * ONE);
  check('M4 receives', r1.payout, 28_848_000n);
  check('M4 wallet balance rose by exactly that', (await bal(M[3]!.address)) - m4Before1, 28_848_000n);
  const v1 = await view();
  check('readCircle: one circle in the directory', (await listCircles(pub, factory)).length, 1);
  check('readCircle: state active, 5 members', `${v1.state}/${v1.members.length}`, 'active/5');
  check('readCircle: coverage 10000 bps', v1.coverageBps, 10000);
  check('readCircle: round 1 done, winner M4, payout 28,848', `${v1.rounds[0]!.phase}/${v1.rounds[0]!.winner}/${v1.rounds[0]!.payout}`, `done/${M[3]!.address}/28848000`);
  check('readCircle: round 1 holdback 8, bid 0,6', `${v1.rounds[0]!.holdback}/${v1.rounds[0]!.bid}`, '8000000/600000');
  check('readCircle: M4 is dead (received) with 8 USDC holdback', `${v1.members[3]!.status}/${v1.members[3]!.holdback}`, 'dead/8000000');
  check('readCircle: currentRound 2, Decree 19 flag off (5 x 10 USDC)', `${v1.currentRound}/${v1.ndc19.mustNotifyCommune}`, '2/false');

  step('6. round 2: M4 revokes the allowance; M1 and M2 both bid 0.3, M1 commits first');
  await waitTx(await wallet(M[3]!).writeContract({ address: usdc, abi: mockUsdcAbi, functionName: 'approve', args: [circle, 0n] }));
  await warpTo(await roundStart(2));
  await commit(2, 0, 300_000n);
  await commit(2, 1, 300_000n);
  await warpTo((await roundStart(2)) + params.commitWindow);
  await reveal(2, 0);
  await reveal(2, 1);
  await warpTo(await deadline(2));
  await keeperTick();
  const r2 = await roundInfo(2);
  check('round 2 winner is M1 (tie, committed first)', r2.winner, M[0]!.address);
  check('M1 receives', r2.payout, 32_318_000n);
  check('bond after covering M4: 8 from his holdback, 2 from the bond', await rd<bigint>('bondRemaining'), 46n * ONE);
  const sf2 = await rd<{ amount: bigint; fromHoldback: bigint; fromBond: bigint; fromReserve: bigint; uncovered: bigint }>('shortfallOf', [2, M[3]!.address]);
  check('M4 shortfall from his own holdback', sf2.fromHoldback, 8n * ONE);
  check('M4 shortfall from the bond', sf2.fromBond, 2n * ONE);
  check('nothing uncovered', sf2.uncovered, 0n);
  const lateTry = await payLateFlow(flowCtx(3), circle, 2);
  check('payLate flow: M4 revoked the allowance, so it asks for it first (nothing sent)', lateTry.ok ? 'ok' : lateTry.code, 'NeedAllowance');
  const v2 = await view();
  check('readCircle: round 2 winner M1, payout 32,318', `${v2.rounds[1]!.winner}/${v2.rounds[1]!.payout}`, `${M[0]!.address}/32318000`);
  check('readCircle: bond 46', v2.bondRemaining, 46n * ONE);
  const sfv = v2.rounds[1]!.shortfalls[0]!;
  check('readCircle: M4 shortfall 10 = 8 holdback + 2 bond, open', `${sfv.member}/${sfv.amount}/${sfv.fromHoldback}/${sfv.fromBond}/${sfv.resolved}`, `${M[3]!.address}/10000000/8000000/2000000/false`);
  check('readCircle: grace end = settledAt + grace', sfv.graceEndsAt, Number(r2.settledAt) + params.graceSeconds);
  const nowChain = await chainNow();
  const quote = quoteRepay(v2, M[3]!.address, nowChain, { round: 2 });
  const feeOnChain = await rd<bigint>('lateFeeOf', [M[3]!.address, 2]);
  check('quoteRepay principal = 10 USDC', quote.principal, 10n * ONE);
  check('quoteRepay late fee equals lateFeeOf on chain', quote.lateFee, feeOnChain);

  step('7. branch B: M4 never pays. Keeper waits out the grace period, then marks him BEFORE settling round 3');
  const settled2 = Number(r2.settledAt);
  await warpTo(settled2 + params.graceSeconds - 30);
  const early = await keeperTick();
  check('keeper does not mark M4 inside the grace period', early.sent, 0);
  await warpTo(await deadline(3));
  const before3 = await keeperTick();
  check('keeper sent markDefault + settleRound', before3.sent, 2);
  check('M4 is marked defaulted', (await rd<{ defaulted: boolean }>('memberInfo', [M[3]!.address])).defaulted, true);
  const v3 = await view();
  check('readCircle: M4 is defaultedDead, 3 rounds done', `${v3.members[3]!.status}/${v3.settledRounds}`, 'defaultedDead/3');
  check('readCircle: M4 reputation has 1 default', v3.members[3]!.reputation.defaults, 1);
  const again = await keeperTick();
  check('a second tick sends nothing (idempotent)', again.sent, 0);
  check('bond after round 3', await rd<bigint>('bondRemaining'), 36n * ONE);

  for (const [k, bond] of [[4, 26n], [5, 16n]] as const) {
    await warpTo(await deadline(k));
    await keeperTick();
    check(`bond after round ${k}`, await rd<bigint>('bondRemaining'), bond * ONE);
  }
  check('rounds settled', await rd<number>('settledRounds'), 5);
  const v5 = await view();
  check('readCircle: bond 16 after round 5', v5.bondRemaining, 16n * ONE);
  check('readCircle: all 5 rounds done', v5.rounds.every((r) => r.phase === 'done'), true);
  const winners = await Promise.all([3, 4, 5].map(async (k) => (await roundInfo(k)).winner));
  check('winners of rounds 3, 4, 5', winners.join(','), [memberAddrs[1], memberAddrs[2], memberAddrs[4]].join(','));

  step('8. finalize: keeper waits for the grace period after the last round');
  const settled5 = Number((await roundInfo(5)).settledAt);
  const orgBefore = await bal(organizer.address);
  await warpTo(settled5 + params.graceSeconds + 1);
  const fin = await keeperTick();
  check('keeper finalized (1 tx)', fin.sent, 1);
  check('state is Completed (3)', await rd<number>('state'), 3);
  const infos = await Promise.all([1, 2, 3, 4, 5].map(roundInfo));
  // v1.2: round 1 had no shortfall, its fee reached the organizer at settlement; round 2 was forfeited; rounds 3-5
  // (M4's shortfalls) waited in escrow and are paid by finalize.
  const feesPaid = infos.slice(2).filter((r) => !r.feeForfeited).reduce((s, r) => s + r.fee, 0n);
  check('round 2 fee was forfeited when M4 was marked', infos[1]!.feeForfeited, true);
  check('organizer gets the 16 USDC bond left plus the escrowed fees of rounds 3-5', (await bal(organizer.address)) - orgBefore, 16n * ONE + feesPaid);
  const rep = await pub.readContract({ address: reputation, abi: iReputationRegistryAbi, functionName: 'reputationOf', args: [M[3]!.address] });
  check('M4 has one default on record', rep.defaults, 1);
  check('circle holds no USDC any more', await bal(circle), 0n);
  const vf = await view();
  check('readCircle after finalize: completed', vf.state, 'completed');
  check('readCircle after finalize: M4 defaultedDead, reputation 1 default', `${vf.members[3]!.status}/${vf.members[3]!.reputation.defaults}`, 'defaultedDead/1');
  check('readCircle after finalize: M1 completed count 1', vf.members[0]!.reputation.completed, 1);
  check('readCircle after finalize: round 2 fee forfeited visible as payout of M1 unchanged', vf.rounds[1]!.payout, 32_318_000n);

  step('9. the real keeper process starts and scans once (entry point smoke test)');
  const child = spawn('pnpm', ['--filter', 'keeper', 'start'], {
    cwd: ROOT,
    env: { ...baseEnv(), HUISAFE_NETWORK: 'anvil', KEEPER_PRIVATE_KEY: keyOf(keeperAcct), KEEPER_INTERVAL_SECONDS: '3600' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true, // own process group: pnpm forks node, and killing only pnpm leaves the keeper loop alive
  });
  const seen = await new Promise<string>((resolve) => {
    let out = '';
    const timer = setTimeout(() => resolve(out), 20_000);
    child.stdout.on('data', (d: Buffer) => {
      out += d.toString();
      if (out.includes('scan done')) {
        clearTimeout(timer);
        resolve(out);
      }
    });
  });
  killGroup(child);
  check('keeper process logged "keeper started" and "scan done"', seen.includes('keeper started') && seen.includes('scan done'), true);
  check('keeper logs contain no key material', seen.includes(keyOf(keeperAcct).slice(2)), false);

  step('10. second circle through the A11 flows: createCircle, depositBond, join, activate, settleRound, payLate (success)');
  const orgCtx = flowCtx(-1);
  await waitTx(await wallet(deployer).writeContract({ address: usdc, abi: mockUsdcAbi, functionName: 'mint', args: [organizer.address, 20n * ONE] }));
  for (const m of M.slice(0, 3)) {
    await waitTx(await wallet(deployer).writeContract({ address: usdc, abi: mockUsdcAbi, functionName: 'mint', args: [m.address, 50n * ONE] }));
  }
  const created = await createCircleFlow(orgCtx, {
    mode: 1,
    memberCount: 3,
    contribution: 10n * ONE,
    periodSeconds: 30 * 86_400,
    roundDuration: 180,
    commitWindow: 90,
    revealWindow: 60,
    graceSeconds: 120,
    alphaBps: 2000,
    commissionMode: true,
    feeBps: 100,
    reserveBps: 100,
    revealBondBps: 100,
    capBps: 2000,
    joinDeadline: BigInt((await chainNow()) + 1800),
    organizerIsMember: false,
    label: stringToHex('e2e-second', { size: 32 }),
    commissionShareBps: 0,
    termsHash: termsHashOf('e2e anvil: second circle'),
  });
  if (!created.ok) throw new Error(`createCircle flow: ${created.code} ${created.message}`);
  const c2 = created.circle;
  check('createCircle flow: new circle is the second in the directory', (await listCircles(pub, factory)).at(-1), c2);
  const bondTx = await depositBondFlow(orgCtx, c2, 16n * ONE);
  check('depositBond flow (permit for exactly 16 USDC)', bondTx.ok ? 'ok' : `${bondTx.code}: ${bondTx.message}`, 'ok');
  const other = (c: Address, i: number) => ({ ...flowCtx(i), saltStore });
  for (let i = 0; i < 3; i++) {
    clockMs = (await chainNow()) * 1000;
    const r = await joinFlow(other(c2, i), c2, { ageConfirmed: true });
    check(`circle 2 join flow: M${i + 1}`, r.ok ? 'ok' : `${r.code}: ${r.message}`, 'ok');
  }
  const act2 = await activateFlow(orgCtx, c2);
  check('circle 2 activate flow', act2.ok ? 'ok' : `${act2.code}: ${act2.message}`, 'ok');
  const rd2 = <T,>(functionName: string, args: readonly unknown[] = []) =>
    pub.readContract({ address: c2, abi: huiCircleFullAbi, functionName, args } as never) as Promise<T>;
  check('circle 2 coverage index is 100% (bond 16 for O_max 20, alpha 20%)', await rd2<bigint>('coverageIndexBps'), 10000n, 'bps');
  const p2 = await rd2<{ commitWindow: number }>('params');

  await warpTo(Number(await rd2<bigint>('roundStart', [1])));
  check('circle 2 commit flow: M1 bids 0.3', (await commitFlow(flowCtx(0), c2, 1, 300_000n)).ok, true);
  const tooHigh = await commitFlow(flowCtx(1), c2, 1, 400_000n);
  check('commit flow refuses a bid above the cap (nothing sent, no bond lost)', tooHigh.ok ? 'ok' : tooHigh.code, 'BidTooHigh');
  await warpTo(Number(await rd2<bigint>('roundStart', [1])) + p2.commitWindow);
  check('circle 2 reveal flow: M1', (await revealFlow(flowCtx(0), c2, 1)).ok, true);
  await warpTo(Number(await rd2<bigint>('deadline', [1])));
  const s1 = await settleFlow(orgCtx, c2);
  check('settleRound flow (anyone, no gas) closed round 1', s1.ok, true);
  const w1 = (await pub.readContract({ address: c2, abi: huiCircleFullAbi, functionName: 'roundInfo', args: [1] } as never)) as { winner: Address; holdback: bigint };
  check('circle 2 round 1 winner is M1, holdback 4 (20% x 2 x 10)', `${w1.winner}/${w1.holdback}`, `${M[0]!.address}/4000000`);

  await waitTx(await wallet(M[0]!).writeContract({ address: usdc, abi: mockUsdcAbi, functionName: 'approve', args: [c2, 0n] }));
  await warpTo(Number(await rd2<bigint>('roundStart', [2])));
  const m2bid = await commitFlow(flowCtx(1), c2, 2, 50_000n); // round-2 cap is 0,0547 USDC with one payer left
  check('circle 2 round 2: M2 bids 0.05', m2bid.ok ? 'ok' : `${m2bid.code}: ${m2bid.message}`, 'ok');
  await warpTo(Number(await rd2<bigint>('roundStart', [2])) + p2.commitWindow);
  check('circle 2 round 2: M2 reveals', (await revealFlow(flowCtx(1), c2, 2)).ok, true);
  await warpTo(Number(await rd2<bigint>('deadline', [2])));
  check('settleRound flow closed round 2', (await settleFlow(orgCtx, c2)).ok, true);
  const v2b = await readCircle(pub, c2, { factory, fromBlock: 0n });
  const sfb = v2b.rounds[1]!.shortfalls[0]!;
  check('M1 shortfall in round 2: 4 from his holdback, 6 from the bond', `${sfb.fromHoldback}/${sfb.fromBond}/${sfb.resolved}`, '4000000/6000000/false');
  check('bond is 10 while the shortfall is open', v2b.bondRemaining, 10n * ONE);

  await waitTx(await wallet(M[0]!).writeContract({ address: usdc, abi: mockUsdcAbi, functionName: 'approve', args: [c2, 30n * ONE] }));
  const paid = await payLateFlow(flowCtx(0), c2, 2);
  check('payLate flow: M1 pays inside the grace period', paid.ok ? 'ok' : `${paid.code}: ${paid.message}`, 'ok');
  const v2c = await readCircle(pub, c2, { factory, fromBlock: 0n });
  check('after payLate the shortfall is closed', v2c.rounds[1]!.shortfalls[0]!.resolved, true);
  check('after payLate the bond is back to 16', v2c.bondRemaining, 16n * ONE);
  check('after payLate M1 holdback is 2 (restored 4, 2 released: alpha x (N-m) x C)', v2c.members[0]!.holdback, 2n * ONE);
  check('after payLate M1 has no debt and is still dead (not defaulted)', `${v2c.members[0]!.debt}/${v2c.members[0]!.status}`, '0/dead');

  const allLogs = logs.join('\n');
  check('server logs contain no private key or full signature', allLogs.includes(keyOf(M[0]!).slice(2)) || /0x[0-9a-f]{130}/i.test(allLogs), false);
}

// Explicit exit codes: success exits 0 even if some library keeps a socket or timer alive; any failure exits 1.
main().then(
  () => process.exit(0),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
