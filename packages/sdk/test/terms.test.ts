import { keccak256, toBytes } from 'viem';
import { describe, expect, it } from 'vitest';
import { buildTermsText, termsHashOf, type TermsInput } from '../src/terms';

const base: TermsInput = {
  mode: 'bidding',
  memberCount: 5,
  contribution: 100_000_000n,
  periodSeconds: 2_592_000,
  alphaBps: 2000,
  commissionMode: true,
  feeBps: 100,
  commissionShareBps: 0,
  reserveBps: 100,
  capBps: 2000,
  graceSeconds: 172_800,
};

describe('circle terms text and hash (ADR-27)', () => {
  it('is deterministic and hashes the UTF-8 text', () => {
    const a = buildTermsText(base);
    expect(buildTermsText({ ...base })).toBe(a);
    expect(termsHashOf(a)).toBe(keccak256(toBytes(a)));
    expect(termsHashOf(a)).not.toBe(`0x${'00'.repeat(32)}`);
  });

  it('changes when phi, alpha or the fallback terms change', () => {
    const h = (t: TermsInput) => termsHashOf(buildTermsText(t));
    expect(h({ ...base, commissionShareBps: 5000, feeBps: 300 })).not.toBe(h(base));
    expect(h({ ...base, alphaBps: 3000 })).not.toBe(h(base));
  });

  it('states phi, the bid share left to members and the fallback order', () => {
    const text = buildTermsText({ ...base, commissionShareBps: 5000, feeBps: 300 });
    expect(text).toContain('50% quỹ lãi');
    expect(text).toContain('thăm tối đa là 50% trần luật');
    expect(text).toContain('thứ tự vào dây');
    expect(text).toContain('100 USDC');
  });
});
