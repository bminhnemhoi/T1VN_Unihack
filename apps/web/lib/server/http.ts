/** Small HTTP helpers shared by the server-only API routes (attest, relay). */

export interface ApiError {
  code: string;
  message: string;
}

export function jsonResponse(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });
}

export function errorResponse(status: number, code: string, message: string, extra: Record<string, string> = {}): Response {
  return jsonResponse(status, { error: { code, message } satisfies ApiError }, extra);
}

/** Reads at most `max` bytes (a chunked body has no trustworthy content-length); null when it is larger. */
export async function readLimited(req: Request, max: number): Promise<string | null> {
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/**
 * Key for the per-IP rate limit, or `null` when no trustworthy address exists. `x-forwarded-for` and `x-real-ip` are
 * client-controlled unless a trusted reverse proxy overwrites them (Next copies the socket address only when the
 * header is absent), so they are read only when `trustProxy` is true (server variable `TRUST_PROXY=true`, set when the
 * web runs behind exactly one proxy that REPLACES the header). Otherwise there is no per-IP gate: a shared bucket
 * would let one anonymous client exhaust it and lock every member out of the relay (audit A15 H-01), which is worse
 * than a spoofable limit. The per-signer, per-owner, per-user and global budgets, all charged only after a request
 * proved itself valid, stay in force. Next route handlers do not expose the socket address.
 */
export function clientIp(req: Request, trustProxy = false): string | null {
  if (!trustProxy) return null;
  const parts = req.headers.get('x-forwarded-for')?.split(',').map((s) => s.trim()).filter(Boolean);
  // The last entry is the one the (single) trusted proxy observed.
  return parts?.[parts.length - 1] || req.headers.get('x-real-ip')?.trim() || null;
}

/** Charges the per-IP limiter when there is a trustworthy IP; otherwise lets the request through (see `clientIp`). */
export function takeIp(
  limiter: { take(key: string): { ok: true } | { ok: false; retryAfterSec: number } },
  req: Request,
  trustProxy = false,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const key = clientIp(req, trustProxy);
  return key === null ? { ok: true } : limiter.take(key);
}

/** `TRUST_PROXY=true` (exactly) turns proxy headers on; anything else, or unset, is off. */
export function trustProxyFrom(env: Record<string, string | undefined>): boolean {
  return env.TRUST_PROXY === 'true';
}

/** Deterministic id (time + counter): only for log correlation, no randomness in the product (CLAUDE.md rule 3). */
export function makeRequestIdGenerator(now: () => number = Date.now): () => string {
  let counter = 0;
  return () => `${now().toString(36)}-${(++counter).toString(36)}`;
}

/** One-line JSON log (docs/04 section 7.4). Callers must never pass keys, signatures, tokens or e-mail addresses. */
export type Logger = (level: 'info' | 'warn' | 'error', message: string, fields?: Record<string, string | number | boolean>) => void;

export const consoleLogger: Logger = (level, message, fields = {}) => {
  const line = JSON.stringify({ time: new Date().toISOString(), level, message, ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
};
