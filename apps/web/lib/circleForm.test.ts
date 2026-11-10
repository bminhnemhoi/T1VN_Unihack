import { describe, expect, it } from 'vitest';
import { ALPHA_LIMIT_MESSAGE, DEFAULTS, validateForm } from '@/lib/circleForm';
import { circleDraftSchema } from '@/lib/copilot/schemas';

describe('holdback limit in the create form (audit A16 L-02)', () => {
  it('keeps the default of 20% valid', () => {
    expect(DEFAULTS.alpha).toBe('20');
    expect(validateForm(DEFAULTS).errors.alpha).toBeUndefined();
  });

  it('accepts 50% and rejects 51% with a Vietnamese explanation', () => {
    const ok = validateForm({ ...DEFAULTS, alpha: '50' });
    expect(ok.errors.alpha).toBeUndefined();
    expect(ok.value?.alphaBps).toBe(5000n);
    const bad = validateForm({ ...DEFAULTS, alpha: '51' });
    expect(bad.value).toBeUndefined();
    expect(bad.errors.alpha).toBe(ALPHA_LIMIT_MESSAGE);
    expect(ALPHA_LIMIT_MESSAGE).toContain('50%');
  });

  it('rejects 50,01% and 100%, and still rejects a non-number', () => {
    expect(validateForm({ ...DEFAULTS, alpha: '50,01' }).errors.alpha).toBe(ALPHA_LIMIT_MESSAGE);
    expect(validateForm({ ...DEFAULTS, alpha: '100' }).errors.alpha).toBe(ALPHA_LIMIT_MESSAGE);
    expect(validateForm({ ...DEFAULTS, alpha: 'abc' }).errors.alpha).toBe('Tiền giữ lại phải từ 0% đến 50%.');
  });
});

describe('holdback limit in the copilot draft uses the same rule', () => {
  const draft = {
    mode: 'bidding',
    N: 5,
    C: '100',
    periodDays: 30,
    demoMode: false,
    alphaBps: 2000,
    bondUsdc: '480',
    commissionMode: true,
    feeBps: 100,
    reserveBps: 100,
    revealBondBps: 100,
    capBps: 2000,
  };

  it('accepts 5000 bps and rejects 5001 and 10000', () => {
    expect(circleDraftSchema.safeParse({ ...draft, alphaBps: 5000 }).success).toBe(true);
    for (const alphaBps of [5001, 10_000]) {
      const r = circleDraftSchema.safeParse({ ...draft, alphaBps });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0]?.message).toBe(ALPHA_LIMIT_MESSAGE);
    }
  });
});
