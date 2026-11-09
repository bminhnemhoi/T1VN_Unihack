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

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return fwd || req.headers.get('x-real-ip') || 'unknown';
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
