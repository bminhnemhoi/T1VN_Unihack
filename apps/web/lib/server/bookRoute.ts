/**
 * GET /api/circles/[address]/so-ho?format=json (docs/05 section 8.3). Public read-only: anyone can see a book. The
 * dependencies are injected so the route can be tested without a chain. `format=pdf` was cut (the printable page
 * `/circles/<address>/so-ho` replaces it).
 */
import { takeIp, errorResponse, jsonResponse, type Logger } from './http';
import type { BookJson } from './book';
import type { SlidingWindowLimiter } from './ratelimit';

export const BOOK_PER_HOUR_PER_IP = 120;
const CACHE_MS = 15_000;

export interface BookDeps {
  isCircle(address: `0x${string}`): Promise<boolean>;
  build(address: `0x${string}`): Promise<BookJson>;
  ipLimiter: SlidingWindowLimiter;
  /** Read the client IP from proxy headers (`TRUST_PROXY=true`); default false = one shared bucket. */
  trustProxy?: boolean;
  now: () => number;
  requestId: () => string;
  log: Logger;
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** Path is /api/circles/<address>/so-ho. */
function addressOf(req: Request): string {
  return new URL(req.url).pathname.split('/')[3] ?? '';
}

export function createBookHandler(deps: BookDeps): (req: Request) => Promise<Response> {
  const cache = new Map<string, { at: number; book: BookJson }>();
  return async (req) => {
    const id = deps.requestId();
    if (req.method !== 'GET') return errorResponse(405, 'MethodNotAllowed', 'Chỉ hỗ trợ GET.', { allow: 'GET' });
    const limit = takeIp(deps.ipLimiter, req, deps.trustProxy);
    if (!limit.ok) {
      return errorResponse(429, 'RateLimited', 'Bạn xem sổ hụi quá nhiều lần. Hãy thử lại sau.', { 'retry-after': String(limit.retryAfterSec) });
    }
    const raw = addressOf(req);
    if (!ADDRESS.test(raw)) return errorResponse(400, 'BadAddress', 'Địa chỉ dây không hợp lệ.');
    const format = new URL(req.url).searchParams.get('format') ?? 'json';
    if (format !== 'json') {
      return errorResponse(400, 'FormatNotSupported', `Chỉ có định dạng JSON. Muốn bản in, mở trang /circles/${raw}/so-ho và bấm "In sổ hụi".`);
    }
    const address = raw as `0x${string}`;
    try {
      if (!(await deps.isCircle(address))) return errorResponse(404, 'NotCircle', 'Địa chỉ này không phải một dây của HụiSafe.');
      const key = address.toLowerCase();
      const hit = cache.get(key);
      if (hit && deps.now() - hit.at < CACHE_MS) return jsonResponse(200, hit.book);
      const book = await deps.build(address);
      cache.set(key, { at: deps.now(), book });
      if (cache.size > 200) cache.clear();
      return jsonResponse(200, book);
    } catch {
      deps.log('error', 'so-ho read failed', { requestId: id });
      return errorResponse(502, 'ChainUnavailable', 'Chưa đọc được dây từ mạng. Hãy thử lại sau.');
    }
  };
}
