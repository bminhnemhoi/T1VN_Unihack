/**
 * The worked example of docs/03 section 8, BRANCH B (the defaulter), on a real circle (A20). Every money figure is the
 * docs figure divided by 10 (C = 10 USDC, bond 48): it is the evidence that the cascade works with real USDC and real
 * time: M4 wins round 1, stops paying in round 2 (80 -> 8 USDC from its own holdback, 20 -> 2 from the bond),
 * `markDefault` after the grace period, then rounds 3-5 and `finalize` with the bond of 16 USDC coming back.
 *
 *   pnpm --filter web worked-example:fuji -- --dry-run         rehearse everything on an anvil fork of Fuji (nothing is sent to Fuji)
 *   pnpm --filter web worked-example:fuji                       Fuji, PREFLIGHT ONLY: reads balances and prints the plan
 *   pnpm --filter web worked-example:fuji -- --yes              Fuji for real (about 17 minutes; keeper must be running)
 *   ... [--circle 0x...] [--out <state file>]                   resume a half-finished circle / choose the state file
 *
 * It goes through the SAME code as the web: the flows of `lib/chain/write.ts` (create, deposit the bond, join, activate,
 * sealed bids, settle, mark default, finalize) -> `/api/attest`, `/api/relay` and `/api/relay/permit` handlers built from
 * `createAttestHandler`, `createRelayHandler` and `createRelayPermitHandler` -> the forwarder on chain. The only
 * stand-in is Privy: the script holds every key, so a local verifier maps a token to its wallet (what e2e-anvil does).
 * `buildRelayHandler` itself needs real Privy credentials and is exercised by `rehearse:fuji-fork`. M4 has no AVAX, so
 * "stops paying" is done with an EIP-2612 permit of value 0 that M4 signs and the relayer submits.
 *
 * Environment (live mode only; values are never printed): DEMO_ORGANIZER_PRIVATE_KEY, DEMO_M1_PRIVATE_KEY ..
 * DEMO_M5_PRIVATE_KEY, ATTESTER_PRIVATE_KEY, RELAYER_PRIVATE_KEY; optional FUJI_RPC_URL (then FUJI_RPC_URL_FALLBACK).
 * Fuji only: a mainnet URL, or a chain id other than 43113, aborts before anything is sent. No key is read from the
 * command line or a file; `--dry-run` uses only anvil's public default mnemonic.
 *
 * It STOPS SAFELY: every number is checked right after the step that makes it, and a mismatch (or any error) aborts with
 * the step that was running. Each step first reads the chain, so running the same command again continues where it
 * stopped. The transaction hashes of every step go to a JSON file in the temp directory (never into the repo).
 */
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  fallback,
  http,
  stringToHex,
  type Hex,
  type PublicClient,
  type Transport,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount, type LocalAccount } from 'viem/accounts';
import { avalancheFuji } from 'viem/chains';
import { loadAddresses } from 'config/addresses';
import { resolveNetwork } from 'config/network';
import {
  DEMO_TERMS_INPUT,
  buildTermsText,
  erc2771ForwarderAbi,
  formatUsdc,
  huiCircleFullAbi,
  huiFactoryAbi,
  iReputationRegistryAbi,
  mockUsdcAbi,
  signPermit,
  termsHashOf,
  type FetchLike,
  type SaltRecord,
  type SaltStore,
} from 'sdk';
import type { ChainConfig } from '../lib/chain/config';
import type { HuiWallet } from '../lib/chain/wallet';
import {
  activate as activateFlow,
  commitBid as commitFlow,
  createCircle as createCircleFlow,
  depositBond as depositBondFlow,
  finalize as finalizeFlow,
  join as joinFlow,
  markDefault as markDefaultFlow,
  revealBid as revealFlow,
  settleRound as settleFlow,
  type TxContext,
  type TxResult,
} from '../lib/chain/write';
import { createAttestHandler } from '../lib/server/attest';
import { createMutex, createRelayHandler } from '../lib/server/relay';
import { createRelayPermitHandler } from '../lib/server/relayPermit';
import { SlidingWindowLimiter } from '../lib/server/ratelimit';
import { InvalidTokenError, type PrivyVerifier } from '../lib/server/privy';
import { createViemPort } from '../../keeper/src/chain';
import { loadKeeperConfig } from '../../keeper/src/config';
import { tick, type Log } from '../../keeper/src/keeper';
import { forgeScript, hd, keyOf, killChild, setUsdcBalance, startForkAnvil, FUJI_USDC, RPC } from './lib/fork-harness';

type Address = `0x${string}`;

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CONTRACTS = `${ROOT}contracts`;
const ONE = 1_000_000n;
const AVAX = 10n ** 18n;
const LABEL = 'huisafe-demo-default';
/** `DEMO_TERMS_HASH` of `script/CreateDemoCircle.s.sol`: the standard agreement text of this circle (ADR-27). */
const DEMO_TERMS_HASH = '0xd635fa40006e68e86ab9a09230677cb732f9f06da1dfa920561f3d79349389c6';
const ZERO_HASH = `0x${'0'.repeat(64)}`;
const DEPLOY_DIR = `${CONTRACTS}/deployments/rehearsal`;
const DEPLOY_FILE_REL = 'deployments/rehearsal/fuji.json';
const LOG_FILE = `${ROOT}.handover/WORKED-EXAMPLE-A20.log`;

