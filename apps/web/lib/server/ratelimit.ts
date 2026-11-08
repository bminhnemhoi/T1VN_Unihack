/**
 * Sliding-window limiter keyed by an opaque string (Privy user id, wallet address or IP). In-memory: fine for one
 * process (demo); a multi-instance deployment needs a shared store. Keys are never message content.
 */
export class SlidingWindowLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number = 3_600_000,
    private readonly now: () => number = Date.now,
  ) {}

  take(key: string): { ok: true } | { ok: false; retryAfterSec: number } {
    const t = this.now();
    const start = t - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((x) => x > start);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((recent[0]! + this.windowMs - t) / 1000)) };
    }
    recent.push(t);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) {
      for (const [k, v] of this.hits) if (v.every((x) => x <= start)) this.hits.delete(k);
    }
    return { ok: true };
  }
}
