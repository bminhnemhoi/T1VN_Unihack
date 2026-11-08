import { describe, expect, it } from 'vitest';
import { lazyHandler } from './env';
import { ConfigError } from './chain';

const req = () => new Request('http://x/api/relay', { method: 'POST', body: '{}' });

describe('lazyHandler', () => {
  it('M-01: a handler error does not rebuild the handler (limiters and nonce mutex survive)', async () => {
    let builds = 0;
    const h = lazyHandler(async () => {
      builds++;
      return async () => {
        throw new Error('stream aborted');
      };
    }, 'test');
    expect((await h(req())).status).toBe(500);
    expect((await h(req())).status).toBe(500);
    expect(builds).toBe(1);
  });

  it('a failed build answers 503 and is retried on the next request', async () => {
    let builds = 0;
    const h = lazyHandler(async () => {
      builds++;
      if (builds === 1) throw new ConfigError('missing environment variable X');
      return async () => new Response('ok');
    }, 'test');
    expect((await h(req())).status).toBe(503);
    expect((await h(req())).status).toBe(200);
    expect(builds).toBe(2);
  });
});
