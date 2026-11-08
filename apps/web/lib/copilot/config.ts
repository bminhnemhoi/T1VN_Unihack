/**
 * Copilot constants (docs/07 sections 3.2, 3.6, 8). No secrets here: the API key is
 * read only in `app/api/copilot/route.ts` (CLAUDE.md hard rule 2).
 */

/** Model id from docs/07 3.2 item 1. Sampling parameters are NOT set: Sonnet 5.5 only accepts defaults. */
export const COPILOT_MODEL = 'claude-sonnet-5-5';
/** Effort `medium` keeps p50 latency near the 6 s target in docs/07 section 7; re-tune with the live eval. */
export const COPILOT_EFFORT = 'medium' as const;
/** Caps spend per call: the answer is about 550 tokens (docs/07 section 7); the rest is room for adaptive thinking. */
export const MAX_OUTPUT_TOKENS = 8_000;
export const MODEL_TIMEOUT_MS = 20_000;

/** The mandatory last sentence of every answer (docs/07 3.7). */
export const DISCLAIMER = 'Đây là thông tin tham khảo, không phải tư vấn tài chính hay pháp lý.';
/** Shown under every answer (docs/07 3.9). */
export const AI_LABEL = 'Số liệu do hàm tính của HụiSafe tạo; lời giải thích do AI viết.';

export const LIMITS = {
  maxBodyBytes: 16 * 1024,
  maxMessages: 12,
  maxMessageChars: 2_000,
  maxToolCallsPerTurn: 6,
  maxModelIterations: 4,
  /** Per IP, per hour (docs/07 section 8 item 3). */
  requestsPerHour: 20,
  /** Per process, per UTC day; overridable with COPILOT_DAILY_LIMIT. */
  dailyDefault: 500,
} as const;

/** Reference VND rate for the Article 14 threshold (docs/05 7.2 `vndPerRound`, default 26.000 VND/USDC). */
export const VND_PER_USDC = 26_000;
/** NĐ 19 Điều 14: a round worth at least 100.000.000 VND. */
export const NOTIFY_THRESHOLD_VND = 100_000_000n;

export const TESTNET_MAX_C_USDC = 10_000;
export const SIM_OUTPUT_DIR_ENV = 'COPILOT_SIM_DIR';