// ---------------------------------------------------------------- the expected figures (docs/03 section 8, divided by 10)
// Members are indexed 0..4 for M1..M5. All amounts are USDC base units (6 decimals).
interface RoundPlan {
  k: number;
  /** [member index, bid] in commit order (the first commit wins a tie). */
  bids: Array<[number, bigint]>;
  winner: number;
  winningBid: bigint;
  pot: bigint;
  fee: bigint;
  premium: bigint;
  holdback: bigint;
  payout: bigint;
  bondAfter: bigint;
}
const PLAN: RoundPlan[] = [
  // round 1: M2 bids 0.4, M4 bids 0.6 and wins; 4 live payers x (10 - 0.6)
  { k: 1, bids: [[1, 400_000n], [3, 600_000n]], winner: 3, winningBid: 600_000n, pot: 37_600_000n, fee: 376_000n, premium: 376_000n, holdback: 8_000_000n, payout: 28_848_000n, bondAfter: 48_000_000n },
  // round 2: M1 and M2 both bid 0.3, M1 committed first; M4 (dead) cannot pay its 10: 8 from its holdback, 2 from the bond
  { k: 2, bids: [[0, 300_000n], [1, 300_000n]], winner: 0, winningBid: 300_000n, pot: 39_100_000n, fee: 391_000n, premium: 391_000n, holdback: 6_000_000n, payout: 32_318_000n, bondAfter: 46_000_000n },
  // rounds 3-5: nobody bids, the lowest join index among the living wins with 0; the bond pays M4's 10 each time
  { k: 3, bids: [], winner: 1, winningBid: 0n, pot: 40_000_000n, fee: 400_000n, premium: 400_000n, holdback: 4_000_000n, payout: 35_200_000n, bondAfter: 36_000_000n },
  { k: 4, bids: [], winner: 2, winningBid: 0n, pot: 40_000_000n, fee: 400_000n, premium: 400_000n, holdback: 2_000_000n, payout: 37_200_000n, bondAfter: 26_000_000n },
  { k: 5, bids: [], winner: 4, winningBid: 0n, pot: 40_000_000n, fee: 400_000n, premium: 400_000n, holdback: 0n, payout: 39_200_000n, bondAfter: 16_000_000n },
];
const BOND = 48n * ONE;
const RESERVE_BEFORE_FINALIZE = 2_358_000n; // premiums 0.376 + 0.391 + 3 x 0.4, plus the forfeited round-2 fee 0.391
const ESCROWED_FEES = 1_200_000n; // rounds 3-5 (round 1 paid at once, round 2 forfeited)
const ORGANIZER_NEEDS = 486n * (ONE / 10n); // 48.6 USDC: the 48 USDC bond plus a little
const MEMBER_NEEDS = 41n * ONE + ONE / 2n; // requiredAllowance is 40.4 USDC

// ---------------------------------------------------------------- output
let passed = 0;
const lines: string[] = [];
function out(s: string): void {
  console.log(s);
  lines.push(s);
}
let currentStep = 'before the first step';
const step = (s: string): void => {
  currentStep = s;
  out(`\n== ${s}`);
};
function check(label: string, actual: unknown, expected: unknown): void {
  const f = (v: unknown): string => (typeof v === 'bigint' ? `${formatUsdc(v)} (${v})` : String(v));
  const a = f(actual);
  const e = f(expected);
  if (a.toLowerCase() !== e.toLowerCase()) throw new Error(`ASSERT FAILED  ${label}: got ${a}, expected ${e}`);
  passed++;
  out(`  ok  ${label}: ${a}`);
}
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- state file (tx hashes per step), outside the repo
interface StateFile {
  mode: 'live' | 'dry-run';
  label: string;
  circle?: Address;
  startedAt: string;
  txs: Record<string, string>;
}
/** Writes a file readable by its owner only, through a temporary file so a crash never leaves half a JSON behind. */
function writePrivate(path: string, content: string): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content, { mode: 0o600 });
  chmodSync(tmp, 0o600);
  renameSync(tmp, path);
}
function requireOutsideRepo(path: string, what: string): string {
  const abs = resolve(path);
  if (abs === resolve(ROOT) || abs.startsWith(resolve(ROOT) + sep)) {
    throw new Error(`${what} must be outside the repository; use --out <path> in /tmp`);
  }
  return abs;
}
function stateFile(path: string): { state: StateFile; save(): void } {
  const abs = requireOutsideRepo(path, 'the state file (it lists transaction hashes)');
  let state: StateFile | undefined;
  if (existsSync(abs)) {
    try {
      state = JSON.parse(readFileSync(abs, 'utf8')) as StateFile;
    } catch {
      state = undefined;
    }
  }
  const s: StateFile = state ?? { mode: 'live', label: LABEL, startedAt: new Date().toISOString(), txs: {} };
  return { state: s, save: () => writePrivate(abs, `${JSON.stringify(s, null, 2)}\n`) };
}

/** Salts of the sealed bids, in `<state file>.salts.json`: a restart between commit and reveal must find them again or the bond is lost. */
function fileSaltStore(path: string): SaltStore {
  requireOutsideRepo(path, 'the salt file (it holds the secrets of sealed bids)');
  const read = (): Record<string, SaltRecord> => {
    try {
      return JSON.parse(readFileSync(path, 'utf8')) as Record<string, SaltRecord>;
    } catch {
      return {};
    }
  };
  return {
    async get(key) {
      return read()[key];
    },
    async set(key, value) {
      writePrivate(path, JSON.stringify({ ...read(), [key]: value }));
    },
    async list() {
      return Object.entries(read());
    },
  };
}

