/**
 * Which chain the server code (relay, attest, keeper) talks to. Fuji is the default and the only public network;
 * `anvil` (31337) exists so the whole flow can be rehearsed on a local node (docs/04 section 7.5). Any other value,
 * mainnet included, is rejected (CLAUDE.md hard rule 1). Reads only non-secret variables.
 */
import { fileURLToPath } from 'node:url';

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

const deploymentPath = (name: NetworkName): string =>
  fileURLToPath(new URL(`../../../contracts/deployments/${name}.json`, import.meta.url));

export class NetworkError extends Error {}

export function resolveNetwork(env: Record<string, string | undefined> = process.env): Network {
  const name = (env.HUISAFE_NETWORK ?? 'fuji').trim().toLowerCase();
  if (name === 'fuji') {
    const rpcUrls = [env.FUJI_RPC_URL || PUBLIC_FUJI_RPC];
    if (env.FUJI_RPC_URL_FALLBACK) rpcUrls.push(env.FUJI_RPC_URL_FALLBACK);
    // The Fuji endpoint is "avax-test.network"; "avax.network" without the test suffix is mainnet.
    for (const u of rpcUrls) {
      if (MAINNET_RPC.test(u) && !/avax-test\.network/i.test(u)) {
        throw new NetworkError('RPC URL points at Avalanche mainnet; HụiSafe runs on Fuji only');
      }
    }
    return { name: 'fuji', chainId: 43113, rpcUrls, deploymentFile: deploymentPath('fuji') };
  }
  if (name === 'anvil') {
    const url = env.ANVIL_RPC_URL || LOCAL_RPC;
    if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url)) {
      throw new NetworkError('ANVIL_RPC_URL must be a local address');
    }
    return { name: 'anvil', chainId: 31337, rpcUrls: [url], deploymentFile: deploymentPath('anvil') };
  }
  throw new NetworkError(`HUISAFE_NETWORK must be "fuji" or "anvil", got "${name}"`);
}
