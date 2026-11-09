/**
 * Wallet seam for the write side (A11, W2). `HuiWallet` is all the flows need: an address, a chain id and a typed-data
 * signer. Two implementations: the Privy embedded wallet (`walletProvider.tsx`) and the dev wallet below, which works
 * ONLY on the local anvil chain (31337) and signs nothing for any other chain id.
 *
 * The anvil mnemonic is the public default of every anvil node ("test test ... junk"). It holds no value outside a
 * local node and is not a secret; no `.env*` file is read here.
 */
import { mnemonicToAccount } from 'viem/accounts';
import type { TypedDataSigner } from 'sdk';

type Address = `0x${string}`;

export const ANVIL_CHAIN_ID = 31337;
const ANVIL_MNEMONIC = 'test test test test test test test test test test test junk';

export interface HuiWallet {
  kind: 'privy' | 'dev';
  address: Address;
  chainId: number;
  signer: TypedDataSigner;
}

export class DevWalletError extends Error {}

/**
 * Anvil default test account `index` (0..9 are funded). Throws unless `chainId` is the local anvil chain or when the
 * bundle is a production build; its signer also refuses any typed data whose domain names another chain.
 */
export function devWallet(index: number, chainId: number): HuiWallet {
  if (chainId !== ANVIL_CHAIN_ID) throw new DevWalletError('Ví thử nghiệm chỉ chạy trên mạng cục bộ (anvil).');
  if (process.env.NODE_ENV === 'production') throw new DevWalletError('Ví thử nghiệm không có trong bản chính thức.');
  if (!Number.isInteger(index) || index < 0 || index > 9) throw new DevWalletError('Chỉ số ví thử nghiệm phải từ 0 đến 9.');
  const account = mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: index });
  const signer: TypedDataSigner = {
    address: account.address,
    async signTypedData(args) {
      const domainChain = args.domain.chainId;
      if (domainChain === undefined || Number(domainChain) !== ANVIL_CHAIN_ID) {
        throw new DevWalletError('Ví thử nghiệm từ chối ký cho mạng khác anvil.');
      }
      return account.signTypedData(args as never);
    },
  };
  return { kind: 'dev', address: account.address, chainId, signer };
}
