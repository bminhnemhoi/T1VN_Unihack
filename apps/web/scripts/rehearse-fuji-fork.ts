/**
 * Dress rehearsal of the Fuji night (A15) on an anvil that FORKS Fuji and keeps chain id 43113:
 *
 *   pnpm --filter web rehearse:fuji-fork
 *
 * Runs the exact order of docs/DEPLOY-FUJI.md against the real Safe v1.4.1 contracts and Circle's real USDC of Fuji:
 *   CreateSafe (2/3) -> Deploy (ADMIN = Safe, registry admin = deployer, self-wired) -> FundDemoWallets (demoday)
 *   -> CreateDemoCircles (3 circles) -> JoinDemoCircles (no Privy, relayer pays) -> relay (real `buildRelayHandler`)
 *   -> real keeper ticks until the Fixed circle completes.
 * Nothing is sent to Fuji: the fork is read-only and every transaction goes to the local node on 127.0.0.1:8545.
 * Only anvil's public default mnemonic is used (never a real key, never an env file); keys reach forge through the
 * child process environment, never the command line. Output is also written to `.handover/REHEARSAL-A15.log`.
 * Exit code 0 only when every assertion holds. The fork needs read access to the public Fuji RPC
 * (override with REHEARSAL_FORK_URL; it must be a Fuji endpoint, mainnet URLs are refused).
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  concat,
  createPublicClient,
  createTestClient,
  createWalletClient,
  encodeFunctionData,
  getAddress,
  http,
  keccak256,
  pad,
  parseAbi,
  toHex,
  type Hex,
  type PublicClient,
} from 'viem';
import { mnemonicToAccount, type HDAccount } from 'viem/accounts';
import { avalancheFuji } from 'viem/chains';
import { loadAddresses } from 'config/addresses';
import { resolveNetwork } from 'config/network';
import { commitHash, huiCircleFullAbi, huiFactoryAbi, iReputationRegistryAbi, mockUsdcAbi, signForwardRequest } from 'sdk';
import { buildRelayHandler, buildRelayPermitHandler } from '../lib/server/env';
import { createViemPort } from '../../keeper/src/chain';
import { loadKeeperConfig } from '../../keeper/src/config';
import { tick, type Log } from '../../keeper/src/keeper';

type Address = `0x${string}`;

const MNEMONIC = 'test test test test test test test test test test test junk'; // anvil's public default
const RPC = 'http://127.0.0.1:8545';
const FORK_URL = process.env.REHEARSAL_FORK_URL ?? 'https://api.avax-test.network/ext/bc/C/rpc';
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CONTRACTS = `${ROOT}contracts`;
const LOG_FILE = `${ROOT}.handover/REHEARSAL-A15.log`;
const DEPLOY_DIR = `${CONTRACTS}/deployments/rehearsal`;
const DEPLOY_FILE_REL = 'deployments/rehearsal/fuji.json';
const FOUNDRY_BIN = `${process.env.HOME}/.foundry/bin`;
const FUJI_USDC: Address = '0x5425890298aed601595a70AB815c96711a31Bc65';
const ONE = 1_000_000n;
const AVAX = 10n ** 18n;

const hd = (i: number): HDAccount => mnemonicToAccount(MNEMONIC, { addressIndex: i });
const keyOf = (a: HDAccount): Hex => toHex(a.getHdKey().privateKey!);
const deployer = hd(0);
const attester = hd(1);
const relayer = hd(2);
const keeperAcct = hd(3);
const organizer = hd(4);
const M = [hd(5), hd(6), hd(7), hd(8), hd(9)]; // M1..M5 in joining order
const owners = [hd(10), hd(11), hd(12)]; // stand-ins for the three real Safe owners

// ---------------------------------------------------------------- output (stdout + log file)
let passed = 0;
const lines: string[] = [];
function out(s: string): void {
  console.log(s);
  lines.push(s);
}
const step = (s: string): void => out(`\n== ${s}`);
function check(label: string, actual: unknown, expected: unknown): void {
  const a = typeof actual === 'string' ? actual.toLowerCase() : String(actual);
  const e = typeof expected === 'string' ? expected.toLowerCase() : String(expected);
  if (a !== e) throw new Error(`ASSERT FAILED  ${label}: got ${String(actual)}, expected ${String(expected)}`);
  passed++;
  out(`  ok  ${label}: ${String(actual)}`);
}

/** Minimal environment for children: nothing the operator exported (real keys, DEPLOY_OUT ...) leaks into the rehearsal. */
const baseEnv = (): NodeJS.ProcessEnv =>
  ({ PATH: `${FOUNDRY_BIN}:${process.env.PATH ?? ''}`, HOME: process.env.HOME ?? '', NODE_ENV: 'development' }) as NodeJS.ProcessEnv;

