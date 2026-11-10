/**
 * The agreement text of a circle (ADR-27) rebuilt from its parameters with the SDK, and the check against the hash the
 * organizer wrote on the chain. Pure. The text is the SDK's `buildTermsText`: the web never words the agreement itself.
 */
import { buildTermsText, termsHashOf, termsInputOfView, verifyTerms, type TermsInput } from 'sdk';
import type { SampleCircleData } from '@/lib/sample-circles';

/** `TermsInput` of a SAMPLE circle (the sample data has no windows, so they follow the real-timing rule of the create form). */
export function sampleTermsInput(c: SampleCircleData): TermsInput {
  const t = c.terms;
  const bidding = t.mode === 'bidding';
  return {
    mode: t.mode,
    memberCount: Number(t.n),
    contribution: t.c,
    periodSeconds: Number(t.periodDays) * 86_400,
    roundDuration: c.roundSeconds,
    commitWindow: bidding ? Math.floor(c.roundSeconds * 0.5) : 0,
    revealWindow: bidding ? Math.floor(c.roundSeconds * 0.25) : 0,
    graceSeconds: c.graceSeconds,
    alphaBps: Number(t.alphaBps),
    commissionMode: t.feeBps > 0n,
    feeBps: Number(t.feeBps),
    commissionShareBps: Number(t.shareBps ?? 0n),
    reserveBps: Number(t.reserveBps),
    revealBondBps: bidding ? 100 : 0,
    capBps: Number(t.capBps),
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

/** Live circle: `verifyTerms(termsInputOfView(view))` of the SDK. Sample circle: the text and its hash, nothing to compare. */
export function termsViewOf(c: SampleCircleData): TermsView {
  const view = c.live?.view;
  const input = view ? termsInputOfView(view) : undefined;
  if (input?.termsHash) {
    const r = verifyTerms({ ...input, termsHash: input.termsHash });
    return { text: r.text, hash: r.expected, onChain: r.actual, check: r.match ? 'match' : 'mismatch' };
  }
  const text = buildTermsText(input ?? sampleTermsInput(c));
  return { text, hash: termsHashOf(text), check: 'unknown' };
}
