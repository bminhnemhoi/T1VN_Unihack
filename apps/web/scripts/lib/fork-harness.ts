/**
 * Local-node helpers for the scripts that rehearse the Fuji night on an anvil that FORKS Fuji (chain id 43113):
 * start the fork, run a `forge script` against it, and put a USDC balance on Circle's real FiatToken. Nothing here talks
 * to a real network except the fork's own read-only state fetches from the public Fuji RPC (override with
 * `REHEARSAL_FORK_URL`; a mainnet URL is refused). Only anvil's public default mnemonic is used.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { concat, keccak256, pad, toHex, type Hex } from 'viem';
import { mnemonicToAccount, type HDAccount } from 'viem/accounts';

type Address = `0x${string}`;

export const MNEMONIC = 'test test test test test test test test test test test junk'; // anvil's public default
export const RPC = 'http://127.0.0.1:8545';
export const FORK_URL = process.env.REHEARSAL_FORK_URL ?? 'https://api.avax-test.network/ext/bc/C/rpc';
export const FOUNDRY_BIN = `${process.env.HOME}/.foundry/bin`;
export const FUJI_USDC: Address = '0x5425890298aed601595a70AB815c96711a31Bc65';

export const hd = (i: number): HDAccount => mnemonicToAccount(MNEMONIC, { addressIndex: i });
export const keyOf = (a: HDAccount): Hex => toHex(a.getHdKey().privateKey!);

/** Minimal environment for children: nothing the operator exported (real keys, DEPLOY_OUT ...) leaks into them. */
export const baseEnv = (): NodeJS.ProcessEnv =>
  ({ PATH: `${FOUNDRY_BIN}:${process.env.PATH ?? ''}`, HOME: process.env.HOME ?? '', NODE_ENV: 'development' }) as NodeJS.ProcessEnv;

export async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
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

export function killChild(child: ChildProcess): void {
  try {
    child.kill('SIGTERM');
  } catch {
    /* already gone */
  }
}

/** Starts anvil forking Fuji on 127.0.0.1:8545 with chain id 43113. Fuji's gas price is about 160 wei. */
export async function startForkAnvil(): Promise<ChildProcess> {
  if (/(^|\.)avax\.network/i.test(new URL(FORK_URL).hostname) && !/avax-test\.network/i.test(FORK_URL)) {
    throw new Error('REHEARSAL_FORK_URL points at Avalanche mainnet; the rehearsal forks Fuji only');
  }
  if (await rpcUp()) throw new Error('something already listens on 127.0.0.1:8545; stop it first');
  const child = spawn('anvil', ['--silent', '--port', '8545', '--chain-id', '43113', '--fork-url', FORK_URL, '--base-fee', '160', '--gas-price', '160'], { env: baseEnv(), stdio: 'ignore' });
  for (let i = 0; i < 120; i++) {
    if (await rpcUp()) {
      if ((await rpc<string>('eth_chainId')) === '0xa869') return child;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  killChild(child);
  throw new Error('anvil fork of Fuji did not start (is the fork URL reachable?)');
}

/** `forge script <script> --rpc-url <local node> --broadcast`; keys travel in the child environment, never on the command line. */
export function forgeScript(cwd: string, broadcastDir: string, script: string, vars: Record<string, string>): string {
  const r = spawnSync('forge', ['script', script, '--rpc-url', RPC, '--broadcast'], {
    cwd,
    env: { ...baseEnv(), FOUNDRY_BROADCAST: broadcastDir, ...vars },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`forge ${script} failed:\n${(r.stdout ?? '').slice(-2000)}\n${(r.stderr ?? '').slice(-2000)}`);
  return r.stdout ?? '';
}

/**
 * Finds the balance slot of Circle's USDC by trial (it differs between FiatToken versions) and sets a balance.
 * `read` returns the current balance of `who`.
 */
export async function setUsdcBalance(read: () => Promise<bigint>, who: Address, amount: bigint): Promise<void> {
  if ((await read()) === amount) return;
  for (let slot = 0n; slot < 20n; slot++) {
    const key = keccak256(concat([pad(who, { size: 32 }), pad(toHex(slot), { size: 32 })]));
    const old = await rpc<Hex>('eth_getStorageAt', [FUJI_USDC, key, 'latest']);
    await rpc('anvil_setStorageAt', [FUJI_USDC, key, pad(toHex(amount), { size: 32 })]);
    if ((await read()) === amount) return;
    await rpc('anvil_setStorageAt', [FUJI_USDC, key, pad(old, { size: 32 })]);
  }
  throw new Error('could not find the balance storage slot of USDC');
}
