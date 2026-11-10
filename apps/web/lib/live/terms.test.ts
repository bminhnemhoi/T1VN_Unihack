import { describe, expect, it } from 'vitest';
import { buildTermsText, termsHashOf, type CircleView } from 'sdk';
import { DEFAULTS, validateForm } from '@/lib/circleForm';
import { getSampleCircle, type SampleCircleData } from '@/lib/sample-circles';
import { buildCreateInput, formTermsInput } from './createInput';
import { termsViewOf } from './terms';

const form = () => {
  const f = { ...DEFAULTS, bond: '480' };
  const r = validateForm(f);
  if (!r.value) throw new Error('invalid');
  return { f, v: r.value };
};

/** A live circle whose parameters are exactly what the form would create, with a chosen on-chain hash. */
function live(termsHash: `0x${string}` | undefined): SampleCircleData {
  const { f, v } = form();
  const o = { nowSec: 0, demo: true };
  const p = buildCreateInput(f, v, o);
  const view = {
    address: `0x${'ab'.repeat(20)}`,
    mode: 'bidding',
    params: {
      N: p.memberCount, C: p.contribution, periodSeconds: p.periodSeconds, roundDuration: p.roundDuration, commitWindow: p.commitWindow,
      revealWindow: p.revealWindow, graceSeconds: p.graceSeconds, alphaBps: p.alphaBps, commissionMode: p.commissionMode, feeBps: p.feeBps,
      commissionShareBps: p.commissionShareBps, reserveBps: p.reserveBps, revealBondBps: p.revealBondBps, capBps: p.capBps, termsHash,
    },
  } as unknown as CircleView;
  return { ...getSampleCircle('demo'), live: { view, address: view.address, nowMs: 0 } };
}

describe('termsViewOf', () => {
  it('the hash the form writes is the hash verifyTerms expects from the circle it creates: match', () => {
    const { f, v } = form();
    const hash = buildCreateInput(f, v, { nowSec: 0, demo: true }).termsHash;
    expect(hash).toBe(termsHashOf(buildTermsText(formTermsInput(f, v, { demo: true }))));
    expect(termsViewOf(live(hash))).toMatchObject({ check: 'match', hash });
  });
  it('another document hashed on chain: mismatch, with both hashes', () => {
    const other = termsHashOf('another agreement');
    const t = termsViewOf(live(other));
    expect(t.check).toBe('mismatch');
    expect(t.onChain).toBe(other);
    expect(t.hash).not.toBe(other);
  });
  it('sample circle: text and hash, nothing to compare', () => {
    const t = termsViewOf(getSampleCircle('dang-gom'));
    expect(t.check).toBe('unknown');
    expect(t.text).toContain('Hoa hồng chủ hụi nằm trong trần lãi: 50%');
    expect(t.hash).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
