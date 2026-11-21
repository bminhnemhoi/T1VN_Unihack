/**
 * Local playground for clicking through the web app on anvil (B9). It does what `e2e-anvil.ts` does up to "organizer
 * activates", then LEAVES the node running and serves the two API routes on http://127.0.0.1:3200 with a faked Privy
 * verifier (the real Next routes need a Privy app). Anvil only. Only anvil's public default mnemonic is used.
 *
 *   pnpm --filter web exec tsx scripts/anvil-playground.ts
 *
 * Web side: HUISAFE_NETWORK=anvil pnpm --filter web exec next dev -p 3300, then forward the browser's `/api/relay` and
 * `/api/attest` to port 3200 (playwright `page.route`). Members M1..M5 are dev accounts 5..9 of the wallet picker.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createPublicClient, createWalletClient, http, stringToHex, toHex, type Hex, type PublicClient } from 'viem';
import { mnemonicToAccount, type HDAccount } from 'viem/accounts';
import { loadAddresses } from 'config/addresses';
import { resolveNetwork } from 'config/network';
import { buildTermsText, erc2771ForwarderAbi, huiFactoryAbi, memorySaltStore, mockUsdcAbi, termsHashOf, type FetchLike } from 'sdk';
import { createChainConfig } from '../lib/chain/config';
import { devWallet } from '../lib/chain/wallet';
import { activate, createCircle, depositBond, join, type TxContext } from '../lib/chain/write';
import { createAttestHandler } from '../lib/server/attest';
import { anvilChain } from '../lib/server/chain';
import { createRelayHandler } from '../lib/server/relay';
import { SlidingWindowLimiter } from '../lib/server/ratelimit';
import { InvalidTokenError, type PrivyVerifier } from '../lib/server/privy';

const MNEMONIC = 'test test test test test test test test test test test junk';
const RPC = 'http://127.0.0.1:8545';
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CONTRACTS = `${ROOT}contracts`;
const FOUNDRY_BIN = `${process.env.HOME}/.foundry/bin`;
const ONE = 1_000_000n;
const hd = (i: number): HDAccount => mnemonicToAccount(MNEMONIC, { addressIndex: i });
const keyOf = (a: HDAccount): Hex => toHex(a.getHdKey().privateKey!);
const [deployer, attester, relayer, , organizer] = [hd(0), hd(1), hd(2), hd(3), hd(4)];
const M = [hd(5), hd(6), hd(7), hd(8), hd(9)];

const baseEnv = (): NodeJS.ProcessEnv => {
  if (process.platform !== 'win32') {
    return { PATH: `${FOUNDRY_BIN}:${process.env.PATH ?? ''}`, HOME: process.env.HOME ?? '', NODE_ENV: 'development' } as NodeJS.ProcessEnv;
  }
  // Windows (same fix as e2e-anvil.ts): PATH is ';'-separated and cmd.exe, pnpm.cmd and forge need the system variables.
  const vars: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'development' };
  const pathKey = Object.keys(vars).find((k) => k.toLowerCase() === 'path') ?? 'PATH';
  vars[pathKey] = `${FOUNDRY_BIN};${vars[pathKey] ?? ''}`;
  return vars;
};
function run(cmd: string, args: string[], env: Record<string, string>): void {
  const r = spawnSync(cmd, args, { cwd: CONTRACTS, env: { ...baseEnv(), ...env }, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} failed:\n${(r.stdout ?? '').slice(-1200)}\n${(r.stderr ?? '').slice(-1200)}`);
}
const rpcUp = async (): Promise<boolean> => {
  try {
    return (await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }) })).ok;
  } catch {
    return false;
  }
};

async function main(): Promise<void> {
  if (await rpcUp()) throw new Error('something already listens on 127.0.0.1:8545');
  spawn('anvil', ['--silent', '--port', '8545', '--chain-id', '31337', '--block-time', '2'], { env: baseEnv(), stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await rpcUp()); i++) await new Promise((r) => setTimeout(r, 250));

  const deployFile = `${CONTRACTS}/deployments/anvil.json`;
  if (existsSync(deployFile)) rmSync(deployFile);
  run('forge', ['script', 'script/Deploy.s.sol', '--rpc-url', RPC, '--broadcast'], {
    DEPLOYER_PRIVATE_KEY: keyOf(deployer),
    ATTESTER_ADDRESS: attester.address,
    RELAYER_ADDRESS: relayer.address,
    GIT_COMMIT: 'playground',
    // Same floor as Fuji (ADR-22) unless overridden, so the activation checks in the UI match what ships.
    MIN_COVERAGE_BPS: process.env.PLAYGROUND_MIN_COVERAGE_BPS ?? '10000',
  });
  run('forge', ['script', 'script/CreateDemoCircle.s.sol', '--rpc-url', RPC, '--broadcast'], { DEMO_ORGANIZER_PRIVATE_KEY: keyOf(organizer) });

  const network = resolveNetwork({ HUISAFE_NETWORK: 'anvil' });
  const dep = loadAddresses(network.deploymentFile, [network.chainId]);
  if (!dep.deployed || !dep.factory || !dep.forwarder || !dep.usdc || !dep.reputation) throw new Error('anvil.json incomplete');
  const { factory, forwarder, usdc, reputation } = dep;
  const pub = createPublicClient({ chain: anvilChain, transport: http(RPC) }) as PublicClient;
  const wallet = (a: HDAccount) => createWalletClient({ account: a, chain: anvilChain, transport: http(RPC) });
  const circle = (await pub.readContract({ address: factory, abi: huiFactoryAbi, functionName: 'allCircles' }))[0]!;
  for (const m of [...M, organizer]) {
    const h = await wallet(deployer).writeContract({ address: usdc, abi: mockUsdcAbi, functionName: 'mint', args: [m.address, 100n * ONE] });
    await pub.waitForTransactionReceipt({ hash: h });
  }

  const verifier: PrivyVerifier = {
    async verifyToken(token) {
      if (token === 'organizer') return { userId: 'did:privy:pg-org' };
      const i = Number(/^member-(\d)$/.exec(token)?.[1] ?? -1);
      if (!M[i - 1]) throw new InvalidTokenError('unknown token');
      return { userId: `did:privy:pg-${i}` };
    },
    async walletOf(userId) {
      return userId.endsWith('org') ? organizer.address : M[Number(userId.slice(-1)) - 1]!.address;
    },
  };
  const quiet = () => undefined;
  const attestHandler = createAttestHandler({
    verifier,
    attester: { address: attester.address, signTypedData: (a) => attester.signTypedData(a) },
    idSecret: 'playground-secret',
    chainId: network.chainId,
    isCircle: (c) => pub.readContract({ address: factory, abi: huiFactoryAbi, functionName: 'isCircle', args: [c] }),
    userLimiter: new SlidingWindowLimiter(1000),
    ipLimiter: new SlidingWindowLimiter(1000),
    now: Date.now,
    requestId: (() => { let n = 0; return () => `a-${++n}`; })(),
    log: quiet,
  });
  const relayWallet = wallet(relayer);
  const relayHandler = createRelayHandler({
    publicClient: pub,
    factory,
    forwarder,
    sender: { address: relayer.address, execute: ({ forwarder: f, request, gas }) => relayWallet.writeContract({ address: f, abi: erc2771ForwarderAbi, functionName: 'execute', args: [request], gas }) },
    limiter: new SlidingWindowLimiter(1000),
    ipLimiter: new SlidingWindowLimiter(1000),
    globalLimiter: new SlidingWindowLimiter(1000),
    verifier,
    createLimiter: new SlidingWindowLimiter(50),
    now: Date.now,
    requestId: (() => { let n = 0; return () => `r-${++n}`; })(),
    log: quiet,
  });

  const fetchFn: FetchLike = async (url, init) => {
    const req = new Request(url, { method: init.method, headers: init.headers, body: init.body });
    return url.endsWith('/api/attest') ? attestHandler(req) : relayHandler(req);
  };
  const chainCfg = createChainConfig({ network: 'anvil', chainId: network.chainId, factory, registry: reputation, usdc, forwarder, fromBlock: '0', vndPerUsdc: 26_000, pollMs: 2000 });
  const saltStore = memorySaltStore();
  const ctx = (i: number): TxContext => ({
    chain: chainCfg,
    wallet: devWallet(i < 0 ? 4 : 5 + i, network.chainId),
    getAccessToken: async () => (i < 0 ? 'organizer' : `member-${i + 1}`),
    fetchFn,
    relayUrl: 'http://x/api/relay',
    attestUrl: 'http://x/api/attest',
    saltStore,
  });
  for (let i = 0; i < 5; i++) {
    const r = await join(ctx(i), circle, { ageConfirmed: true });
    if (!r.ok) throw new Error(`join M${i + 1}: ${r.code} ${r.message}`);
  }
  const act = await activate(ctx(-1), circle);
  if (!act.ok) throw new Error(`activate: ${act.code} ${act.message}`);

  // A second circle that is still gathering people (organizer = account 4, M1 already in): for the forming / invite screens.
  const now = Number((await pub.getBlock()).timestamp);
  // The terms hash must be the hash of the standard terms text, or the invite page shows "Không khớp thỏa thuận" and
  // disables "Vào dây" (ADR-27), and the join flow cannot be tried on the playground (issue #8).
  const secondTerms = {
    mode: 'bidding' as const, memberCount: 5, contribution: 10n * ONE, periodSeconds: 30 * 86_400, roundDuration: 180, commitWindow: 90,
    revealWindow: 60, graceSeconds: 120, alphaBps: 2000, commissionMode: true, feeBps: 100, commissionShareBps: 0, reserveBps: 100,
    revealBondBps: 100, capBps: 2000,
  };
  const second = await createCircle(ctx(-1), {
    ...secondTerms, mode: 1,
    joinDeadline: BigInt(now + 3600), organizerIsMember: false, label: stringToHex('Hụi đang gom', { size: 32 }),
    termsHash: termsHashOf(buildTermsText(secondTerms)),
  });
  if (!second.ok) throw new Error(`second circle: ${second.code} ${second.message}`);
  const dep2 = await depositBond(ctx(-1), second.circle, 16n * ONE);
  if (!dep2.ok) throw new Error(`second bond: ${dep2.code} ${dep2.message}`);
  const j2 = await join(ctx(0), second.circle, { ageConfirmed: true });
  if (!j2.ok) throw new Error(`second join: ${j2.code} ${j2.message}`);

  createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const r = new Request(`http://x${req.url}`, { method: req.method, headers: { 'content-type': 'application/json', ...(req.headers.authorization ? { authorization: String(req.headers.authorization) } : {}) }, body: req.method === 'POST' ? Buffer.concat(chunks).toString() : undefined });
    const out = req.url?.startsWith('/api/attest') ? await attestHandler(r) : await relayHandler(r);
    res.writeHead(out.status, { 'content-type': 'application/json' });
    res.end(await out.text());
  }).listen(3200, '127.0.0.1');
  console.log(`PLAYGROUND READY circle=${circle} forming=${second.circle} factory=${factory} api=http://127.0.0.1:3200 (dev accounts 5..9 = M1..M5, 4 = organizer)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