let broadcastDir = '';
function forge(script: string, vars: Record<string, string>): string {
  const args = ['script', script, '--rpc-url', RPC, '--broadcast'];
  const r = spawnSync('forge', args, {
    cwd: CONTRACTS,
    env: { ...baseEnv(), FOUNDRY_BROADCAST: broadcastDir, ...vars },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`forge ${script} failed:\n${(r.stdout ?? '').slice(-2000)}\n${(r.stderr ?? '').slice(-2000)}`);
  const summary = (r.stdout ?? '').split('\n').filter((l) => /^\s*(Safe|owner|chainId|demo circle|organizer|AVAX sent|USDC sent|transfers|usdc|forwarder|factory|admin|attester|reputation|written|registry|bidding circle|phi circle|fixed circle|activated)/i.test(l));
  for (const l of summary) out(`     ${l.trim()}`);
  return r.stdout ?? '';
}

async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = (await r.json()) as { result?: T; error?: { message: string } };
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result as T;
}
const rpcUp = async (): Promise<boolean> => {
  try {
    return (await rpc<string>('eth_chainId')) !== undefined;
  } catch {
    return false;
  }
};

function killGroup(child: ChildProcess): void {
  try {
    child.kill('SIGTERM');
  } catch {
    /* already gone */
  }
}

