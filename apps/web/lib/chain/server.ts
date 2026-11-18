/**
 * Server-only (layout / route handlers): turn the network and deployment files into the JSON the browser needs.
 * Never import from a client component: it reads `fs` through `config`.
 */
import { loadAddresses } from 'config/addresses';
import { resolveBrowserRpc, resolveNetwork } from 'config/network';
import { DEFAULT_VND_PER_USDC } from 'config';
import type { ChainConfigJson } from './config';

/** `null` when the network has no deployment yet (screens then keep showing sample data / "chưa triển khai"). */
export function loadChainConfig(vars: Record<string, string | undefined> = process.env): ChainConfigJson | null {
  const network = resolveNetwork(vars);
  const a = loadAddresses(network.deploymentFile, [network.chainId]);
  if (!a.deployed || !a.factory || !a.reputation || !a.usdc || !a.forwarder) return null;
  const rpcUrl = resolveBrowserRpc(vars); // public variable; throws on a mainnet, http or credentialed URL
  return {
    network: network.name,
    chainId: network.chainId,
    factory: a.factory,
    registry: a.reputation,
    usdc: a.usdc,
    forwarder: a.forwarder,
    fromBlock: String(a.deployBlock ?? 0),
    vndPerUsdc: DEFAULT_VND_PER_USDC,
    pollMs: vars.NEXT_PUBLIC_HUISAFE_DEMO === 'true' || vars.HUISAFE_DEMO === 'true' ? 4_000 : 15_000,
    ...(rpcUrl ? { rpcUrl } : {}),
  };
}
