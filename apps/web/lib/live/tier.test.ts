import { describe, expect, it } from 'vitest';
import { sampleTier } from './tier';

const NOW = 1_800_000_000;
const base = { completed: 0, onTime: 0, late: 0, defaults: 0, repaid: 0, monthsActive: 0 };

describe('sampleTier (SDK rules over sample reputation)', () => {
  it('starts as Mới and says what is missing for Tin cậy', () => {
    const r = sampleTier({ ...base, completed: 1, onTime: 8 }, 'member', NOW);
    expect(r.tier).toBe('new');
    expect(r.next?.tier).toBe('trusted');
    expect(r.next?.missing.join(' ')).toContain('Hoàn thành thêm 2 dây');
  });
  it('Tin cậy needs 3 finished circles, no default and 95% on time', () => {
    expect(sampleTier({ ...base, completed: 3, onTime: 19, late: 1 }, 'member', NOW).tier).toBe('trusted');
    expect(sampleTier({ ...base, completed: 3, onTime: 18, late: 2 }, 'member', NOW).tier).toBe('new');
    expect(sampleTier({ ...base, completed: 3, onTime: 20, defaults: 1, repaid: 1 }, 'member', NOW).tier).toBe('new');
  });
  it('an organizer whose bond covered a default stays Mới', () => {
    expect(sampleTier({ ...base, completed: 5, bondUsedCircles: 1 }, 'organizer', NOW).tier).toBe('new');
    expect(sampleTier({ ...base, completed: 5, bondUsedCircles: 0 }, 'organizer', NOW).tier).toBe('trusted');
  });
  it('Lâu năm needs 10 circles and 6 months, and has nothing above it', () => {
    const v = sampleTier({ ...base, completed: 12, onTime: 80, late: 1, monthsActive: 14 }, 'member', NOW);
    expect(v.tier).toBe('veteran');
    expect(v.next).toBeNull();
    expect(sampleTier({ ...base, completed: 12, onTime: 80, monthsActive: 5 }, 'member', NOW).tier).toBe('trusted');
  });
  it('an unpaid default shows the red flag at every tier', () => {
    expect(sampleTier({ ...base, completed: 4, onTime: 30, defaults: 1, repaid: 0 }, 'member', NOW).redFlag).toBe(true);
    expect(sampleTier({ ...base, completed: 4, onTime: 30, defaults: 1, repaid: 1 }, 'member', NOW).redFlag).toBe(false);
  });
});
