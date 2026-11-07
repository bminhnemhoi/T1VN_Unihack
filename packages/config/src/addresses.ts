/**
 * Deployed addresses come only from `contracts/deployments/fuji.json` (docs/05 section 6.2).
 * Nothing is hard-coded here: before the first deploy every address is undefined and `deployed` is false.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

type Address = `0x${string}`;

export interface Addresses {
  /** false until `contracts/deployments/fuji.json` exists and is valid. UI shows "chưa triển khai". */
  deployed: boolean;
  chainId?: number;
  usdc?: Address;
  forwarder?: Address;
  reputation?: Address;
  circleImplementation?: Address;
  factory?: Address;
  admin?: Address;
  attester?: Address;
  relayer?: Address;
  deployedAt?: string;
  gitCommit?: string;
}

const ADDRESS_KEYS = [
  'usdc',
  'forwarder',
  'reputation',
  'circleImplementation',
  'factory',
  'admin',
  'attester',
  'relayer',
] as const;

const isAddress = (v: unknown): v is Address =>
  typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v) && !/^0x0{40}$/.test(v);

export const NOT_DEPLOYED: Addresses = Object.freeze({ deployed: false });

/** Parse the JSON text of a deployment file. Returns NOT_DEPLOYED when it is not a Fuji deployment with core addresses. */
export function parseDeployment(text: string): Addresses {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return NOT_DEPLOYED;
  }
  if (typeof raw !== 'object' || raw === null) return NOT_DEPLOYED;
  const r = raw as Record<string, unknown>;
  if (r.chainId !== 43113) return NOT_DEPLOYED;
  const out: Addresses = { deployed: false, chainId: 43113 };
  for (const key of ADDRESS_KEYS) {
    if (isAddress(r[key])) out[key] = r[key];
  }
  if (typeof r.deployedAt === 'string') out.deployedAt = r.deployedAt;
  if (typeof r.gitCommit === 'string') out.gitCommit = r.gitCommit;
  out.deployed = Boolean(out.factory && out.forwarder && out.usdc && out.reputation);
  return out.deployed ? out : NOT_DEPLOYED;
}

/** Read `contracts/deployments/fuji.json` (server, keeper, tests). Missing file means not deployed. */
export function loadAddresses(path?: string): Addresses {
  const file =
    path ?? fileURLToPath(new URL('../../../contracts/deployments/fuji.json', import.meta.url));
  if (!existsSync(file)) return NOT_DEPLOYED;
  return parseDeployment(readFileSync(file, 'utf8'));
}
