/**
 * The agreement text of a circle (ADR-27) rebuilt from its parameters with the SDK, and the check against the hash the
 * organizer wrote on the chain. Pure. The text is the SDK's `buildTermsText`: the web never words the agreement itself.
 */
import { buildTermsText, termsHashOf, type TermsInput } from 'sdk';
import type { SampleCircleData } from '@/lib/sample-circles';

/** `TermsInput` of a circle the screens already hold: exact chain parameters when live, the sample terms otherwise. */
export function termsInputOf(c: SampleCircleData): TermsInput {
  const t = c.terms;
  const p = c.live?.view.params;
  return {
    mode: t.mode,
    memberCount: Number(t.n),
    contribution: t.c,
    periodSeconds: p?.periodSeconds ?? Number(t.periodDays) * 86_400,
    alphaBps: Number(t.alphaBps),
    commissionMode: p ? p.commissionMode : t.feeBps > 0n,
    feeBps: Number(t.feeBps),
    commissionShareBps: Number(t.shareBps ?? 0n),
    reserveBps: Number(t.reserveBps),
    capBps: Number(t.capBps),
    graceSeconds: c.graceSeconds,
  };
}

export type TermsCheck = 'match' | 'mismatch' | 'unknown';

export interface TermsView {
  text: string;
  /** Hash of `text`: what the circle must hold on the chain if the text is the one the organizer agreed to. */
  hash: `0x${string}`;
  /** Hash read from the chain (live circles only). */
  onChain?: `0x${string}`;
  check: TermsCheck;
}

export function termsViewOf(c: SampleCircleData): TermsView {
  const text = buildTermsText(termsInputOf(c));
  const hash = termsHashOf(text);
  const onChain = c.live?.termsHash;
  const check: TermsCheck = !onChain ? 'unknown' : onChain.toLowerCase() === hash.toLowerCase() ? 'match' : 'mismatch';
  return { text, hash, ...(onChain ? { onChain } : {}), check };
}
