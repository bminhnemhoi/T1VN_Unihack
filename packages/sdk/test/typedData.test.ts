import { hashTypedData, keccak256, recoverTypedDataAddress, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { describe, expect, it } from 'vitest';
import {
  attestationTypes,
  forwardRequestTypes,
  forwarderDomain,
  huiSafeDomain,
  permitTypes,
  usdcPermitDomain,
} from '../src/typedData';

const circle = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const other = '0x3333333333333333333333333333333333333333' as `0x${string}`;
// Throwaway test key, not a real wallet.
const account = privateKeyToAccount(`0x${'11'.repeat(32)}`);

/** Canonical EIP-712 type string, e.g. "Permit(address owner,...)". */
const typeString = (primary: string, fields: readonly { name: string; type: string }[]) =>
  `${primary}(${fields.map((f) => `${f.type} ${f.name}`).join(',')})`;

describe('typed data', () => {
  // The same strings are hard-coded as typehashes in the contracts / OpenZeppelin.
  it('type strings match the on-chain typehash preimages', () => {
    expect(typeString('MemberAttestation', attestationTypes.MemberAttestation)).toBe(
      'MemberAttestation(address member,address circle,bytes32 attestationId,uint64 expiry)',
    );
    expect(typeString('Permit', permitTypes.Permit)).toBe(
      'Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)',
    );
    expect(typeString('ForwardRequest', forwardRequestTypes.ForwardRequest)).toBe(
      'ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,uint48 deadline,bytes data)',
    );
  });

  it('domains pin Fuji and the HuiSafe names', () => {
    expect(huiSafeDomain(circle)).toEqual({
      name: 'HuiSafe',
      version: '1',
      chainId: 43113,
      verifyingContract: circle,
    });
    expect(forwarderDomain(other).name).toBe('HuiSafeForwarder');
    expect(usdcPermitDomain(other, 'USD Coin', '2')).toMatchObject({ version: '2', chainId: 43113 });
  });

  it('an attestation signature recovers to the signer and binds the circle', async () => {
    const message = {
      member: account.address,
      circle,
      attestationId: keccak256(toHex('id')),
      expiry: 1_800_000_000n,
    };
    const signature = await account.signTypedData({
      domain: huiSafeDomain(circle),
      types: attestationTypes,
      primaryType: 'MemberAttestation',
      message,
    });
    const recovered = await recoverTypedDataAddress({
      domain: huiSafeDomain(circle),
      types: attestationTypes,
      primaryType: 'MemberAttestation',
      message,
      signature,
    });
    expect(recovered).toBe(account.address);
    const wrongCircle = await recoverTypedDataAddress({
      domain: huiSafeDomain(other),
      types: attestationTypes,
      primaryType: 'MemberAttestation',
      message,
      signature,
    });
    expect(wrongCircle).not.toBe(account.address);
  });

  it('forward request hashes deterministically and changes with calldata', () => {
    const request = {
      from: account.address,
      to: circle,
      value: 0n,
      gas: 500_000n,
      nonce: 0n,
      deadline: 1_800_000_000,
      data: '0x1234' as `0x${string}`,
    };
    const hash = (r: typeof request) =>
      hashTypedData({
        domain: forwarderDomain(other),
        types: forwardRequestTypes,
        primaryType: 'ForwardRequest',
        message: r,
      });
    expect(hash(request)).toBe(hash({ ...request }));
    expect(hash({ ...request, data: '0x1235' })).not.toBe(hash(request));
  });
});
