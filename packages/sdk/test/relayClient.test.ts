import { describe, expect, it } from 'vitest';
import { postRelay, requestAttestation, type FetchLike } from '../src/relayClient';

const reply = (status: number, body: unknown): FetchLike => async () =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const payload = { request: { from: '0x1', to: '0x2', value: '0', gas: '1', deadline: 1, data: '0x' }, signature: '0x00' } as never;
const HASH = `0x${'1'.repeat(64)}`;

describe('postRelay', () => {
  it('returns the tx hash on 200', async () => {
    expect(await postRelay(reply(200, { txHash: HASH }), '/api/relay', payload)).toEqual({ ok: true, txHash: HASH });
  });
  it('passes the server error code and Vietnamese message through', async () => {
    const r = await postRelay(reply(400, { error: { code: 'BidTooHigh', message: 'Tiền thăm vượt trần' } }), '/api/relay', payload);
    expect(r).toEqual({ ok: false, code: 'BidTooHigh', message: 'Tiền thăm vượt trần' });
  });
  it('maps a network failure and a non-JSON reply', async () => {
    const boom: FetchLike = async () => {
      throw new TypeError('fetch failed');
    };
    expect(await postRelay(boom, '/api/relay', payload)).toMatchObject({ ok: false, code: 'NetworkError' });
    const html: FetchLike = async () => new Response('<html>', { status: 502 });
    expect(await postRelay(html, '/api/relay', payload)).toMatchObject({ ok: false, code: 'BadResponse' });
  });
  it('rejects a 200 without a valid hash', async () => {
    expect(await postRelay(reply(200, { txHash: 'nope' }), '/api/relay', payload)).toMatchObject({ ok: false });
  });
  it('sends the bearer token only when given', async () => {
    let seen: Record<string, string> = {};
    const f: FetchLike = async (_u, init) => {
      seen = init.headers;
      return new Response(JSON.stringify({ txHash: HASH }), { status: 200 });
    };
    await postRelay(f, '/api/relay', payload);
    expect(seen.authorization).toBeUndefined();
    await postRelay(f, '/api/relay', payload, 'tok');
    expect(seen.authorization).toBe('Bearer tok');
  });
});

describe('requestAttestation', () => {
  const C = '0x00000000000000000000000000000000000000c1' as const;
  const ok = {
    attestation: { member: '0x00000000000000000000000000000000000000a1', circle: C, attestationId: `0x${'ab'.repeat(32)}`, expiry: '1800000000' },
    signature: '0xabcd',
  };
  it('refuses without the age tick or without a login, before any request', async () => {
    const never: FetchLike = async () => {
      throw new Error('must not be called');
    };
    expect(await requestAttestation(never, '/a', C, 'tok', false)).toMatchObject({ code: 'AgeNotConfirmed' });
    expect(await requestAttestation(never, '/a', C, null, true)).toMatchObject({ code: 'NotLoggedIn' });
  });
  it('parses the attestation and turns expiry into bigint', async () => {
    const r = await requestAttestation(reply(200, ok), '/a', C, 'tok', true);
    expect(r).toMatchObject({ ok: true, value: { attestation: { expiry: 1_800_000_000n }, signature: '0xabcd' } });
  });
  it('rejects a malformed attestation or one for another circle (no throw)', async () => {
    const wrongCircle = { ...ok, attestation: { ...ok.attestation, circle: '0x00000000000000000000000000000000000000c2' } };
    expect(await requestAttestation(reply(200, wrongCircle), '/a', C, 'tok', true)).toMatchObject({ code: 'BadResponse' });
    const badExpiry = { ...ok, attestation: { ...ok.attestation, expiry: 'abc' } };
    expect(await requestAttestation(reply(200, badExpiry), '/a', C, 'tok', true)).toMatchObject({ code: 'BadResponse' });
  });
  it('passes server errors through', async () => {
    expect(await requestAttestation(reply(429, { error: { code: 'RateLimited', message: 'Quá nhiều yêu cầu' } }), '/a', C, 'tok', true)).toMatchObject({
      code: 'RateLimited',
    });
  });
});
