/**
 * Keeper configuration from environment variable NAMES only (docs/04 section 7.4, ADR-21): the keeper has its own
 * testnet wallet `KEEPER_PRIVATE_KEY`, separate from deployer, relayer and attester. Nothing here prints a value.
 */
import { resolveNetwork, type Network } from 'config/network';

export const GAS_HARD_CAP = 5_000_000n;
/** Estimate x 1.2 (docs/04 section 7.1). */
export const GAS_MARGIN_NUM = 12n;
export const GAS_MARGIN_DEN = 10n;

export interface KeeperConfig {
  network: Network;
  privateKey: `0x${string}`;
  /** Scan period in seconds: 15 in demo mode, 300 for real circles (docs/05 section 9). */
  intervalSeconds: number;
}

export class KeeperConfigError extends Error {}

export function loadKeeperConfig(env: Record<string, string | undefined> = process.env): KeeperConfig {
  const network = resolveNetwork(env);
  const key = env.KEEPER_PRIVATE_KEY;
  if (!key) throw new KeeperConfigError('missing environment variable KEEPER_PRIVATE_KEY');
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new KeeperConfigError('KEEPER_PRIVATE_KEY is not a 32-byte hex key');
  const raw = env.KEEPER_INTERVAL_SECONDS;
  const intervalSeconds = raw === undefined || raw === '' ? 15 : Number(raw);
  if (!Number.isInteger(intervalSeconds) || intervalSeconds < 1 || intervalSeconds > 3600) {
    throw new KeeperConfigError('KEEPER_INTERVAL_SECONDS must be an integer from 1 to 3600');
  }
  return { network, privateKey: key as `0x${string}`, intervalSeconds };
}
