import { describe, expect, it } from 'vitest';
import { UNTRUSTED_IP_KEY, clientIp, trustProxyFrom } from './http';

const req = (headers: Record<string, string>) => new Request('http://x/api/relay', { method: 'POST', headers });

describe('clientIp', () => {
  it('ignores proxy headers unless the proxy is trusted', () => {
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4' }))).toBe(UNTRUSTED_IP_KEY);
    expect(clientIp(req({ 'x-real-ip': '1.2.3.4' }), false)).toBe(UNTRUSTED_IP_KEY);
    expect(clientIp(req({}))).toBe(UNTRUSTED_IP_KEY);
  });

  it('with a trusted proxy takes the last x-forwarded-for entry (the one the proxy saw), then x-real-ip', () => {
    expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 1.2.3.4' }), true)).toBe('1.2.3.4');
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4' }), true)).toBe('1.2.3.4');
    expect(clientIp(req({ 'x-real-ip': ' 5.6.7.8 ' }), true)).toBe('5.6.7.8');
    expect(clientIp(req({}), true)).toBe(UNTRUSTED_IP_KEY);
  });
});

describe('trustProxyFrom', () => {
  it('is on only for the exact string true', () => {
    expect(trustProxyFrom({ TRUST_PROXY: 'true' })).toBe(true);
    for (const v of [undefined, '', 'TRUE', '1', 'yes', 'false']) expect(trustProxyFrom({ TRUST_PROXY: v })).toBe(false);
  });
});
