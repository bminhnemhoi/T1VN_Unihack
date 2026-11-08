/**
 * Adapter test against a local fake OpenAI-compatible server with a low-entropy fake key (Goblin's method):
 * the request shape is asserted on the wire, and the key must not appear in logs, responses or errors.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST } from '../../../app/api/copilot/route';
import { DISCLAIMER } from '../config';
import { runCopilot, type CopilotEvent, type TurnMessage } from '../engine';
import { requestSchema } from '../schemas';
import { ProviderError } from './error';
import { createOpenAiCompatibleClient, simplifySchema } from './openai';

const KEY = 'g'.repeat(24);
let server: http.Server;
let base: string;
let seen: { url: string; auth: string; body: any }[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
let reply: (req: number, res: http.ServerResponse) => void = () => {};

const json = (res: http.ServerResponse, body: unknown, status = 200) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
const completion = (message: object, finish = 'stop', extra: object = {}) => ({
  model: 'gateway-model-x',
  choices: [{ message: { role: 'assistant', ...message }, finish_reason: finish }],
  usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 },
  ...extra,
});
const toolCall = (name: string, args: unknown, id: string | null = 'call_a') => ({ ...(id ? { id } : {}), type: 'function', function: { name, arguments: args } });

beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    seen.push({ url: req.url ?? '', auth: String(req.headers.authorization), body: JSON.parse(Buffer.concat(chunks).toString() || '{}') });
    reply(seen.length, res);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});
afterAll(async () => {
  await new Promise((r) => server.close(r));
});
afterEach(() => {
  seen = [];
  reply = () => {};
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const client = () => createOpenAiCompatibleClient({ baseUrl: base, apiKey: KEY, model: 'asked-model-medium' });
const ask = (messages: TurnMessage[] = [{ role: 'user', content: 'xin chào' }], toolChoice?: 'auto' | 'none') => client().complete({ system: 'SYS', messages, toolChoice });

describe('request shape', () => {
  it('posts to {base}/chat/completions with the key, the configured model, temperature 0 and the six tools in OpenAI format', async () => {
    reply = (_n, res) => json(res, completion({ content: 'ok' }));
    await ask();
    const r = seen[0]!;
    expect(r.url).toBe('/v1/chat/completions');
    expect(r.auth).toBe(`Bearer ${KEY}`);
    expect(r.body).toMatchObject({ model: 'asked-model-medium', temperature: 0, tool_choice: 'auto' });
    expect(r.body.stream).toBeUndefined();
    expect(r.body.messages[0]).toEqual({ role: 'system', content: 'SYS' });
    expect(r.body.messages[1]).toEqual({ role: 'user', content: 'xin chào' });
    expect(r.body.tools.map((t: any) => t.function.name)).toEqual(['compute_exposure', 'recommend_bond', 'max_bid_table', 'simulate_circle', 'explain_rule', 'draft_ubnd_notice']); // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const t of r.body.tools) {
      expect(t.type).toBe('function');
      expect(t.function.parameters.type).toBe('object');
      expect(JSON.stringify(t.function.parameters)).not.toMatch(/additionalProperties|\$schema|exclusiveMinimum|default|pattern/);
    }
  });

  it('tool_choice none is sent on the last round', async () => {
    reply = (_n, res) => json(res, completion({ content: 'ok' }));
    await ask(undefined, 'none');
    expect(seen[0]!.body.tool_choice).toBe('none');
  });

  it('simplifySchema keeps types, enums, required and sane bounds, and drops the rest', () => {
    const out = simplifySchema({
      $schema: 'x',
      type: 'object',
      additionalProperties: false,
      required: ['N'],
      properties: { N: { type: 'integer', minimum: -9007199254740991, maximum: 30, default: 5 }, t: { type: 'string', enum: ['a'], pattern: '^a$' } },
    });
    expect(out).toEqual({ type: 'object', required: ['N'], properties: { N: { type: 'integer', maximum: 30 }, t: { type: 'string', enum: ['a'] } } });
  });
});

describe('parsing what Gemini or a router returns', () => {
  it('reads arguments given as a JSON string, as an object, and as nothing', async () => {
    reply = (_n, res) =>
      json(res, completion({ content: null, tool_calls: [toolCall('compute_exposure', '{"N":5,"C":100}', 'a'), toolCall('compute_exposure', { N: 6, C: 10 }, 'b'), toolCall('explain_rule', undefined, 'c')] }, 'tool_calls'));
    const t = await ask();
    expect(t.stopReason).toBe('tool_use');
    const uses = t.content.filter((b) => b.type === 'tool_use') as { id: string; input: unknown; invalidArguments?: true }[];
    expect(uses.map((u) => u.input)).toEqual([{ N: 5, C: 100 }, { N: 6, C: 10 }, {}]);
    expect(uses.every((u) => !u.invalidArguments)).toBe(true);
    expect(t.model).toBe('gateway-model-x');
    expect(t.usage).toEqual({ inputTokens: 7, outputTokens: 3 });
  });

  it('marks arguments that are not valid JSON instead of throwing', async () => {
    reply = (_n, res) => json(res, completion({ content: null, tool_calls: [toolCall('compute_exposure', '{"N":5,'), toolCall('compute_exposure', '[1,2]', 'z')] }, 'tool_calls'));
    const t = await ask();
    const uses = t.content.filter((b) => b.type === 'tool_use') as { invalidArguments?: true }[];
    expect(uses.map((u) => u.invalidArguments)).toEqual([true, true]);
  });

  it('a gateway that says finish_reason "stop" but returns tool_calls still counts as a tool turn', async () => {
    reply = (_n, res) => json(res, completion({ content: '', tool_calls: [toolCall('compute_exposure', '{"N":5,"C":100}')] }, 'stop'));
    expect((await ask()).stopReason).toBe('tool_use');
  });

  it('gives an id to a call that has none, in the block and in the replayed raw message', async () => {
    reply = (_n, res) => json(res, completion({ content: null, tool_calls: [toolCall('compute_exposure', '{"N":5,"C":100}', null)] }, 'tool_calls'));
    const t = await ask();
    expect((t.content[0] as { id: string }).id).toBe('call_0');
    expect((t.raw as { tool_calls: { id: string }[] }).tool_calls[0]!.id).toBe('call_0');
  });

  it('maps length and content_filter, and joins content parts', async () => {
    reply = (_n, res) => json(res, completion({ content: 'cắt' }, 'length'));
    expect((await ask()).stopReason).toBe('max_tokens');
    reply = (_n, res) => json(res, completion({ content: '' }, 'content_filter'));
    expect((await ask()).stopReason).toBe('refusal');
    reply = (_n, res) => json(res, completion({ content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }));
    expect((await ask()).content).toEqual([{ type: 'text', text: 'ab' }]);
  });
});

describe('multi-round: the assistant message goes back exactly as returned', () => {
  it('replays raw (with the thought signature) before the tool messages', async () => {
    const raw = { role: 'assistant', content: null, tool_calls: [toolCall('compute_exposure', '{"N":5,"C":100}', 'call_a')], extra_content: { google: { thought_signature: 'SIG-123' } } };
    reply = (n, res) => json(res, n === 1 ? completion(raw, 'tool_calls') : completion({ content: 'xong' }));
    const first = await ask();
    await client().complete({
      system: 'SYS',
      messages: [
        { role: 'user', content: 'hỏi' },
        { role: 'assistant', content: first.content, raw: first.raw },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call_a', content: '{"maxExposure":"600"}' }] },
      ],
    });
    const sent = seen[1]!.body.messages;
    expect(sent.map((m: any) => m.role)).toEqual(['system', 'user', 'assistant', 'tool']); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(sent[2].extra_content).toEqual({ google: { thought_signature: 'SIG-123' } });
    expect(sent[3]).toEqual({ role: 'tool', tool_call_id: 'call_a', content: '{"maxExposure":"600"}' });
  });

  it('builds an assistant message from blocks when no raw exists (scripted history)', async () => {
    reply = (_n, res) => json(res, completion({ content: 'x' }));
    await ask([
      { role: 'user', content: 'q' },
      { role: 'assistant', content: [{ type: 'text', text: 'đang tính' }, { type: 'tool_use', id: 'c1', name: 'compute_exposure', input: { N: 5, C: 100 } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'c1', content: 'lỗi', is_error: true }] },
    ]);
    const m = seen[0]!.body.messages;
    expect(m[2]).toMatchObject({ role: 'assistant', content: 'đang tính', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'compute_exposure', arguments: '{"N":5,"C":100}' } }] });
    expect(m[3]).toMatchObject({ role: 'tool', tool_call_id: 'c1' });
  });
});

describe('the key never leaks', () => {
  it('a gateway error that echoes the key becomes a status-only ProviderError', async () => {
    reply = (_n, res) => res.writeHead(401, { 'content-type': 'application/json' }).end(JSON.stringify({ error: { message: `bad key ${KEY}` } }));
    const err = await ask().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).status).toBe(401);
    expect(String((err as Error).message) + JSON.stringify(err)).not.toContain(KEY);
  });

  it('end to end through the engine: tool round, final answer, nothing sensitive in events or logs', async () => {
    const final = JSON.stringify({ answer: `Rủi ro lớn nhất là 600 USDC.\n${DISCLAIMER}`, figures: [], citations: [], refused: false });
    reply = (n, res) =>
      json(res, n === 1 ? completion({ content: null, tool_calls: [toolCall('compute_exposure', '{"N":5,"C":100}')] }, 'tool_calls') : completion({ content: final }));
    const logs: string[] = [];
    const events: CopilotEvent[] = [];
    for await (const e of runCopilot({
      request: requestSchema.parse({ messages: [{ role: 'user', content: 'Dây 5 người, mỗi người góp 100 USDC. Rủi ro lớn nhất?' }] }),
      model: client(),
      requestId: 'r1',
      log: (l) => logs.push(JSON.stringify(l)),
    })) {
      events.push(e);
    }
    const answer = events.find((e) => e.type === 'answer') as Extract<CopilotEvent, { type: 'answer' }>;
    expect(answer.source).toBe('model');
    expect(seen).toHaveLength(2);
    expect(seen[1]!.body.messages.at(-1).role).toBe('tool');
    const all = JSON.stringify(events) + logs.join('\n');
    expect(all).not.toContain(KEY);
    expect(all).not.toContain(base);
    expect(logs.join('\n')).toContain('asked-model-medium');
    expect(logs.join('\n')).toContain('gateway-model-x');
  });

  it('through the route: env selects the provider, and the key and address stay out of the response and the console', async () => {
    const final = JSON.stringify({ answer: `Rủi ro lớn nhất là 600 USDC.\n${DISCLAIMER}`, figures: [], citations: [], refused: false });
    reply = (n, res) => {
      if (n === 1) return json(res, completion({ content: null, tool_calls: [toolCall('compute_exposure', '{"N":5,"C":100}')] }, 'tool_calls'));
      return json(res, completion({ content: final }));
    };
    vi.stubEnv('COPILOT_MOCK', '');
    vi.stubEnv('COPILOT_PROVIDER', 'openai-compatible');
    vi.stubEnv('COPILOT_BASE_URL', base);
    vi.stubEnv('COPILOT_API_KEY', KEY);
    vi.stubEnv('COPILOT_MODEL', 'asked-model-medium');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await POST(
      new Request('http://localhost/api/copilot', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.9.9.9' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Dây 5 người, mỗi người góp 100 USDC. Rủi ro lớn nhất?' }] }),
      }),
    );
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).toContain('"source":"model"');
    expect(text + JSON.stringify(spy.mock.calls)).not.toContain(KEY);
    expect(text + JSON.stringify(spy.mock.calls)).not.toContain(base);
    expect(seen[0]!.auth).toBe(`Bearer ${KEY}`);
  });

  it('through the route: a failing router gives a calm error without its body', async () => {
    reply = (_n, res) => res.writeHead(500).end(`boom ${KEY}`);
    vi.stubEnv('COPILOT_MOCK', '');
    vi.stubEnv('COPILOT_PROVIDER', 'openai-compatible');
    vi.stubEnv('COPILOT_BASE_URL', base);
    vi.stubEnv('COPILOT_API_KEY', KEY);
    vi.stubEnv('COPILOT_MODEL', 'asked-model-medium');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await POST(
      new Request('http://localhost/api/copilot', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.9.9.10' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Rủi ro?' }] }),
      }),
    );
    const text = await res.text();
    expect(text).toContain('model_unavailable');
    expect(text + JSON.stringify(spy.mock.calls)).not.toContain(KEY);
  }, 15_000);
});
