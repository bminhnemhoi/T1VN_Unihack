/**
 * POST /api/copilot (docs/05 8.4, docs/07 section 3). Streams NDJSON events: status, tool, answer | error.
 * The only code in the copilot that reads the environment for the model (provider, base URL, key, model id):
 * it passes it to `provider.ts`. No relay/attest imports, no wallet keys (docs/07 3.2 item 5).
 */
import { LIMITS } from '../../../lib/copilot/config';
import { runCopilot, type CopilotEvent, type ModelClient } from '../../../lib/copilot/engine';
import { ConfigError, createModelClient, resolveProviderConfig } from '../../../lib/copilot/provider';
import { RateLimiter } from '../../../lib/copilot/ratelimit';
import { requestSchema } from '../../../lib/copilot/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let requestCounter = 0;
const limiter = new RateLimiter(LIMITS.requestsPerHour, Number(process.env.COPILOT_DAILY_LIMIT) || LIMITS.dailyDefault);

function json(status: number, code: string, message: string, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });
}

/** Reads at most `max` bytes (a chunked body has no trustworthy content-length); null when it is larger. */
async function readLimited(req: Request, max: number): Promise<string | null> {
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

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return fwd || req.headers.get('x-real-ip') || 'unknown';
}

/** Dev-only scripted model for curl demos: refused in production builds. Otherwise the env selects the provider. */
async function resolveModel(): Promise<ModelClient> {
  if (process.env.NODE_ENV !== 'production' && process.env.COPILOT_MOCK === '1') {
    const { createScriptedModel } = await import('../../../lib/copilot/evals/mock');
    return createScriptedModel();
  }
  return createModelClient(resolveProviderConfig(process.env));
}

export async function POST(req: Request): Promise<Response> {
  // Deterministic id (time + counter): only for log correlation, no randomness in the product (CLAUDE.md rule 3).
  const requestId = `${Date.now().toString(36)}-${(++requestCounter).toString(36)}`;
  const log = (entry: Record<string, unknown>) => console.log(JSON.stringify({ route: 'copilot', ...entry }));

  if (['0', 'false', 'off'].includes((process.env.COPILOT_ENABLED ?? '').toLowerCase())) {
    return json(503, 'disabled', 'Trợ lý AI đang tắt. Bạn dùng chế độ máy tính.');
  }

  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > LIMITS.maxBodyBytes) return json(413, 'too_large', 'Nội dung gửi lên quá dài.');

  const taken = limiter.take(clientIp(req));
  if (!taken.ok) {
    log({ requestId, event: 'rate_limited', reason: taken.reason });
    return json(429, 'rate_limited', 'Bạn hỏi nhiều quá, vui lòng thử lại sau ít phút.', {
      'retry-after': String(taken.retryAfterSec),
    });
  }

  const text = await readLimited(req, LIMITS.maxBodyBytes);
  if (text === null) return json(413, 'too_large', 'Nội dung gửi lên quá dài.');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json(400, 'bad_json', 'Nội dung gửi lên không đúng định dạng.');
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    // Paths only: never echo user content back or into logs.
    const fields = [...new Set(parsed.error.issues.map((i) => i.path.join('.') || 'body'))].join(', ');
    return json(400, 'bad_request', `Dữ liệu không hợp lệ ở: ${fields}.`);
  }

  let model: ModelClient;
  try {
    model = await resolveModel();
  } catch (e) {
    // The message names variables, never their values.
    if (e instanceof ConfigError) return json(503, 'not_configured', `${e.message} Bạn dùng chế độ máy tính.`);
    throw e;
  }

  const encoder = new TextEncoder();
  const abort = new AbortController();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: CopilotEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      try {
        send({ type: 'status', text: 'Đang xử lý câu hỏi...' });
        for await (const e of runCopilot({ request: parsed.data, model, requestId, log, signal: abort.signal })) send(e);
      } catch {
        send({ type: 'error', code: 'internal', message: 'Có lỗi xảy ra. Bạn thử lại sau.' });
      } finally {
        controller.close();
      }
    },
    cancel() {
      abort.abort();
    },
  });
  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
      'x-request-id': requestId,
    },
  });
}
