import { FUJI } from './chains';

/**
 * Circles run end to end on Avalanche Fuji by the team's demo wallets, shown as public proof on the landing page and
 * in the submission (docs/DEPLOY-FUJI.md sections 15 and 15b). Both are Completed, so these addresses never change.
 */
export const FUJI_EVIDENCE = {
  /** docs/03 section 8 branch B at C = 10 USDC: M4 defaults, the cascade covers 8 from holdback + 2 from the bond. */
  defaultCircle: '0xc62828b2f72D288298A6E2fFd0814D0Cb6e15Bfc',
  /** Fixed circle, 3 members, 3 rounds, finalized with the contract balance back to 0. */
  fixedCircle: '0xABA89dFfA4e157927710419b01C32bD307bF2461',
} as const satisfies Record<string, `0x${string}`>;

/** Snowtrace page of an address on Fuji. */
export function fujiAddressUrl(address: `0x${string}`): string {
  return `${FUJI.explorer}/address/${address}`;
}
