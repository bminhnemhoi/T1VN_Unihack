import { describe, expect, it } from 'vitest';
import { ANVIL_CHAIN_ID, DevWalletError, devWallet } from './wallet';

const FUJI = 43113;
const MAINNET = 43114;

const typed = (chainId: number) => ({
  domain: { name: 'HuiSafeForwarder', version: '1', chainId, verifyingContract: '0x0000000000000000000000000000000000000001' },
  types: { Ping: [{ name: 'n', type: 'uint256' }] },
  primaryType: 'Ping',
  message: { n: 1n },
});

describe('devWallet', () => {
  it('uses anvil default accounts by index (index 0 is the well-known first account)', () => {
    expect(devWallet(0, ANVIL_CHAIN_ID).address).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    expect(devWallet(5, ANVIL_CHAIN_ID).address).not.toBe(devWallet(6, ANVIL_CHAIN_ID).address);
  });
  it('refuses to exist on Fuji, mainnet or any non-anvil chain', () => {
    for (const id of [FUJI, MAINNET, 1]) expect(() => devWallet(0, id)).toThrow(DevWalletError);
  });
  it('refuses an index outside the ten funded accounts', () => {
    expect(() => devWallet(10, ANVIL_CHAIN_ID)).toThrow(DevWalletError);
    expect(() => devWallet(-1, ANVIL_CHAIN_ID)).toThrow(DevWalletError);
  });
  it('signs anvil-domain data and refuses other chain domains', async () => {
    const w = devWallet(5, ANVIL_CHAIN_ID);
    expect(await w.signer.signTypedData(typed(ANVIL_CHAIN_ID) as never)).toMatch(/^0x[0-9a-f]{130}$/);
    await expect(w.signer.signTypedData(typed(FUJI) as never)).rejects.toThrow(DevWalletError);
    await expect(w.signer.signTypedData(typed(MAINNET) as never)).rejects.toThrow(DevWalletError);
    const noDomainChain = { ...typed(1), domain: { name: 'x' } };
    await expect(w.signer.signTypedData(noDomainChain as never)).rejects.toThrow(DevWalletError);
  });
});
