/**
 * Which chain the server code (relay, attest, keeper) talks to. Fuji is the default and the only public network;
 * `anvil` (31337) exists so the whole flow can be rehearsed on a local node (docs/04 section 7.5). Any other value,
 * mainnet included, is rejected (CLAUDE.md hard rule 1). Reads only non-secret variables.
 */
import { join } from 'node:path';
import { deploymentsDir } from './paths';

export type NetworkName = 'fuji' | 'anvil';

export interface Network {
  name: NetworkName;
  chainId: number;
  /** Primary RPC, then an optional fallback. */
  rpcUrls: string[];
  /** Absolute path of `contracts/deployments/<name>.json`. */
  deploymentFile: string;
}

const PUBLIC_FUJI_RPC = 'https://api.avax-test.network/ext/bc/C/rpc';
const LOCAL_RPC = 'http://127.0.0.1:8545';
const MAINNET_RPC = /avax\.network|avalanche-mainnet|avax-mainnet/i;

/** True for an Avalanche mainnet endpoint. The Fuji endpoint is "avax-test.network"; "avax.network" without "test" is mainnet. */
const isMainnetRpc = (u: string): boolean => MAINNET_RPC.test(u) && !/avax-test\.network/i.test(u);

const deploymentPath = (name: NetworkName, env: Record<string, string | undefined>): string =>
  join(deploymentsDir(process.cwd(), env), `${name}.json`);

export class NetworkError extends Error {}

export function resolveNetwork(env: Record<string, string | undefined> = process.env): Network {
  const name = (env.HUISAFE_NETWORK ?? 'fuji').trim().toLowerCase();
  if (name === 'fuji') {
    const rpcUrls = [env.FUJI_RPC_URL || PUBLIC_FUJI_RPC];
    if (env.FUJI_RPC_URL_FALLBACK) rpcUrls.push(env.FUJI_RPC_URL_FALLBACK);
    // The Fuji endpoint is "avax-test.network"; "avax.network" without the test suffix is mainnet.
    for (const u of rpcUrls) {
      if (isMainnetRpc(u)) throw new NetworkError('RPC URL points at Avalanche mainnet; HụiSafe runs on Fuji only');
    }
    return { name: 'fuji', chainId: 43113, rpcUrls, deploymentFile: deploymentPath('fuji', env) };
  }
  if (name === 'anvil') {
    const url = env.ANVIL_RPC_URL || LOCAL_RPC;
    if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url)) {
      throw new NetworkError('ANVIL_RPC_URL must be a local address');
    }
    return { name: 'anvil', chainId: 31337, rpcUrls: [url], deploymentFile: deploymentPath('anvil', env) };
  }
  throw new NetworkError(`HUISAFE_NETWORK must be "fuji" or "anvil", got "${name}"`);
}

/**
 * The RPC the BROWSER reads from (`NEXT_PUBLIC_FUJI_RPC_URL`), or `undefined` for the library default (Fuji's public RPC).
 * It is a PUBLIC variable: Next inlines it into the browser bundle at build time, so anyone can read it. Never put an RPC
 * URL that carries an API key in the path or query here (docs/HOSTING.md section 6); use a provider's keyless public or
 * origin-restricted endpoint. The server keeps using `FUJI_RPC_URL` and `FUJI_RPC_URL_FALLBACK` (never sent to the browser).
 * Only Fuji reads it (anvil always uses the local node). Rejected, with a `NetworkError`: not a URL, not https (plain http
 * only for localhost), credentials in the URL, or a mainnet endpoint.
 */
export function resolveBrowserRpc(env: Record<string, string | undefined> = process.env): string | undefined {
  const name = (env.HUISAFE_NETWORK ?? 'fuji').trim().toLowerCase();
  const raw = env.NEXT_PUBLIC_FUJI_RPC_URL?.trim();
  if (name !== 'fuji' || !raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new NetworkError('NEXT_PUBLIC_FUJI_RPC_URL is not a valid URL');
  }
  const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    throw new NetworkError('NEXT_PUBLIC_FUJI_RPC_URL must be https (http only for localhost)');
  }
  if (url.username || url.password) {
    throw new NetworkError('NEXT_PUBLIC_FUJI_RPC_URL must not carry credentials: the value is public');
  }
  if (isMainnetRpc(raw)) {
    throw new NetworkError('NEXT_PUBLIC_FUJI_RPC_URL points at Avalanche mainnet; HụiSafe runs on Fuji only');
  }
  return raw;
}
