/**
 * Client-side signing helpers (docs/05 section 5, skill web3-frontend sections 3 and 4): the EIP-2612 permit for the
 * USDC allowance and the ERC-2771 forward request. They work with any viem account (Privy embedded wallet in the
 * browser, a local account in tests). `chainId` defaults to Fuji; the local anvil rehearsal passes 31337.
 */
import { encodeFunctionData, parseSignature, type Account, type PublicClient, type WalletClient } from 'viem';
import { FUJI_CHAIN_ID } from 'config';
import { erc2771ForwarderAbi, huiCircleAbi, mockUsdcAbi } from './generated';
import { forwardRequestTypes, forwarderDomain, permitTypes, usdcPermitDomain } from './typedData';

type Address = `0x${string}`;
type Hex = `0x${string}`;

export interface PermitArg {
  value: bigint;
  deadline: bigint;
  v: number;
  r: Hex;
  s: Hex;
}

export interface ForwardRequestJson {
  from: Address;
  to: Address;
  value: '0';
  gas: string;
  deadline: number;
  data: Hex;
}

/** Anything that can sign EIP-712 typed data for one address: a Privy embedded wallet, a dev wallet, a viem account. */
export interface TypedDataSigner {
  address: Address;
  signTypedData(args: {
    domain: Record<string, unknown>;
    types: Record<string, readonly { name: string; type: string }[]>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<Hex>;
}

export interface SignContext {
  publicClient: PublicClient;
  /** Either `signer`, or `walletClient` + `account` (the original form, still used by tests). */
  signer?: TypedDataSigner;
  walletClient?: WalletClient;
  account?: Account;
  chainId?: number;
}

const signerAddress = (ctx: SignContext): Address => {
  const a = ctx.signer?.address ?? ctx.account?.address;
  if (!a) throw new Error('SignContext needs a signer or an account');
  return a;
};

async function signTyped(
  ctx: SignContext,
  args: Parameters<TypedDataSigner['signTypedData']>[0],
): Promise<Hex> {
  if (ctx.signer) return ctx.signer.signTypedData(args);
  if (!ctx.walletClient || !ctx.account) throw new Error('SignContext needs a signer or an account');
  return ctx.walletClient.signTypedData({ account: ctx.account, ...args } as never);
}

/** Sign a permit that lets `circle` pull `value` USDC base units from the account. The domain is read from the token. */
export async function signPermit(
  ctx: SignContext,
  usdc: Address,
  circle: Address,
  value: bigint,
  deadlineSec: bigint,
): Promise<PermitArg> {
  const chainId = ctx.chainId ?? FUJI_CHAIN_ID;
  const owner = signerAddress(ctx);
  const [name, version, nonce] = await Promise.all([
    ctx.publicClient.readContract({ address: usdc, abi: mockUsdcAbi, functionName: 'name' }),
    ctx.publicClient.readContract({ address: usdc, abi: mockUsdcAbi, functionName: 'version' }),
    ctx.publicClient.readContract({ address: usdc, abi: mockUsdcAbi, functionName: 'nonces', args: [owner] }),
  ]);
  const signature = await signTyped(ctx, {
    domain: usdcPermitDomain(usdc, name, version, chainId),
    types: permitTypes,
    primaryType: 'Permit',
    message: { owner, spender: circle, value, nonce, deadline: deadlineSec },
  });
  const { r, s, v, yParity } = parseSignature(signature);
  return { value, deadline: deadlineSec, v: Number(v ?? BigInt((yParity ?? 0) + 27)), r, s };
}

/**
 * Build and sign a forward request for `circle`/`factory` call data. The returned `request` and `signature` are the
 * JSON body of `POST /api/relay` (docs/05 section 8.2).
 */
export async function signForwardRequest(
  ctx: SignContext,
  forwarder: Address,
  to: Address,
  data: Hex,
  opts: { gas?: bigint; deadlineSec: number },
): Promise<{ request: ForwardRequestJson; signature: Hex }> {
  const chainId = ctx.chainId ?? FUJI_CHAIN_ID;
  const from = signerAddress(ctx);
  const nonce = await ctx.publicClient.readContract({
    address: forwarder,
    abi: erc2771ForwarderAbi,
    functionName: 'nonces',
    args: [from],
  });
  const gas = opts.gas ?? 500_000n;
  const signature = await signTyped(ctx, {
    domain: forwarderDomain(forwarder, chainId),
    types: forwardRequestTypes,
    primaryType: 'ForwardRequest',
    message: { from, to, value: 0n, gas, nonce, deadline: opts.deadlineSec, data },
  });
  return {
    request: { from, to, value: '0', gas: gas.toString(), deadline: opts.deadlineSec, data },
    signature,
  };
}

/** Call data of `join(att, attSig, permit)`; shared by the UI and the local rehearsal. */
export function encodeJoin(
  att: { member: Address; circle: Address; attestationId: Hex; expiry: bigint },
  attSig: Hex,
  permit: PermitArg,
): Hex {
  return encodeFunctionData({ abi: huiCircleAbi, functionName: 'join', args: [att, attSig, permit] });
}