// ---------------------------------------------------------------- what differs between the two modes
interface Roles {
  organizer: LocalAccount;
  M: LocalAccount[]; // M1..M5 in joining order
  attester: LocalAccount;
  relayer: LocalAccount;
}
interface Env {
  mode: 'live' | 'dry-run';
  pub: PublicClient;
  transport: Transport;
  roles: Roles;
  dep: { factory: Address; forwarder: Address; usdc: Address; reputation: Address };
  /** Block time of the latest block. */
  chainNow(): Promise<number>;
  /** Lets chain time reach `ts` (live: wait; dry-run: warp the fork). */
  waitUntil(ts: number, why: string): Promise<void>;
  /** The keeper's job once a deadline passed (live: nothing, the keeper of the coordinating session does it; dry-run: one real keeper tick). */
  keeperRun(): Promise<void>;
  /** How many 5-second polls to give the keeper before the script does the call itself through the relay. */
  polls: number;
  sleep(ms: number): Promise<void>;
}

async function scenario(env: Env, state: StateFile, save: () => void, saltPath: string, circleArg: Address | undefined, go: boolean): Promise<void> {
  const { pub, roles, dep } = env;
  const { organizer, M, attester, relayer } = roles;
  const rd = <T,>(circle: Address, functionName: string, args: readonly unknown[] = []) =>
    pub.readContract({ address: circle, abi: huiCircleFullAbi, functionName, args } as never) as Promise<T>;
  const usdcOf = (a: Address) => pub.readContract({ address: dep.usdc, abi: mockUsdcAbi, functionName: 'balanceOf', args: [a] }) as Promise<bigint>;
  const note = (name: string, hash: string): void => {
    state.txs[name] = hash;
    save();
  };
  const must = <T extends object>(r: TxResult<T>, name: string): TxResult<T> & { ok: true } => {
    if (!r.ok) throw new Error(`${name} failed: ${r.code}: ${r.message}`);
    note(name, r.txHash);
    out(`     ${name}: ${r.txHash}`);
    return r as TxResult<T> & { ok: true };
  };

  step('0. preflight (reads only): chain, attester, balances, reputation');
  check('chain id', await pub.getChainId(), 43113);
  const cfg = await pub.readContract({ address: dep.factory, abi: huiFactoryAbi, functionName: 'config' });
  check('the attester key is the factory attester', attester.address, cfg.attester);
  check('factory minCoverageBps (Fuji: 100%)', cfg.minCoverageBps, 10000);
  check('organizer USDC covers the bond', (await usdcOf(organizer.address)) >= ORGANIZER_NEEDS, true);
  for (const [i, m] of M.entries()) check(`M${i + 1} USDC covers a whole circle`, (await usdcOf(m.address)) >= MEMBER_NEEDS, true);
  check('relayer AVAX is above the relay warning level (0.02)', (await pub.getBalance({ address: relayer.address })) > AVAX / 50n, true);
  const repOf = (a: Address) => pub.readContract({ address: dep.reputation, abi: iReputationRegistryAbi, functionName: 'reputationOf', args: [a] }) as Promise<{ late: number; defaults: number }>;
  const rep = await Promise.all(M.map((m) => repOf(m.address)));
  // round 2 relies on a tie (0.3 each) won by the earlier commit; a wallet with fewer late payments would win instead
  check('tie-break: M1 has no more late payments than M2 (round 2)', rep[0]!.late <= rep[1]!.late, true);
  const m4Defaults = rep[3]!.defaults;
  out(`     M4 reputation before: late ${rep[3]!.late}, defaults ${m4Defaults} (this example adds one default and one late payment)`);

  // Which circle would this run touch? The label and every parameter must be the example's own: the Demo Day circles have
  // the same terms hash and size, and writing to one of them would break the circle meant for the live night (audit M-02).
  const termsHash = termsHashOf(buildTermsText(DEMO_TERMS_INPUT));
  check('agreement hash is the standard demo text (the constant of CreateDemoCircle.s.sol)', termsHash, DEMO_TERMS_HASH);
  const label = stringToHex(LABEL, { size: 32 });
  const assertPlanned = async (c: Address): Promise<void> => {
    check(`${c} was created by the factory`, await pub.readContract({ address: dep.factory, abi: huiFactoryAbi, functionName: 'isCircle', args: [c] }), true);
    check(`${c} belongs to the organizer wallet`, (await rd<Address>(c, 'organizer')).toLowerCase(), organizer.address.toLowerCase());
    const pr = await rd<Record<string, unknown>>(c, 'params');
    const want: Record<string, unknown> = {
      label,
      mode: 1,
      memberCount: 5,
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
      commissionShareBps: 0,
      termsHash,
    };
    for (const [k, v] of Object.entries(want)) check(`${c}: ${k} is the example's`, pr[k], v);
  };
  let existing: Address | undefined = circleArg ?? state.circle;
  if (!existing) {
    const mine = (await pub.readContract({ address: dep.factory, abi: huiFactoryAbi, functionName: 'circlesOf', args: [organizer.address] })) as Address[];
    for (let i = mine.length; i > 0 && !existing; i--) {
      const p0 = await rd<{ label: Hex }>(mine[i - 1]!, 'params');
      const st0 = await rd<number>(mine[i - 1]!, 'state');
      if (p0.label === label && (st0 === 0 || st0 === 1)) existing = mine[i - 1];
    }
  }
  if (existing) {
    await assertPlanned(existing);
    out(`     this run continues circle ${existing} (state ${await rd<number>(existing, 'state')}: 0 Forming, 1 Active, 3 Completed)`);
  } else {
    out('     this run creates a new circle');
  }
  if (!go) {
    out('\nPREFLIGHT OK. Nothing was sent. Run again with --yes (live) to start the example.');
    return;
  }

  // ------------------------------------------------------------ the web's own flows, through the real handlers (Privy stand-in)
  const tokens = new Map<string, LocalAccount>([['org', organizer], ...M.map((m, i) => [`m${i + 1}`, m] as [string, LocalAccount])]);
  const verifier: PrivyVerifier = {
    async verifyToken(token) {
      if (!tokens.has(token)) throw new InvalidTokenError('unknown token');
      return { userId: `did:privy:worked-${token}` };
    },
    async walletOf(userId) {
      return tokens.get(userId.replace('did:privy:worked-', ''))!.address;
    },
  };
  const chainNow = env.chainNow;
  let clockMs = (await chainNow()) * 1000;
  let n = 0;
  const log = (): void => undefined;
  const requestId = () => `we-${++n}`;
  const attestHandler = createAttestHandler({
    verifier,
    attester: { address: attester.address, signTypedData: (a) => attester.signTypedData(a as never) },
    idSecret: 'worked-example',
    chainId: 43113,
    isCircle: (c) => pub.readContract({ address: dep.factory, abi: huiFactoryAbi, functionName: 'isCircle', args: [c] }),
    userLimiter: new SlidingWindowLimiter(100),
    ipLimiter: new SlidingWindowLimiter(1000),
    now: () => clockMs,
    requestId,
    log,
  });
  const relayerWallet: WalletClient = createWalletClient({ account: relayer, chain: avalancheFuji, transport: env.transport });
  const sendLock = createMutex();
  const relayHandler = createRelayHandler({
    publicClient: pub,
    factory: dep.factory,
    forwarder: dep.forwarder,
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
    sendLock,
    now: Date.now,
    requestId,
    log,
  });
  const permitHandler = createRelayPermitHandler({
    publicClient: pub,
    factory: dep.factory,
    usdc: dep.usdc,
    sender: {
      address: relayer.address,
      permit: ({ usdc: u, permit: p, gas }) =>
        relayerWallet.writeContract({ address: u, abi: mockUsdcAbi, functionName: 'permit', args: [p.owner, p.spender, p.value, p.deadline, p.v, p.r, p.s], gas, chain: avalancheFuji, account: relayer } as never),
    },
    ownerLimiter: new SlidingWindowLimiter(1000),
    ipLimiter: new SlidingWindowLimiter(1000),
    globalLimiter: new SlidingWindowLimiter(1000),
    sendLock,
    now: Date.now,
    requestId,
    log,
  });
  const fetchFn: FetchLike = async (url, init) => {
    const req = new Request(url, { method: init.method, headers: init.headers, body: init.body });
    if (url.endsWith('/api/attest')) return attestHandler(req);
    return url.endsWith('/api/relay/permit') ? permitHandler(req) : relayHandler(req);
  };
  const chain: ChainConfig = {
    network: 'fuji',
    chainId: 43113,
    factory: dep.factory,
    registry: dep.reputation,
    usdc: dep.usdc,
    forwarder: dep.forwarder,
    fromBlock: 0n,
    vndPerUsdc: 26_000,
    pollMs: 10_000,
    client: pub,
  };
  const saltStore = fileSaltStore(saltPath);
  const walletOf = (a: LocalAccount): HuiWallet => ({
    kind: 'dev',
    address: a.address,
    chainId: 43113,
    signer: { address: a.address, signTypedData: (args) => a.signTypedData(args as never) },
  });
  const flow = (a: LocalAccount, token: string): TxContext => ({
    chain,
    wallet: walletOf(a),
    getAccessToken: async () => token,
    fetchFn,
    relayUrl: 'http://x/api/relay',
    permitUrl: 'http://x/api/relay/permit',
    attestUrl: 'http://x/api/attest',
    saltStore,
  });
  const orgFlow = flow(organizer, 'org');
  const mFlow = (i: number) => flow(M[i]!, `m${i + 1}`);
  const ready = async (): Promise<void> => {
    clockMs = (await chainNow()) * 1000;
  };

  // ------------------------------------------------------------ 1. the circle
  step('1. a new Bidding circle C = 10 USDC (phi = 0), bond 48, label huisafe-demo-default');
  let circle: Address | undefined = existing;
  if (!circle) {
    await ready();
    const now = await chainNow();
    const made = must(
      await createCircleFlow(orgFlow, {
        mode: 1,
        memberCount: 5,
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
        joinDeadline: BigInt(now + 1800),
        organizerIsMember: false,
        label,
        commissionShareBps: 0,
        termsHash,
      }),
      'createCircle',
    );
    circle = made.circle;
  }
  state.circle = circle;
  save();
  out(`     circle ${circle}`);
  check('organizer of the circle', (await rd<Address>(circle, 'organizer')).toLowerCase(), organizer.address.toLowerCase());

  const deposited = await rd<bigint>(circle, 'bondDeposited');
  if (deposited < BOND) {
    await ready();
    must(await depositBondFlow(orgFlow, circle, BOND - deposited), 'depositBond');
  }
  check('bond locked', await rd<bigint>(circle, 'bondRemaining'), BOND);
  check('coverage index (bps)', Number(await rd<bigint>(circle, 'coverageIndexBps')), 10000);

  // ------------------------------------------------------------ 2. members and activation
  step('2. M1..M5 join without any AVAX (attestation, permit, forward request, relayer pays), then the organizer activates');
  const avaxBefore = await Promise.all(M.map((m) => pub.getBalance({ address: m.address })));
  for (const [i, m] of M.entries()) {
    if ((await rd<{ joined: boolean }>(circle, 'memberInfo', [m.address])).joined) continue;
    await ready();
    must(await joinFlow(mFlow(i), circle, { ageConfirmed: true }), `join M${i + 1}`);
  }
  check('members', (await rd<Address[]>(circle, 'members')).length, 5);
  check('members spent no AVAX', (await Promise.all(M.map((m) => pub.getBalance({ address: m.address })))).every((v, i) => v === avaxBefore[i]), true);
  if ((await rd<number>(circle, 'state')) === 0) {
    await ready();
    must(await activateFlow(orgFlow, circle), 'activate');
  }
  check('state is Active (1)', await rd<number>(circle, 'state'), 1);
  const params = await rd<{ commitWindow: number; revealWindow: number; graceSeconds: number }>(circle, 'params');

  const settledOf = async (): Promise<number> => Number(await rd<bigint>(circle!, 'settledRounds'));
  const roundStart = async (k: number): Promise<number> => Number(await rd<bigint>(circle!, 'roundStart', [k]));
  const deadline = async (k: number): Promise<number> => Number(await rd<bigint>(circle!, 'deadline', [k]));

  /** Gives the keeper its turn, then does the call through the relay (M1) when it did not. */
  const settleWithKeeper = async (k: number): Promise<void> => {
    for (let i = 0; i < env.polls; i++) {
      await env.keeperRun();
      if ((await settledOf()) >= k) return;
      await env.sleep(5000);
    }
    out(`     the keeper did not settle round ${k} in time: settling through the relay with M1`);
    await ready();
    const r = await settleFlow(mFlow(0), circle!);
    if (r.ok) must(r, `settleRound ${k} (relay)`);
    else if ((await settledOf()) < k) throw new Error(`settleRound ${k} (relay) failed: ${r.code}: ${r.message}`);
  };

  const verifyRound = async (p: RoundPlan): Promise<void> => {
    const ri = await rd<{ winner: Address; winningBid: bigint; pot: bigint; payout: bigint; holdback: bigint; fee: bigint; premium: bigint; uncovered: bigint; settled: boolean }>(circle!, 'roundInfo', [p.k]);
    check(`round ${p.k}: settled`, ri.settled, true);
    check(`round ${p.k}: winner is M${p.winner + 1}`, ri.winner.toLowerCase(), M[p.winner]!.address.toLowerCase());
    check(`round ${p.k}: winning bid`, ri.winningBid, p.winningBid);
    check(`round ${p.k}: pot`, ri.pot, p.pot);
    check(`round ${p.k}: fee`, ri.fee, p.fee);
    check(`round ${p.k}: reserve premium`, ri.premium, p.premium);
    check(`round ${p.k}: holdback of the winner`, ri.holdback, p.holdback);
    check(`round ${p.k}: payout`, ri.payout, p.payout);
    check(`round ${p.k}: uncovered`, ri.uncovered, 0n);
    check(`round ${p.k}: payout + fee + premium + holdback = pot (INV-05)`, ri.payout + ri.fee + ri.premium + ri.holdback, ri.pot);
    check(`round ${p.k}: bond left`, await rd<bigint>(circle!, 'bondRemaining'), p.bondAfter);
  };

  /** M4's allowance goes to 0 (permit of value 0, signed by M4, sent by the relayer): the next pull fails. */
  const stopM4Paying = async (): Promise<void> => {
    const m4 = M[3]!;
    const allowance = (await pub.readContract({ address: dep.usdc, abi: mockUsdcAbi, functionName: 'allowance', args: [m4.address, circle!] })) as bigint;
    if (allowance === 0n) return;
    const p = await signPermit(
      { publicClient: pub, signer: { address: m4.address, signTypedData: (a) => m4.signTypedData(a as never) }, chainId: 43113 },
      dep.usdc,
      circle!,
      0n,
      BigInt((await chainNow()) + 1800),
    );
    const hash = await relayerWallet.writeContract({ address: dep.usdc, abi: mockUsdcAbi, functionName: 'permit', args: [m4.address, circle!, 0n, p.deadline, p.v, p.r, p.s], chain: avalancheFuji, account: relayer } as never);
    await pub.waitForTransactionReceipt({ hash });
    note('M4 permit value 0', hash);
    out(`     M4 permit value 0: ${hash}`);
  };

  // ------------------------------------------------------------ 3. the five rounds
  let reserveAtSettle2 = 0n;
  for (const p of PLAN) {
    step(`3.${p.k} round ${p.k}${p.bids.length ? ` (${p.bids.map(([i, b]) => `M${i + 1} bids ${formatUsdc(b)}`).join(', ')})` : ' (nobody bids)'}`);
    if ((await settledOf()) < p.k - 1) throw new Error(`round ${p.k - 1} is not settled yet: the plan stops here (re-run to continue)`);
    if ((await settledOf()) < p.k) {
      const start = await roundStart(p.k);
      await env.waitUntil(start, `round ${p.k} to start`);
      if (p.bids.length) {
        if ((await chainNow()) >= start + params.commitWindow) throw new Error(`the commit window of round ${p.k} has passed without the bids: this circle cannot show the example any more; start a new one`);
        for (const [i, bid] of p.bids) {
          const c = await rd<{ hash: string }>(circle, 'commitOf', [p.k, M[i]!.address]);
          if (c.hash !== ZERO_HASH) continue;
          await ready();
          must(await commitFlow(mFlow(i), circle, p.k, bid), `commit round ${p.k} M${i + 1}`);
        }
        await env.waitUntil(start + params.commitWindow, `the reveal window of round ${p.k}`);
        for (const [i] of p.bids) {
          const c = await rd<{ revealed: boolean }>(circle, 'commitOf', [p.k, M[i]!.address]);
          if (c.revealed) continue;
          await ready();
          must(await revealFlow(mFlow(i), circle, p.k), `reveal round ${p.k} M${i + 1}`);
        }
      }
      await env.waitUntil(await deadline(p.k), `the deadline of round ${p.k}`);
      const orgBefore = await usdcOf(organizer.address);
      const winnerBefore = await usdcOf(M[p.winner]!.address);
      await settleWithKeeper(p.k);
      check(`round ${p.k}: the winner received exactly the payout`, (await usdcOf(M[p.winner]!.address)) - winnerBefore, p.payout);
      if (p.k === 1) check('round 1: the commission reached the organizer at once (round without a shortfall)', (await usdcOf(organizer.address)) - orgBefore, p.fee);
    }
    await verifyRound(p);

    if (p.k === 1) {
      check('round 1: M4 holds 8 USDC of holdback', (await rd<{ holdback: bigint }>(circle, 'memberInfo', [M[3]!.address])).holdback, 8n * ONE);
      out('     M4 stops paying: permit of value 0 (the relayer sends it, M4 has no AVAX)');
      await stopM4Paying();
      check('M4 allowance to the circle is 0', (await pub.readContract({ address: dep.usdc, abi: mockUsdcAbi, functionName: 'allowance', args: [M[3]!.address, circle] })) as bigint, 0n);
    }

    if (p.k === 2) {
      const sf = await rd<{ amount: bigint; fromHoldback: bigint; fromBond: bigint; fromReserve: bigint; uncovered: bigint; resolved: boolean }>(circle, 'shortfallOf', [2, M[3]!.address]);
      check('round 2: M4 missed 10 USDC', sf.amount, 10n * ONE);
      check('round 2: 8 USDC covered by M4 own holdback', sf.fromHoldback, 8n * ONE);
      check('round 2: 2 USDC covered by the bond', sf.fromBond, 2n * ONE);
      check('round 2: nothing from the reserve', sf.fromReserve, 0n);
      check('round 2: nothing left uncovered', sf.uncovered, 0n);
      check('round 2: the round-2 commission waits in escrow (a shortfall round)', await rd<bigint>(circle, 'feeEscrow', [2]), p.fee);
      reserveAtSettle2 = await rd<bigint>(circle, 'reserve');
      check('reserve after round 2 (0.376 + 0.391)', reserveAtSettle2, 767_000n);

      step('3.2b after the grace period: markDefault(M4)');
      const settledAt = Number((await rd<{ settledAt: bigint }>(circle, 'roundInfo', [2])).settledAt);
      await env.waitUntil(settledAt + params.graceSeconds + 1, 'the grace period of round 2');
      if (!(await rd<{ defaulted: boolean }>(circle, 'memberInfo', [M[3]!.address])).defaulted) {
        await ready();
        const r = await markDefaultFlow(mFlow(0), circle, M[3]!.address);
        if (r.ok) must(r, 'markDefault M4');
        else if (!(await rd<{ defaulted: boolean }>(circle, 'memberInfo', [M[3]!.address])).defaulted) throw new Error(`markDefault failed: ${r.code}: ${r.message}`);
      }
      check('M4 is marked as defaulted', (await rd<{ defaulted: boolean }>(circle, 'memberInfo', [M[3]!.address])).defaulted, true);
      check('the round-2 commission was forfeited into the reserve', await rd<bigint>(circle, 'feeEscrow', [2]), 0n);
      check('reserve after markDefault (0.767 + 0.391)', await rd<bigint>(circle, 'reserve'), 1_158_000n);
    }
  }

  // ------------------------------------------------------------ 4. finalize
  step('4. finalize: the bond comes back, the escrowed commissions are paid, the reserve is shared by punctuality');
  const last = Number((await rd<{ settledAt: bigint }>(circle, 'roundInfo', [5])).settledAt);
  await env.waitUntil(last + params.graceSeconds + 1, 'the grace period of round 5');
  const preState = await rd<number>(circle, 'state');
  const reserve = await rd<bigint>(circle, 'reserve');
  const holdbacks = await Promise.all(M.map(async (m) => (await rd<{ holdback: bigint }>(circle!, 'memberInfo', [m.address])).holdback));
  const circleBefore = await usdcOf(circle);
  const orgBefore = await usdcOf(organizer.address);
  const memBefore = await Promise.all(M.map((m) => usdcOf(m.address)));
  if (preState !== 3) {
    check('reserve before finalize', reserve, RESERVE_BEFORE_FINALIZE);
    for (let i = 0; i < env.polls; i++) {
      await env.keeperRun();
      if ((await rd<number>(circle, 'state')) === 3) break;
      await env.sleep(5000);
    }
    if ((await rd<number>(circle, 'state')) !== 3) {
      out('     the keeper did not finalize in time: finalizing through the relay with M1');
      await ready();
      const r = await finalizeFlow(mFlow(0), circle);
      if (r.ok) must(r, 'finalize (relay)');
      else if ((await rd<number>(circle, 'state')) !== 3) throw new Error(`finalize (relay) failed: ${r.code}: ${r.message}`);
    }
    check('state is Completed (3)', await rd<number>(circle, 'state'), 3);
    check('nothing stays in the circle', await usdcOf(circle), 0n);
    check('the organizer got the bond 16 back plus the escrowed commissions 1.2', (await usdcOf(organizer.address)) - orgBefore, 16n * ONE + ESCROWED_FEES);
    check('bond 16 + escrow 1.2 + reserve 2.358 + remaining holdbacks left the circle', circleBefore, 16n * ONE + ESCROWED_FEES + reserve + holdbacks.reduce((a, b) => a + b, 0n));
    const share = reserve / 4n; // M1, M2, M3, M5 are on time (weight 4 each), M4 defaulted (weight 0); 2.358 / 4 divides exactly
    check('the reserve divides exactly between the four on-time members', share * 4n, reserve);
    for (const i of [0, 1, 2, 4]) {
      check(`M${i + 1} got its holdback back plus ${formatUsdc(share)} of the reserve`, (await usdcOf(M[i]!.address)) - memBefore[i]!, holdbacks[i]! + share);
    }
    check('M4 got nothing at the end (no holdback left, no share)', (await usdcOf(M[3]!.address)) - memBefore[3]!, 0n);
  } else {
    out('     the circle was already finalized in an earlier run; final balances are not re-derived');
  }
  const after = await repOf(M[3]!.address);
  check('the registry counted one more default for M4', after.defaults, m4Defaults + 1);
  // M4 caused four shortfalls of 10 USDC (rounds 2-5): 8 from its own holdback and 32 from the bond, which is why the
  // organizer got 48 - 32 = 16 back above. Nobody who paid was short-changed (uncovered 0 in every round, checked above).
  let missed = 0n;
  for (let k = 2; k <= 5; k++) missed += (await rd<{ amount: bigint }>(circle, 'shortfallOf', [k, M[3]!.address])).amount;
  check('M4 missed 40 USDC in total over rounds 2-5', missed, 40n * ONE);
}

