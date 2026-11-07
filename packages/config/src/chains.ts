export const FUJI = {
  id: 43113,
  name: 'Avalanche Fuji',
  rpc: process.env.FUJI_RPC_URL ?? 'https://api.avax-test.network/ext/bc/C/rpc',
  explorer: 'https://testnet.snowtrace.io',
  usdc: '0x5425890298aed601595a70AB815c96711a31Bc65', // kiểm lại tại developers.circle.com
} as const;
