export const FUJI = {
  id: 43113,
  name: 'Avalanche Fuji',
  rpc: process.env.FUJI_RPC_URL ?? 'https://api.avax-test.network/ext/bc/C/rpc',
  explorer: 'https://testnet.snowtrace.io',
  usdc: '0x5425890298aed601595a70AB815c96711a31Bc65', // kiểm lại tại developers.circle.com
} as const;

/**
 * Second keyless RPC the BROWSER falls back to when the first one throttles (issue #13: Fuji's public RPC limits per IP and
 * answers with a 429 page without CORS headers, which the browser reports as a network error). Public, no API key.
 */
export const FUJI_BROWSER_RPC_FALLBACK = 'https://avalanche-fuji-c-chain-rpc.publicnode.com';