// ---------------------------------------------------------------- the two modes
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function live(): Promise<void> {
  const network = resolveNetwork(process.env);
  if (network.name !== 'fuji') throw new Error('this script runs on Fuji (or --dry-run); HUISAFE_NETWORK must be unset or "fuji"');
  const need = (name: string): Hex => {
    const v = process.env[name];
    if (!v) throw new Error(`missing environment variable ${name} (set the key before running; it is never printed)`);
    const hex = v.startsWith('0x') ? v : `0x${v}`;
    if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) throw new Error(`${name} is not a 32-byte hex private key`);
    return hex as Hex;
  };
  const accounts = {
    organizer: privateKeyToAccount(need('DEMO_ORGANIZER_PRIVATE_KEY')),
    M: [1, 2, 3, 4, 5].map((i) => privateKeyToAccount(need(`DEMO_M${i}_PRIVATE_KEY`))),
    attester: privateKeyToAccount(need('ATTESTER_PRIVATE_KEY')),
    relayer: privateKeyToAccount(need('RELAYER_PRIVATE_KEY')),
  };
  const all = [accounts.organizer, accounts.attester, accounts.relayer, ...accounts.M].map((a) => a.address.toLowerCase());
  if (new Set(all).size !== all.length) throw new Error('two roles share one wallet (ADR-21: one wallet per role)');
  const dep0 = loadAddresses(network.deploymentFile, [43113]);
  if (!dep0.deployed || !dep0.factory || !dep0.forwarder || !dep0.usdc || !dep0.reputation) throw new Error('contracts/deployments/fuji.json is incomplete');
  const transports = network.rpcUrls.map((u) => http(u, { batch: true }));
  const transport: Transport = transports.length > 1 ? fallback(transports) : transports[0]!;
  const pub = createPublicClient({ chain: avalancheFuji, transport, pollingInterval: 3000, batch: { multicall: true } }) as PublicClient;
  const chainNow = async (): Promise<number> => Number((await pub.getBlock({ blockTag: 'latest' })).timestamp);
  const env: Env = {
    mode: 'live',
    pub,
    transport,
    roles: accounts,
    dep: { factory: dep0.factory, forwarder: dep0.forwarder, usdc: dep0.usdc, reputation: dep0.reputation },
    chainNow,
    async waitUntil(ts, why) {
      let lastLog = 0;
      const giveUp = Date.now() + 25 * 60_000;
      for (;;) {
        const now = await chainNow();
        if (now >= ts) return;
        if (Date.now() > giveUp) throw new Error(`gave up waiting for ${why}`);
        if (Date.now() - lastLog > 30_000) {
          out(`     waiting ${ts - now}s for ${why}`);
          lastLog = Date.now();
        }
        await sleep(Math.min(ts - now, 5) * 1000 + 500);
      }
    },
    async keeperRun() {
      /* the keeper of the coordinating session settles; the polls below give it its turn */
    },
    polls: 24, // 120 s
    sleep,
  };
  // A FIXED default path (not a new temp directory per run): a re-run must find the state and, above all, the salts of the
  // sealed bids, or the reveal fails and the bond of the bid is lost.
  const defaultDir = `${tmpdir()}/huisafe-worked-example`;
  const outPath = arg('--out') ?? `${defaultDir}/state.json`;
  mkdirSync(resolve(outPath, '..'), { recursive: true, mode: 0o700 });
  const sf = stateFile(outPath);
  sf.state.mode = 'live';
  out(`state file (transaction hashes): ${resolve(outPath)}`);
  out(`salt file (secrets of the sealed bids; keep it until the reveals are done): ${resolve(outPath)}.salts.json`);
  const circleArg = arg('--circle');
  await scenario(env, sf.state, sf.save, `${resolve(outPath)}.salts.json`, circleArg as Address | undefined, process.argv.includes('--yes'));
}

