/** Avalanche C-Chain mainnet. Only a roadmap item here (hard rule 1): nothing in this project broadcasts to it. */
export const MAINNET_CHAIN_ID = 43114;

/**
 * Whether the `DEMO · Fuji` chip shows (B23). It shows on anything that is not mainnet, and whenever the demo flag
 * (`NEXT_PUBLIC_HUISAFE_DEMO === 'true'`) is on. No chain at all (nothing deployed, sample data) counts as not mainnet.
 */
export function isDemoBuild(chainId: number | null | undefined, flag: boolean): boolean {
  return chainId !== MAINNET_CHAIN_ID || flag;
}
