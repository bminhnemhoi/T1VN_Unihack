import { describe, expect, it } from 'vitest';
import { parseLine, readNdjson, type StreamEvent } from '@/components/copilot/stream';

describe('copilot NDJSON client', () => {
  it('parses the four event kinds and drops garbage', () => {
    expect(parseLine('{"type":"status","text":"Đang xử lý"}')).toEqual({ type: 'status', text: 'Đang xử lý' });
    expect(parseLine('{"type":"tool","name":"max_bid_table","result":{"rows":[]}}')).toMatchObject({ type: 'tool', name: 'max_bid_table' });
    expect(parseLine('{"type":"answer","answer":{"answer":"Xin chào","refused":false},"source":"model","label":"x"}')).toMatchObject({ type: 'answer' });
    expect(parseLine('{"type":"error","code":"internal","message":"Có lỗi"}')).toEqual({ type: 'error', code: 'internal', message: 'Có lỗi' });
    expect(parseLine('not json')).toBeUndefined();
    expect(parseLine('{"type":"mystery"}')).toBeUndefined();
  });
  it('reassembles lines split across chunks', async () => {
    const enc = new TextEncoder();
    const line = '{"type":"status","text":"abc"}\n{"type":"status","text":"def"}\n';
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(enc.encode(line.slice(0, 17)));
        c.enqueue(enc.encode(line.slice(17)));
        c.close();
      },
    });
    const got: StreamEvent[] = [];
    await readNdjson(stream, (e) => got.push(e));
    expect(got.map((e) => (e.type === 'status' ? e.text : ''))).toEqual(['abc', 'def']);
  });
});
