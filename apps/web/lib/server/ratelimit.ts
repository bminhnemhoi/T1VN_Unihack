/**
 * Sliding-window limiter keyed by an opaque string (Privy user id, wallet address or IP). In-memory: fine for one
 * process (demo); a multi-instance deployment needs a shared store. Keys are never message content.
 */
export class SlidingWindowLimiter {
  /** Upper bound on tracked keys: unique spoofed keys cannot grow memory or CPU without limit (audit H-01). */
  static readonly MAX_KEYS = 10_000;
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
    if (this.hits.size > SlidingWindowLimiter.MAX_KEYS) this.evict(start);
    return { ok: true };
  }

  /** Drops expired keys, then the oldest tenth, so the cost is amortised O(1) per call and the table stays bounded. */
  private evict(windowStart: number): void {
    for (const [k, v] of this.hits) if (v.every((x) => x <= windowStart)) this.hits.delete(k);
    if (this.hits.size <= SlidingWindowLimiter.MAX_KEYS) return;
    let drop = Math.ceil(SlidingWindowLimiter.MAX_KEYS / 10) + (this.hits.size - SlidingWindowLimiter.MAX_KEYS);
    for (const k of this.hits.keys()) {
      if (drop-- <= 0) break;
      this.hits.delete(k);
    }
  }
}
