import { describe, expect, it } from 'vitest';
import { clientIp, takeIp, trustProxyFrom } from './http';
import { SlidingWindowLimiter } from './ratelimit';

const req = (headers: Record<string, string>) => new Request('http://x/api/relay', { method: 'POST', headers });

describe('clientIp', () => {
  it('has no IP at all unless the proxy is trusted (the headers are client-controlled)', () => {
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4' }))).toBeNull();
    expect(clientIp(req({ 'x-real-ip': '1.2.3.4' }), false)).toBeNull();
    expect(clientIp(req({}))).toBeNull();
  });

  it('with a trusted proxy takes the last x-forwarded-for entry (the one the proxy saw), then x-real-ip', () => {
    expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 1.2.3.4' }), true)).toBe('1.2.3.4');
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4' }), true)).toBe('1.2.3.4');
    expect(clientIp(req({ 'x-real-ip': ' 5.6.7.8 ' }), true)).toBe('5.6.7.8');
    expect(clientIp(req({}), true)).toBeNull();
  });
});

describe('takeIp', () => {
  it('never charges nor blocks without a trustworthy IP, so anonymous traffic cannot exhaust a shared bucket (audit A15 H-01)', () => {
    const limiter = new SlidingWindowLimiter(1, 3_600_000, () => 0);
    for (let i = 0; i < 50; i++) expect(takeIp(limiter, req({ 'x-forwarded-for': `9.9.9.${i}` }), false).ok).toBe(true);
    expect(limiter.take('probe').ok).toBe(true); // nothing was recorded
  });

  it('charges per address behind a trusted proxy', () => {
    const limiter = new SlidingWindowLimiter(1, 3_600_000, () => 0);
    expect(takeIp(limiter, req({ 'x-forwarded-for': '1.2.3.4' }), true).ok).toBe(true);
    expect(takeIp(limiter, req({ 'x-forwarded-for': '1.2.3.4' }), true).ok).toBe(false);
    expect(takeIp(limiter, req({ 'x-forwarded-for': '5.6.7.8' }), true).ok).toBe(true);
  });
});

describe('trustProxyFrom', () => {
  it('is on only for the exact string true', () => {
    expect(trustProxyFrom({ TRUST_PROXY: 'true' })).toBe(true);
    for (const v of [undefined, '', 'TRUE', '1', 'yes', 'false']) expect(trustProxyFrom({ TRUST_PROXY: v })).toBe(false);
  });
});
