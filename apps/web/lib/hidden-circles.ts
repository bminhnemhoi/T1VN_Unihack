/**
 * "Xóa" a circle from the list (B25). A circle is a smart contract on the blockchain: it cannot be deleted. Deleting only
 * HIDES it from this wallet's lists, on this device (localStorage, never sent to the server), and the on-chain book stays.
 * This file is the pure part: the storage format, the hide / unhide operations and the choice of what the dialog offers.
 */
import type { SampleCircle } from '@/lib/sample';

export interface HiddenCircle {
  id: string;
  label: string;
}

/** `huisafe.hidden.<address>`; the sample screens (no wallet) use `sample`. */
export const hiddenKey = (owner?: string): string => `huisafe.hidden.${(owner ?? 'sample').toLowerCase()}`;

/** Reads the list; anything unreadable or malformed counts as empty (private mode, cleared data, hand-edited value). */
export function parseHidden(raw: string | null): HiddenCircle[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is HiddenCircle => typeof x === 'object' && x !== null && typeof (x as HiddenCircle).id === 'string' && typeof (x as HiddenCircle).label === 'string');
  } catch {
    return [];
  }
}

export const withHidden = (list: HiddenCircle[], c: HiddenCircle): HiddenCircle[] => (list.some((x) => x.id === c.id) ? list : [...list, c]);
export const withoutHidden = (list: HiddenCircle[], id: string): HiddenCircle[] => list.filter((x) => x.id !== id);

type Deletable = Pick<SampleCircle, 'state' | 'role' | 'expired' | 'bondUnits'>;

/** Rows that get a "Xóa" button: circles that were cancelled or stopped, and (for the organizer) a gathering circle whose deadline passed. */
export function canDelete(c: Pick<SampleCircle, 'state' | 'role' | 'expired'>): boolean {
  return c.state === 'cancelled' || c.state === 'unwound' || (c.state === 'forming' && c.expired === true && c.role === 'organizer');
}

export type DeleteKind =
  /** Organizer, cancelled circle with bond left: `withdrawBond()`, then hide. */
  | 'withdraw'
  /** Organizer, gathering circle past its deadline that nobody cancelled yet, bond left: `cancel()` then `withdrawBond()`, then hide. */
  | 'cancel-withdraw'
  /** Nothing to get back: hide only. */
  | 'hide-only'
  /** A member of a cancelled circle: nothing of theirs is held; hide only, with a tip about the allowance. */
  | 'member';

export interface DeletePlan {
  kind: DeleteKind;
  /** USDC (base units) that comes back to the wallet; 0 when nothing does. */
  bond: bigint;
  /** Transactions to sign before the circle is hidden. */
  signatures: 0 | 1 | 2;
}

/**
 * What deleting this circle does. `withdrawBond()` only works on a Cancelled circle (docs/05), so a stopped (`unwound`) circle,
 * whose bond the factory already paid out, is a plain hide.
 */
export function planDelete(c: Deletable): DeletePlan {
  const bond = c.bondUnits ?? 0n;
  if (c.role !== 'organizer') return { kind: 'member', bond: 0n, signatures: 0 };
  if (c.state === 'cancelled' && bond > 0n) return { kind: 'withdraw', bond, signatures: 1 };
  if (c.state === 'forming' && c.expired && bond > 0n) return { kind: 'cancel-withdraw', bond, signatures: 2 };
  return { kind: 'hide-only', bond: 0n, signatures: 0 };
}