async function dryRun(): Promise<void> {
  mkdirSync(`${ROOT}.handover`, { recursive: true });
  const broadcastDir = mkdtempSync(`${tmpdir()}/huisafe-worked-broadcast-`);
  if (existsSync(DEPLOY_DIR)) rmSync(DEPLOY_DIR, { recursive: true });
  mkdirSync(DEPLOY_DIR, { recursive: true });
  const anvil = await startForkAnvil();
  try {
    const deployer = hd(0);
    const attester = hd(1);
    const relayer = hd(2);
    const keeper = hd(3);
    const organizer = hd(4);
    const M = [hd(5), hd(6), hd(7), hd(8), hd(9)];
    const admin = hd(10);
    const transport = http(RPC);
    const pub = createPublicClient({ chain: avalancheFuji, transport, pollingInterval: 250 }) as PublicClient;
    const test = createTestClient({ chain: avalancheFuji, mode: 'anvil', transport });
    const balanceOf = (a: Address) => (): Promise<bigint> => pub.readContract({ address: FUJI_USDC, abi: mockUsdcAbi, functionName: 'balanceOf', args: [a] }) as Promise<bigint>;

    step('fork: chain 43113 with Circle USDC; wallets reset, then given what the live night has');
    for (const a of [deployer, attester, relayer, keeper, organizer, admin, ...M]) {
      await test.setCode({ address: a.address, bytecode: '0x' });
      await test.setBalance({ address: a.address, value: 0n });
      await setUsdcBalance(balanceOf(a.address), a.address, 0n);
    }
    await test.setBalance({ address: deployer.address, value: AVAX / 20n });
    await test.setBalance({ address: relayer.address, value: AVAX / 20n });
    await test.setBalance({ address: keeper.address, value: AVAX });
    await setUsdcBalance(balanceOf(organizer.address), organizer.address, ORGANIZER_NEEDS);
    for (const m of M) await setUsdcBalance(balanceOf(m.address), m.address, 1218n * (ONE / 10n)); // 121.8 USDC each

    forgeScript(CONTRACTS, broadcastDir, 'script/Deploy.s.sol', {
      DEPLOYER_PRIVATE_KEY: keyOf(deployer),
      ADMIN: admin.address,
      ATTESTER_ADDRESS: attester.address,
      RELAYER_ADDRESS: relayer.address,
      GIT_COMMIT: 'worked-example',
      WRITE_DEPLOYMENT: 'true',
      DEPLOY_OUT: DEPLOY_FILE_REL,
    });
    const network = resolveNetwork({ HUISAFE_NETWORK: 'fuji', FUJI_RPC_URL: RPC, HUISAFE_DEPLOYMENTS_DIR: DEPLOY_DIR });
    const dep0 = loadAddresses(network.deploymentFile, [43113]);
    if (!dep0.deployed || !dep0.factory || !dep0.forwarder || !dep0.usdc || !dep0.reputation) throw new Error('rehearsal fuji.json incomplete');

    const warp = async (ts: number): Promise<void> => {
      const now = Number((await pub.getBlock({ blockTag: 'latest' })).timestamp);
      if (ts > now) await test.setNextBlockTimestamp({ timestamp: BigInt(ts) });
      await test.mine({ blocks: 1 });
    };
    const keeperEnv = { HUISAFE_NETWORK: 'fuji', FUJI_RPC_URL: RPC, HUISAFE_DEPLOYMENTS_DIR: DEPLOY_DIR, KEEPER_PRIVATE_KEY: keyOf(keeper), KEEPER_INTERVAL_SECONDS: '15' };
    const { port } = createViemPort(loadKeeperConfig(keeperEnv));
    const keeperLog: Log = (level, message, f) => out(`     keeper ${level} ${message} ${JSON.stringify(f ?? {})}`);

    const env: Env = {
      mode: 'dry-run',
      pub,
      transport,
      roles: { organizer, M, attester, relayer },
      dep: { factory: dep0.factory, forwarder: dep0.forwarder, usdc: dep0.usdc, reputation: dep0.reputation },
      chainNow: async () => Number((await pub.getBlock({ blockTag: 'latest' })).timestamp),
      waitUntil: (ts) => warp(ts),
      async keeperRun() {
        await tick(port, keeperLog);
      },
      polls: 1,
      sleep: async () => undefined,
    };
    const dir = mkdtempSync(`${tmpdir()}/huisafe-worked-example-dry-`);
    const sf = stateFile(`${dir}/state.json`);
    sf.state.mode = 'dry-run';
    await scenario(env, sf.state, sf.save, `${dir}/state.json.salts.json`, undefined, true);
    out(`transaction hashes of the rehearsal: ${dir}/state.json`);
  } finally {
    killChild(anvil);
    rmSync(broadcastDir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const dry = process.argv.includes('--dry-run');
  let failed: unknown;
  try {
    await (dry ? dryRun() : live());
    out(`\n${dry ? 'WORKED EXAMPLE DRY-RUN' : 'WORKED EXAMPLE'} OK: ${passed} assertions passed`);
  } catch (e) {
    failed = e;
    const text = (e instanceof Error ? e.message : String(e)).replace(/https?:\/\/[^\s)'"]+/g, '<url>'); // an RPC URL can carry an API key
    out(`\nWORKED EXAMPLE STOPPED in step "${currentStep}": ${text}`);
    out('Nothing is lost: every step reads the chain first, so running the same command (plus --circle <address> if the state file is gone) continues from here.');
  } finally {
    if (dry) {
      mkdirSync(`${ROOT}.handover`, { recursive: true });
      writeFileSync(LOG_FILE, `${lines.join('\n')}\n`);
    }
  }
  if (failed) process.exit(1);
}

void main();
