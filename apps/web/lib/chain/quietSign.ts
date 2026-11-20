/**
 * Quiet signing (B28): the Privy embedded wallet may sign WITHOUT its own pop-up only for the two typed-data shapes
 * HụiSafe itself needs, and only when every address in them points back into HụiSafe. The app's own button and step
 * indicator (Ký -> Gửi -> Xác nhận) are the confirmation the user sees. Anything else, or any doubt, falls back to the
 * Privy pop-up so the user reads it themselves.
 *
 * A signature is valid on its own (anyone can send a signed request straight to the forwarder, or a permit straight
 * to USDC), so the relay allow-list is NOT the backstop here: this gate checks what the request does (audit B28 M-01):
 *  - ForwardRequest: function on the relay allow-list (circle user/public functions, factory `createCircle` only),
 *    gas <= 5M, deadline <= now + 10 min (+ clock skew);
 *  - Permit: deadline <= now + 1 h (+ skew), value <= 2 x the circle's `requiredAllowance()` (the cap the permit
 *    relay route uses); a larger permit (a big bond deposit) shows the Privy pop-up instead.
 *
 * Why this is safe:
 *  - ForwardRequest: signed for OUR forwarder, from the user's own wallet, value 0, to the factory or a circle the
 *    factory created. The relay also allow-lists the selectors, and every circle function acts on `_msgSender()`.
 *  - Permit (USDC, EIP-2612): owner is the user, spender is a circle the factory created. A circle can only pull what
 *    the protocol rules allow (docs/03 INV-04); it never pays anyone outside the circle (INV-07).
 */
import { decodeFunctionData } from 'viem';
import { huiCircleAbi, huiFactoryAbi } from 'sdk';

type Address = `0x${string}`;

/** Same lists as `lib/server/relay.ts` (the relay route): anything else is not a HụiSafe user action. */
const CIRCLE_FNS = new Set(['depositBond', 'withdrawBond', 'join', 'leave', 'activate', 'commitBid', 'revealBid', 'payLate', 'repayDebt', 'claim', 'settleRound', 'markDefault', 'finalize', 'cancel']);
const FACTORY_FNS = new Set(['createCircle']);
const MAX_GAS = 5_000_000n;
const SKEW_SEC = 300;
const FORWARD_TTL_SEC = 600;
const PERMIT_TTL_SEC = 3600;

const fnName = (abi: typeof huiCircleAbi | typeof huiFactoryAbi, data: unknown): string | undefined => {
  try {
    return decodeFunctionData({ abi, data: data as `0x${string}` }).functionName;
  } catch {
    return undefined;
  }
};

export interface QuietSignContext {
  address: Address;
  chainId: number;
  forwarder: Address;
  usdc: Address;
  factory: Address;
  /** `factory.isCircle(a)` on chain. */
  isCircle: (a: Address) => Promise<boolean>;
  /** `circle.requiredAllowance()` on chain. */
  requiredAllowance: (circle: Address) => Promise<bigint>;
  /** Current time in seconds. */
  nowSec: () => number;
}

export interface TypedDataArgs {
  domain: Record<string, unknown>;
  types: Record<string, readonly { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, unknown>;
}

const same = (a: unknown, b: string) => typeof a === 'string' && a.toLowerCase() === b.toLowerCase();
const isAddr = (a: unknown): a is Address => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a);

export async function quietSignAllowed(args: TypedDataArgs, ctx: QuietSignContext): Promise<boolean> {
  try {
    const d = args.domain;
    if (d.chainId === undefined || Number(d.chainId) !== ctx.chainId) return false;
    const m = args.message;
    if (args.primaryType === 'ForwardRequest') {
      if (!same(d.verifyingContract, ctx.forwarder) || !same(m.from, ctx.address)) return false;
      if (BigInt(m.value as bigint | string | number) !== 0n || !isAddr(m.to)) return false;
      if (BigInt(m.gas as bigint | string | number) > MAX_GAS) return false;
      if (Number(m.deadline) > ctx.nowSec() + FORWARD_TTL_SEC + SKEW_SEC) return false;
      if (same(m.to, ctx.factory)) return FACTORY_FNS.has(fnName(huiFactoryAbi, m.data) ?? '');
      return CIRCLE_FNS.has(fnName(huiCircleAbi, m.data) ?? '') && (await ctx.isCircle(m.to));
    }
    if (args.primaryType === 'Permit') {
      if (!same(d.verifyingContract, ctx.usdc) || !same(m.owner, ctx.address) || !isAddr(m.spender)) return false;
      if (Number(m.deadline) > ctx.nowSec() + PERMIT_TTL_SEC + SKEW_SEC) return false;
      if (!(await ctx.isCircle(m.spender))) return false;
      return BigInt(m.value as bigint | string | number) <= 2n * (await ctx.requiredAllowance(m.spender));
    }
    return false;
  } catch {
    return false; // a failed check never signs quietly
  }
}
