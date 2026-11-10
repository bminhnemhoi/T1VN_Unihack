import { describe, expect, it } from 'vitest';
import { RateLimiter } from './ratelimit';

describe('RateLimiter', () => {
  it('allows 20 per hour per key, then blocks with a retry time, then recovers', () => {
    let now = Date.parse('2026-11-08T10:00:00Z');
    const rl = new RateLimiter(20, 1000, () => now);
    for (let i = 0; i < 20; i++) expect(rl.take('1.1.1.1').ok).toBe(true);
    const blocked = rl.take('1.1.1.1');
    expect(blocked).toMatchObject({ ok: false, reason: 'ip' });
    expect(rl.take('2.2.2.2').ok).toBe(true);
    now += 3_600_001;
    expect(rl.take('1.1.1.1').ok).toBe(true);
  });
  it('enforces the daily cap across keys and resets at UTC midnight', () => {
    let now = Date.parse('2026-11-08T23:00:00Z');
    const rl = new RateLimiter(100, 3, () => now);
    expect(rl.take('a').ok && rl.take('b').ok && rl.take('c').ok).toBe(true);
    expect(rl.take('d')).toMatchObject({ ok: false, reason: 'daily' });
    now = Date.parse('2026-11-09T00:00:01Z');
    expect(rl.take('d').ok).toBe(true);
  });
  it('with no trustworthy address (null key) there is no per-IP block but the daily cap still counts', () => {
    const now = Date.parse('2026-11-08T10:00:00Z');
    const rl = new RateLimiter(2, 5, () => now);
    for (let i = 0; i < 5; i++) expect(rl.take(null).ok).toBe(true);
    expect(rl.take(null)).toMatchObject({ ok: false, reason: 'daily' });
    expect(rl.take('1.1.1.1')).toMatchObject({ ok: false, reason: 'daily' });
  });
});