/** Fuji's gas price is about 160 wei (eth_gasPrice, 10/11/2026). */
async function startAnvil(): Promise<ChildProcess> {
  if (/(^|\.)avax\.network/i.test(new URL(FORK_URL).hostname) && !/avax-test\.network/i.test(FORK_URL)) {
    throw new Error('REHEARSAL_FORK_URL points at Avalanche mainnet; the rehearsal forks Fuji only');
  }
  if (await rpcUp()) throw new Error('something already listens on 127.0.0.1:8545; stop it first');
  const child = spawn('anvil', ['--silent', '--port', '8545', '--chain-id', '43113', '--fork-url', FORK_URL, '--base-fee', '160', '--gas-price', '160'], { env: baseEnv(), stdio: 'ignore' });
  for (let i = 0; i < 120; i++) {
    if (await rpcUp()) {
      const id = await rpc<string>('eth_chainId');
      if (id === '0xa869') return child;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  killGroup(child);
  throw new Error('anvil fork of Fuji did not start (is the fork URL reachable?)');
}

async function main(): Promise<void> {
  mkdirSync(`${ROOT}.handover`, { recursive: true });
  broadcastDir = mkdtempSync(`${tmpdir()}/huisafe-rehearsal-broadcast-`);
  if (existsSync(DEPLOY_DIR)) rmSync(DEPLOY_DIR, { recursive: true });
  mkdirSync(DEPLOY_DIR, { recursive: true });
  const anvil = await startAnvil();
  let failed: unknown;
  try {
    await scenario();
    out(`\nREHEARSAL OK: ${passed} assertions passed`);
  } catch (e) {
    failed = e;
    out(`\nREHEARSAL FAILED: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    killGroup(anvil);
    rmSync(broadcastDir, { recursive: true, force: true });
    writeFileSync(LOG_FILE, `${lines.join('\n')}\n`);
    appendFileSync(LOG_FILE, `log written ${new Date().toISOString()}\n`);
  }
  if (failed) process.exit(1);
}

/** Finds the balance slot of Circle's USDC by trial (it differs between FiatToken versions) and sets a balance. */
async function setUsdcBalance(pub: PublicClient, who: Address, amount: bigint): Promise<void> {
  const read = () => pub.readContract({ address: FUJI_USDC, abi: mockUsdcAbi, functionName: 'balanceOf', args: [who] });
  if ((await read()) === amount) return;
  for (let slot = 0n; slot < 20n; slot++) {
    const key = keccak256(concat([pad(who, { size: 32 }), pad(toHex(slot), { size: 32 })]));
    const old = (await rpc<Hex>('eth_getStorageAt', [FUJI_USDC, key, 'latest'])) as Hex;
    await rpc('anvil_setStorageAt', [FUJI_USDC, key, pad(toHex(amount), { size: 32 })]);
    if ((await read()) === amount) return;
    await rpc('anvil_setStorageAt', [FUJI_USDC, key, pad(old, { size: 32 })]);
  }
  throw new Error('could not find the balance storage slot of USDC');
}

async function scenario(): Promise<void> {
  const pub = createPublicClient({ chain: avalancheFuji, transport: http(RPC) }) as PublicClient;
  const test = createTestClient({ chain: avalancheFuji, mode: 'anvil', transport: http(RPC) });
  const bal = (a: Address) => pub.readContract({ address: FUJI_USDC, abi: mockUsdcAbi, functionName: 'balanceOf', args: [a] });

  step('0. the fork: chain 43113, real Safe contracts and Circle USDC; wallets reset to their night-of balances');
  check('chain id', await pub.getChainId(), 43113);
  check('USDC version() is "2" (Circle FiatToken)', await pub.readContract({ address: FUJI_USDC, abi: mockUsdcAbi, functionName: 'version' }), '2');
  const everyone = [deployer, attester, relayer, keeperAcct, organizer, ...M, ...owners];
  for (const a of everyone) {
    await test.setCode({ address: a.address, bytecode: '0x' }); // a stray delegation on the fork would trip the Safe owner check
    await test.setBalance({ address: a.address, value: 0n });
    await setUsdcBalance(pub, a.address, 0n); // the public anvil addresses may hold real faucet USDC on Fuji
  }
  await test.setBalance({ address: deployer.address, value: AVAX / 20n }); // 0.05 AVAX, what the team has
  await test.setBalance({ address: relayer.address, value: AVAX / 20n }); // 0.05 AVAX
  await setUsdcBalance(pub, deployer.address, 800n * ONE); // what the team collected from the Circle faucet
  check('deployer USDC', await bal(deployer.address), 800n * ONE);

  const common = { DEPLOYER_PRIVATE_KEY: keyOf(deployer) };

  step('1. CreateSafe: 2-of-3 Safe (the deployer only pays gas)');
  const safeOut = forge('script/CreateSafe.s.sol', {
    ...common,
    SAFE_OWNER_1: owners[0]!.address,
    SAFE_OWNER_2: owners[1]!.address,
    SAFE_OWNER_3: owners[2]!.address,
  });
  const safeMatch = /Safe \(2\/3\) created at:\s*(0x[0-9a-fA-F]{40})/.exec(safeOut);
  if (!safeMatch) throw new Error('CreateSafe did not print the Safe address');
  const safe = getAddress(safeMatch[1]!) as Address;
  const safeAbi = parseAbi(['function getOwners() view returns (address[])', 'function getThreshold() view returns (uint256)']);
  check('Safe threshold', await pub.readContract({ address: safe, abi: safeAbi, functionName: 'getThreshold' }), 2n);
  const got = await pub.readContract({ address: safe, abi: safeAbi, functionName: 'getOwners' });
  check('Safe owners', got.map((x) => x.toLowerCase()).join(','), owners.map((o) => o.address.toLowerCase()).join(','));

  step('2. Deploy: ADMIN = Safe, registry admin = deployer, wired by the script, minCoverage 10000 (default on Fuji)');
  forge('script/Deploy.s.sol', {
    ...common,
    ADMIN: safe,
    ATTESTER_ADDRESS: attester.address,
    RELAYER_ADDRESS: relayer.address,
    GIT_COMMIT: 'rehearsal',
    WRITE_DEPLOYMENT: 'true',
    DEPLOY_OUT: DEPLOY_FILE_REL,
  });
  const network = resolveNetwork({ HUISAFE_NETWORK: 'fuji', FUJI_RPC_URL: RPC, HUISAFE_DEPLOYMENTS_DIR: DEPLOY_DIR });
  const dep = loadAddresses(network.deploymentFile, [43113]);
  if (!dep.deployed || !dep.factory || !dep.forwarder || !dep.usdc || !dep.reputation) throw new Error('rehearsal fuji.json incomplete');
  const { factory, forwarder, reputation } = dep;
  check('deployment file has the real Fuji USDC', dep.usdc, FUJI_USDC);
  check('factory.admin() == Safe', await pub.readContract({ address: factory, abi: huiFactoryAbi, functionName: 'admin' }), safe);
  check('registry.factory() == factory', await pub.readContract({ address: reputation, abi: iReputationRegistryAbi, functionName: 'factory' }), factory);
  check('registry.admin() == deployer', await pub.readContract({ address: reputation, abi: iReputationRegistryAbi, functionName: 'admin' }), deployer.address);
  const cfg = await pub.readContract({ address: factory, abi: huiFactoryAbi, functionName: 'config' });
  check('config.minCoverageBps == 10000', cfg.minCoverageBps, 10000);
  check('config.attester', cfg.attester, attester.address);
  check('deployer is not the admin (role separation)', deployer.address.toLowerCase() === safe.toLowerCase(), false);

  step('3. FundDemoWallets (FUND_TARGET=demoday): only the shortfall moves, a second run sends nothing');
  const addrVars = {
    RELAYER_ADDRESS: relayer.address,
    KEEPER_ADDRESS: keeperAcct.address,
    ORGANIZER_ADDRESS: organizer.address,
    M1_ADDRESS: M[0]!.address,
    M2_ADDRESS: M[1]!.address,
    M3_ADDRESS: M[2]!.address,
    M4_ADDRESS: M[3]!.address,
    M5_ADDRESS: M[4]!.address,
  };
  const fundVars = { ...common, ...addrVars, FUND_TARGET: 'demoday', DEPLOY_FILE: DEPLOY_FILE_REL };
  forge('script/FundDemoWallets.s.sol', fundVars);
  check('organizer USDC', await bal(organizer.address), 144n * ONE);
  for (const [i, m] of M.entries()) check(`M${i + 1} USDC`, await bal(m.address), 122n * ONE);
  check('deployer USDC left', await bal(deployer.address), 800n * ONE - 144n * ONE - 5n * 122n * ONE);
  check('keeper AVAX', await pub.getBalance({ address: keeperAcct.address }), AVAX / 200n);
  check('organizer AVAX', await pub.getBalance({ address: organizer.address }) > AVAX / 200n - AVAX / 1000n, true);
  check('relayer AVAX untouched (already above target)', (await pub.getBalance({ address: relayer.address })) > AVAX / 50n, true);
  // Fork artifact: anvil quotes a 1 gwei priority fee (Fuji's is ~150 wei), so the 0.005 AVAX keeper would run dry after ~10 txs here
  // although on Fuji the whole rehearsal costs about 2e-9 AVAX. Top it up only after the funding script was checked.
  await test.setBalance({ address: keeperAcct.address, value: AVAX });
  const usdcBefore = await bal(organizer.address);
  forge('script/FundDemoWallets.s.sol', fundVars);
  check('second run sends nothing', await bal(organizer.address), usdcBefore);

  step('4. CreateDemoCircles: bidding phi=0, bidding phi=5000, fixed N=3 (CI 100% each)');
  forge('script/CreateDemoCircles.s.sol', { DEMO_ORGANIZER_PRIVATE_KEY: keyOf(organizer), DEPLOY_FILE: DEPLOY_FILE_REL, JOIN_WINDOW_SECONDS: '1800' });
  const list = await pub.readContract({ address: factory, abi: huiFactoryAbi, functionName: 'circlesOf', args: [organizer.address] });
  check('organizer has 3 circles', list.length, 3);
  const [bidding, phi, fixed] = list as [Address, Address, Address];
  const rd = <T,>(circle: Address, functionName: string, args: readonly unknown[] = []) =>
    pub.readContract({ address: circle, abi: huiCircleFullAbi, functionName, args } as never) as Promise<T>;
  for (const [name, c, bond] of [['bidding', bidding, 48n], ['phi', phi, 48n], ['fixed', fixed, 16n]] as const) {
    check(`${name}: coverage index`, await rd<bigint>(c, 'coverageIndexBps'), 10000n);
    check(`${name}: bond`, await rd<bigint>(c, 'bondRemaining'), bond * ONE);
    check(`${name}: Forming (0)`, await rd<number>(c, 'state'), 0);
  }
  check('phi circle: commissionShareBps', (await rd<{ commissionShareBps: number }>(phi, 'params')).commissionShareBps, 5000);

  step('5. JoinDemoCircles: attester, member and relayer keys from env, no Privy, members have no AVAX');
  const joinVars = {
    DEMO_ORGANIZER_PRIVATE_KEY: keyOf(organizer),
    ATTESTER_PRIVATE_KEY: keyOf(attester),
    RELAYER_PRIVATE_KEY: keyOf(relayer),
    DEMO_M1_PRIVATE_KEY: keyOf(M[0]!),
    DEMO_M2_PRIVATE_KEY: keyOf(M[1]!),
    DEMO_M3_PRIVATE_KEY: keyOf(M[2]!),
    DEMO_M4_PRIVATE_KEY: keyOf(M[3]!),
    DEMO_M5_PRIVATE_KEY: keyOf(M[4]!),
    DEPLOY_FILE: DEPLOY_FILE_REL,
    ...addrVars,
  };
  forge('script/JoinDemoCircles.s.sol', joinVars);
  for (const [name, c, n] of [['bidding', bidding, 5], ['phi', phi, 5], ['fixed', fixed, 3]] as const) {
    check(`${name}: members`, (await rd<Address[]>(c, 'members')).length, n);
    check(`${name}: Active (1)`, await rd<number>(c, 'state'), 1);
  }
  for (const [i, m] of M.entries()) check(`M${i + 1} spent no gas`, await pub.getBalance({ address: m.address }), 0n);

  step('6. relay is buildable and relays a real sealed bid (real buildRelayHandler, Privy values are placeholders)');
  const env = {
    HUISAFE_NETWORK: 'fuji',
    FUJI_RPC_URL: RPC,
    HUISAFE_DEPLOYMENTS_DIR: DEPLOY_DIR,
    RELAYER_PRIVATE_KEY: keyOf(relayer),
    NEXT_PUBLIC_PRIVY_APP_ID: 'rehearsal',
    PRIVY_APP_SECRET: 'rehearsal',
  };
  const relayHandler = await buildRelayHandler(env);
  await buildRelayPermitHandler(env); // builds without throwing: forwarder in the file equals the factory config
  const empty = await relayHandler(new Request('http://x/api/relay', { method: 'POST', body: '{}' }));
  check('relay answers a malformed body with 400', empty.status, 400);

  const chainNow = async () => Number((await pub.getBlock({ blockTag: 'latest' })).timestamp);
  const warpTo = async (ts: number) => {
    if (ts > (await chainNow())) await test.setNextBlockTimestamp({ timestamp: BigInt(ts) });
    await test.mine({ blocks: 1 });
  };
  const m1Wallet = createWalletClient({ account: M[0]!, chain: avalancheFuji, transport: http(RPC) });
  const relayCall = async (data: Hex) => {
    const body = await signForwardRequest({ publicClient: pub, walletClient: m1Wallet, account: M[0]!, chainId: 43113 }, forwarder, bidding, data, {
      gas: 400_000n,
      deadlineSec: (await chainNow()) + 600,
    });
    return relayHandler(new Request('http://x/api/relay', { method: 'POST', body: JSON.stringify(body) }));
  };
  const params = await rd<{ commitWindow: number }>(bidding, 'params');
  await warpTo(Number(await rd<bigint>(bidding, 'roundStart', [1])));
  const salt = keccak256(toHex('rehearsal-salt'));
  const bid = ONE / 2n; // maxBid(1) of the C = 10 USDC circle is 0.657534 USDC
  const hash = commitHash(bidding, 1, M[0]!.address, bid, salt);
  const commitRes = await relayCall(encodeFunctionData({ abi: huiCircleFullAbi, functionName: 'commitBid', args: [hash] } as never));
  check('relay: M1 sealed bid (commitBid) accepted', commitRes.status, 200);
  await pub.waitForTransactionReceipt({ hash: ((await commitRes.json()) as { txHash: Hex }).txHash });
  await warpTo(Number(await rd<bigint>(bidding, 'roundStart', [1])) + params.commitWindow);
  const revealRes = await relayCall(encodeFunctionData({ abi: huiCircleFullAbi, functionName: 'revealBid', args: [bid, salt] } as never));
  check('relay: M1 reveal accepted', revealRes.status, 200);
  await pub.waitForTransactionReceipt({ hash: ((await revealRes.json()) as { txHash: Hex }).txHash });

  step('7. keeper: one lap settles the three circles, then laps until the Fixed circle finalizes');
  const keeperEnv = { HUISAFE_NETWORK: 'fuji', FUJI_RPC_URL: RPC, HUISAFE_DEPLOYMENTS_DIR: DEPLOY_DIR, KEEPER_PRIVATE_KEY: keyOf(keeperAcct), KEEPER_INTERVAL_SECONDS: '15' };
  const { port } = createViemPort(loadKeeperConfig(keeperEnv));
  const keeperLog: Log = (level, message, f) => out(`     keeper ${level} ${message} ${JSON.stringify(f ?? {})}`);
  const idle = await tick(port, keeperLog);
  check('keeper does nothing before any deadline', idle.sent, 0);
  // the three circles were activated a few seconds apart: go past the latest round-1 deadline
  const d1 = await Promise.all([bidding, phi, fixed].map((c) => rd<bigint>(c, 'deadline', [1])));
  await warpTo(Number(d1.reduce((x, y) => (x > y ? x : y))));
  const lap1 = await tick(port, keeperLog);
  check('keeper lap 1 settled round 1 of all three circles (3 tx)', lap1.sent, 3);
  const r1 = await rd<{ winner: Address; winningBid: bigint }>(bidding, 'roundInfo', [1]);
  check('bidding round 1 winner is M1 (the only bidder)', r1.winner, M[0]!.address);
  check('bidding round 1 winning bid', r1.winningBid, bid);
  const f1 = await rd<{ winner: Address }>(fixed, 'roundInfo', [1]);
  check('fixed round 1 winner is M1 (join order)', f1.winner, M[0]!.address);

  const circles = [bidding, phi, fixed];
  for (let lap = 2; lap <= 12; lap++) {
    const states = await Promise.all(circles.map((c) => rd<number>(c, 'state')));
    if (states.every((s) => s === 3)) break; // 3 = Completed
    const dues = await Promise.all(
      circles.map(async (c) => {
        const s = await rd<number>(c, 'state');
        if (s !== 1) return 0;
        const k = Number(await rd<bigint>(c, 'currentRound'));
        const settled = Number(await rd<bigint>(c, 'settledRounds'));
        const n = (await rd<{ memberCount: number }>(c, 'params')).memberCount;
        const base = Number(await rd<bigint>(c, 'deadline', [Math.min(k, n)]));
        // all rounds settled: the grace period of the last round still has to pass before `finalize`
        return settled >= n ? Number(await rd<bigint>(c, 'deadline', [n])) + 130 : base;
      }),
    );
    const target = Math.max(...dues);
    if (target === 0) break;
    await warpTo(target);
    const t = await tick(port, keeperLog);
    out(`     lap ${lap}: sent ${t.sent}, failed ${t.failed}, keeper AVAX ${await pub.getBalance({ address: keeperAcct.address })}, gas price ${await pub.getGasPrice()}`);
    if (t.failed > 0) throw new Error(`keeper lap ${lap} had failures`);
  }
  for (const [name, c] of [['bidding', bidding], ['phi', phi], ['fixed', fixed]] as const) {
    check(`${name}: Completed (3)`, await rd<number>(c, 'state'), 3);
    check(`${name}: nothing stays in the circle after finalize`, await bal(c), 0n);
    check(`${name}: nothing uncovered in any round`, (await Promise.all([1, 2, 3, ...(name === 'fixed' ? [] : [4, 5])].map((k) => rd<{ uncovered: bigint }>(c, 'roundInfo', [k])))).every((r) => r.uncovered === 0n), true);
  }
  const keeperAvax = await pub.getBalance({ address: keeperAcct.address });
  check('keeper paid its own gas (its balance went down)', keeperAvax < AVAX, true);

  step('8. the committed files are untouched');
  check('contracts/deployments/fuji.json still absent or unchanged (rehearsal writes only deployments/rehearsal)', existsSync(`${CONTRACTS}/deployments/fuji.json`) ? readFileSync(`${CONTRACTS}/deployments/fuji.json`, 'utf8').includes('rehearsal') : false, false);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
