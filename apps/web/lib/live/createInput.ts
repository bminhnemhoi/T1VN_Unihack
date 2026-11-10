/**
 * Wizard form -> `factory.createCircle` parameters (docs/05 section 2, docs/03 section 3.1). Pure.
 * Real timing: one round = the nominal period, commit window 50% and reveal window 25% of it, grace 48 hours.
 * Demo timing (docs/03 section 3.3): 180 s rounds, 90 s / 60 s windows, 120 s grace, circle stays "30 days" for the interest rules.
 */
import { stringToHex } from 'viem';
import { buildTermsText, termsHashOf } from 'sdk';
import { DEMO } from 'config';
import type { CreateCircleInput } from '@/lib/chain/write';
import type { FormState, Valid } from '@/lib/circleForm';

const DAY = 86_400;
const REAL_GRACE = 172_800;
const JOIN_WINDOW_REAL = 7 * DAY;
const JOIN_WINDOW_DEMO = 30 * 60;

/** A short public name (no personal names) that fits in 31 bytes; falls back to a generic one. */
export function circleLabel(n: bigint, c: bigint): string {
  const usdc = c % 1_000_000n === 0n ? (c / 1_000_000n).toString() : (Number(c) / 1_000_000).toString();
  const text = `Dây ${n} người, ${usdc} USDC`;
  return new TextEncoder().encode(text).length <= 31 ? text : 'Dây hụi';
}

export function buildCreateInput(f: FormState, v: Valid, o: { nowSec: number; demo: boolean }): CreateCircleInput {
  const bidding = f.mode === 'bidding';
  const periodSeconds = o.demo ? DEMO.periodSeconds : Number(v.periodDays) * DAY;
  const roundDuration = o.demo ? DEMO.roundDuration : periodSeconds;
  const commitWindow = bidding ? (o.demo ? DEMO.commitWindow : Math.floor(roundDuration * 0.5)) : 0;
  const revealWindow = bidding ? (o.demo ? DEMO.revealWindow : Math.floor(roundDuration * 0.25)) : 0;
  const graceSeconds = o.demo ? DEMO.graceSeconds : REAL_GRACE;
  const feeBps = f.commission ? Number(v.feeBps) : 0;
  const revealBondBps = bidding ? 100 : 0;
  const capBps = bidding ? 2000 : 0;
  return {
    mode: bidding ? 1 : 0,
    memberCount: Number(v.n),
    contribution: v.c,
    periodSeconds,
    roundDuration,
    commitWindow,
    revealWindow,
    graceSeconds,
    alphaBps: Number(v.alphaBps),
    commissionMode: f.commission,
    feeBps,
    reserveBps: Number(v.reserveBps),
    revealBondBps,
    capBps,
    joinDeadline: BigInt(o.nowSec + (o.demo ? JOIN_WINDOW_DEMO : JOIN_WINDOW_REAL)),
    organizerIsMember: false,
    label: stringToHex(circleLabel(v.n, v.c), { size: 32 }),
    commissionShareBps: 0,
    termsHash: termsHashOf(
      buildTermsText({
        mode: bidding ? 'bidding' : 'fixed',
        memberCount: Number(v.n),
        contribution: v.c,
        periodSeconds,
        roundDuration,
        commitWindow,
        revealWindow,
        graceSeconds,
        alphaBps: Number(v.alphaBps),
        commissionMode: f.commission,
        feeBps,
        commissionShareBps: 0,
        reserveBps: Number(v.reserveBps),
        revealBondBps,
        capBps,
      }),
    ),
  };
}
