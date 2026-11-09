/**
 * Chain access for the server routes: network from env (Fuji by default, local anvil for rehearsal), deployment
 * addresses from `contracts/deployments/<network>.json`, and a viem public client with RPC fallback.
 * No secret is read here; keys are read in `env.ts`.
 */
import { createPublicClient, defineChain, fallback, http, type Chain, type PublicClient } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { loadAddresses, type Addresses } from 'config/addresses';
import { resolveNetwork, type Network } from 'config/network';

type Address = `0x${string}`;

export class ConfigError extends Error {}

export const anvilChain: Chain = defineChain({
  id: 31337,
  name: 'Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
});

export function chainFor(network: Network): Chain {
  return network.name === 'anvil' ? anvilChain : avalancheFuji;
}

export function makePublicClient(network: Network): PublicClient {
  const transports = network.rpcUrls.map((u) => http(u));
  return createPublicClient({
    chain: chainFor(network),
    transport: transports.length > 1 ? fallback(transports) : transports[0]!,
  }) as PublicClient;
}

export interface Deployment {
  network: Network;
  factory: Address;
  forwarder: Address;
  usdc: Address;
}

/** Throws ConfigError (Vietnamese message) when the network has no deployment file yet. */
export function loadDeployment(network: Network = resolveNetwork()): Deployment {
  const a: Addresses = loadAddresses(network.deploymentFile, [network.chainId]);
  if (!a.deployed || !a.factory || !a.forwarder || !a.usdc) {
    throw new ConfigError('Hệ thống chưa được triển khai trên mạng này.');
  }
  return { network, factory: a.factory, forwarder: a.forwarder, usdc: a.usdc };
}
