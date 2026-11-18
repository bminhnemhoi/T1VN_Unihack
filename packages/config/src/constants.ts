/** Shared protocol and demo constants (docs/03 sections 1 and 3.3, docs/05 section 7.2). */

export const BPS = 10_000;
export const USDC_DECIMALS = 6;
export const ONE_USDC = 1_000_000n;

/** Demo toggle timing (docs/03 section 3.3): 75s commit + 45s reveal = 120s round (0s dead gap), 60s grace. */
export const DEMO = {
  roundDuration: 120,
  commitWindow: 75,
  revealWindow: 45,
  graceSeconds: 60,
  periodSeconds: 30 * 24 * 60 * 60,
} as const;

/** Reference VND per USDC for display only (docs/05 section 7.2, `vndPerRound`). */
export const DEFAULT_VND_PER_USDC = 26_000;

/** ND 19/2019 Article 14 notification threshold per round, in VND. */
export const ND19_ARTICLE14_THRESHOLD_VND = 100_000_000;

/** Fuji only (CLAUDE.md hard rule 1). */
export const FUJI_CHAIN_ID = 43113;
