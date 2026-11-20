import { describe, expect, it } from 'vitest';
import { formingCopy } from './forming-copy';

describe('forming page wording depends on who is looking (issue #15)', () => {
  it('a member who is not the organizer is never told the bond is theirs', () => {
    for (const full of [false, true]) {
      const t = formingCopy({ organizerView: false, full, n: 3 });
      expect(t.countdownTail).not.toMatch(/bạn rút lại ký quỹ/);
      expect(t.countdownTail).toMatch(/bạn không mất tiền/);
      expect(t.bondTitle).toBe('Ký quỹ của chủ hụi');
      expect(t.bondNote).not.toMatch(/bạn lấy lại ký quỹ/);
    }
  });

  it('the organizer keeps "Ký quỹ của bạn" and is told they get the bond back', () => {
    const t = formingCopy({ organizerView: true, full: false, n: 5 });
    expect(t.bondTitle).toBe('Ký quỹ của bạn');
    expect(t.countdownTail).toMatch(/bạn rút lại ký quỹ/);
    expect(t.bondNote).toMatch(/Hết dây bạn lấy lại ký quỹ/);
  });

  it('a full circle asks to start, not to invite', () => {
    expect(formingCopy({ organizerView: true, full: true, n: 5 }).countdownHead).toBe('Đã đủ 5 người. Còn');
    expect(formingCopy({ organizerView: true, full: false, n: 5 }).countdownHead).toBe('Còn');
  });
});
