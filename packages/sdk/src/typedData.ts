/** EIP-712 typed data (docs/05 section 5). Domain name "HuiSafe", version "1". `chainId` defaults to Fuji; only the
 * local anvil rehearsal passes 31337. */
import { FUJI_CHAIN_ID } from 'config';

export const attestationTypes = {
  MemberAttestation: [
    { name: 'member', type: 'address' },
    { name: 'circle', type: 'address' },
    { name: 'attestationId', type: 'bytes32' },
    { name: 'expiry', type: 'uint64' },
  ],
} as const;

export const permitTypes = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export const forwardRequestTypes = {
  ForwardRequest: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'gas', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint48' },
    { name: 'data', type: 'bytes' },
  ],
} as const;

type Address = `0x${string}`;

/** Domain of `MemberAttestation`: the circle clone verifies it. */
export const huiSafeDomain = (circle: Address, chainId: number = FUJI_CHAIN_ID) =>
  ({
    name: 'HuiSafe',
    version: '1',
    chainId,
    verifyingContract: circle,
  }) as const;

/** Domain of the ERC-2771 forwarder, deployed as `ERC2771Forwarder("HuiSafeForwarder")`. */
export const forwarderDomain = (forwarder: Address, chainId: number = FUJI_CHAIN_ID) =>
  ({
    name: 'HuiSafeForwarder',
    version: '1',
    chainId,
    verifyingContract: forwarder,
  }) as const;

/** USDC permit domain. `name` and `version` must be read from the token at runtime ("2" on Circle USDC). */
export const usdcPermitDomain = (
  usdc: Address,
  name: string,
  version: string,
  chainId: number = FUJI_CHAIN_ID,
) =>
  ({
    name,
    version,
    chainId,
    verifyingContract: usdc,
  }) as const;
