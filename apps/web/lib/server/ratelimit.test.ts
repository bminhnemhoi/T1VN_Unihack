import { describe, expect, it } from 'vitest';
import { SlidingWindowLimiter } from './ratelimit';

describe('SlidingWindowLimiter', () => {
  it('allows `limit` hits per window per key, then reports when to retry', () => {
    let t = 0;
    const l = new SlidingWindowLimiter(2, 1000, () => t);
    expect(l.take('a').ok).toBe(true);
    expect(l.take('a').ok).toBe(true);
    const blocked = l.take('a');
    expect(blocked.ok).toBe(false);
    expect(blocked.ok ? 0 : blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(l.take('b').ok).toBe(true); // other keys are independent
    t = 1001;
    expect(l.take('a').ok).toBe(true);
  });

  it('keeps the table bounded when unique keys keep arriving (audit H-01)', () => {
    const l = new SlidingWindowLimiter(1, 3_600_000, () => 1);
    const size = () => (l as unknown as { hits: Map<string, number[]> }).hits.size;
    for (let i = 0; i < SlidingWindowLimiter.MAX_KEYS * 3; i++) l.take(`ip-${i}`);
    expect(size()).toBeLessThanOrEqual(SlidingWindowLimiter.MAX_KEYS);
    expect(l.take('fresh').ok).toBe(true);
  });
});
