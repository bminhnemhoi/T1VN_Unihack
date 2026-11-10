/**
 * Browser-safe chain config for the read hooks. It carries addresses and a PUBLIC rpc only: server RPC URLs
 * (which may hold an API key) never reach the client. The server layout builds the JSON with `loadChainConfig()`
 * (`./server.ts`) and hands it to `<ChainProvider>`.
 */
import { createPublicClient, defineChain, http, type PublicClient } from 'viem';
import { avalancheFuji } from 'viem/chains';

type Address = `0x${string}`;

export interface ChainConfigJson {
  network: 'fuji' | 'anvil';
  chainId: number;
  factory: Address;
  registry: Address;
  usdc: Address;
  forwarder: Address;
  /** Block to start scanning events from (deployment block); "0" on anvil. */
  fromBlock: string;
  /** Reference rate used only for the Decree 19 Article 14 check, never displayed. */
  vndPerUsdc: number;
  /** Polling interval in ms; 5000 in demo mode (skill web3-frontend section 6). */
  pollMs: number;
}

export interface ChainConfig extends Omit<ChainConfigJson, 'fromBlock'> {
  fromBlock: bigint;
  client: PublicClient;
}

const anvil = defineChain({
  id: 31337,
  name: 'Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
});

/** Public RPC only: Fuji's public endpoint, or the local anvil node. */
export function createChainConfig(json: ChainConfigJson): ChainConfig {
  const chain = json.network === 'anvil' ? anvil : avalancheFuji;
  // One HTTP request per burst of reads: JSON-RPC batching, and Multicall3 (on Fuji) for contract reads in the same tick.
  // Fuji's public RPC answers a page that fires ~80 separate requests per refresh with throttling that reaches the
  // browser as a CORS error (A18, measured 11/11/2026), and the page then never loads. Anvil has no Multicall3: viem
  // skips it for chains without one.
  const client = createPublicClient({ chain, transport: http(undefined, { batch: true }), batch: { multicall: true } }) as PublicClient;
  return { ...json, fromBlock: BigInt(json.fromBlock), client };
}
