import { LIMITS } from './config';

/**
 * In-memory sliding window per key plus a daily cap. Good enough for one process (hackathon demo);
 * a multi-instance deployment needs a shared store. Keys are the client IP, never message content.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  private day = '';
  private dayCount = 0;

  constructor(
    private readonly perHour: number = LIMITS.requestsPerHour,
    private readonly perDay: number = LIMITS.dailyDefault,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Returns `ok` and, when blocked, the reason and seconds to wait. `key` null means no trustworthy client address
   * (the proxy headers are client-controlled unless `TRUST_PROXY=true`): only the daily cap applies then.
   */
  take(key: string | null): { ok: true } | { ok: false; reason: 'ip' | 'daily'; retryAfterSec: number } {
    const t = this.now();
    const today = new Date(t).toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.dayCount = 0;
    }
    if (this.dayCount >= this.perDay) {
      const tomorrow = Date.parse(`${today}T00:00:00Z`) + 86_400_000;
      return { ok: false, reason: 'daily', retryAfterSec: Math.max(1, Math.ceil((tomorrow - t) / 1000)) };
    }
    if (key === null) {
      this.dayCount++;
      return { ok: true };
    }
    const windowStart = t - 3_600_000;
    const recent = (this.hits.get(key) ?? []).filter((x) => x > windowStart);
    if (recent.length >= this.perHour) {
      this.hits.set(key, recent);
      return { ok: false, reason: 'ip', retryAfterSec: Math.max(1, Math.ceil((recent[0]! + 3_600_000 - t) / 1000)) };
    }
    recent.push(t);
    this.hits.set(key, recent);
    this.dayCount++;
    if (this.hits.size > 10_000) {
      for (const [k, v] of this.hits) if (v.every((x) => x <= windowStart)) this.hits.delete(k);
    }
    return { ok: true };
  }
}
