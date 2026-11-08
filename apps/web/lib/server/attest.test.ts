import { recoverTypedDataAddress } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { describe, expect, it } from 'vitest';
import { attestationTypes, huiSafeDomain } from 'sdk';
import { ATTEST_PER_HOUR, computeAttestationId, createAttestHandler, type AttestDeps } from './attest';
import { InvalidTokenError, NoWalletError, type PrivyVerifier } from './privy';
import { SlidingWindowLimiter } from './ratelimit';

const circle = '0x1111111111111111111111111111111111111111' as const;
const wallet = '0x2222222222222222222222222222222222222222' as const;
const attester = privateKeyToAccount(generatePrivateKey());
const NOW = 1_800_000_000_000;

function makeDeps(over: Partial<AttestDeps> = {}): AttestDeps & { logs: string[] } {
  const logs: string[] = [];
  const verifier: PrivyVerifier = {
    async verify(token) {
      if (token === 'bad') throw new InvalidTokenError('x');
      if (token === 'nowallet') throw new NoWalletError('x');
      return { userId: `did:privy:${token}`, wallet };
    },
  };
  return {
    verifier,
    attester: { address: attester.address, signTypedData: (a) => attester.signTypedData(a) },
    idSecret: 'server-secret',
    chainId: 43113,
    isCircle: async (c) => c === circle,
    userLimiter: new SlidingWindowLimiter(ATTEST_PER_HOUR, 3_600_000, () => NOW),
    ipLimiter: new SlidingWindowLimiter(1000, 3_600_000, () => NOW),
    now: () => NOW,
    requestId: () => 'req-1',
    log: (_l, m, f) => void logs.push(JSON.stringify({ m, ...f })),
    ...over,
    logs,
  };
}

const call = (h: (r: Request) => Promise<Response>, body: unknown, token: string | null = 'alice') =>
  h(
    new Request('http://x/api/attest', {
      method: 'POST',
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );

describe('POST /api/attest', () => {
  it('issues an attestation the attester signed, for the Privy wallet, valid one hour', async () => {
    const deps = makeDeps();
    const res = await call(createAttestHandler(deps), { circle, ageConfirmed: true });
    expect(res.status).toBe(200);
    const out = (await res.json()) as {
      attestation: { member: string; circle: string; attestationId: `0x${string}`; expiry: string };
      signature: `0x${string}`;
    };
    expect(out.attestation.member).toBe(wallet);
    expect(out.attestation.expiry).toBe(String(NOW / 1000 + 3600));
    expect(out.attestation.attestationId).toBe(computeAttestationId('server-secret', 'did:privy:alice', circle));
    const signer = await recoverTypedDataAddress({
      domain: huiSafeDomain(circle, 43113),
      types: attestationTypes,
      primaryType: 'MemberAttestation',
      message: { ...out.attestation, member: wallet, circle, expiry: BigInt(out.attestation.expiry) },
      signature: out.signature,
    });
    expect(signer).toBe(attester.address);
  });

  it('attestationId is stable per person and circle, differs across people and secrets, and hides the DID', () => {
    const a = computeAttestationId('s', 'did:privy:alice', circle);
    expect(computeAttestationId('s', 'did:privy:alice', circle)).toBe(a);
    expect(computeAttestationId('s', 'did:privy:bob', circle)).not.toBe(a);
    expect(computeAttestationId('t', 'did:privy:alice', circle)).not.toBe(a);
    expect(computeAttestationId('s', 'did:privy:alice', wallet)).not.toBe(a);
  });

  it('rejects a missing, invalid token, or a user without a wallet', async () => {
    const h = createAttestHandler(makeDeps());
    expect((await call(h, { circle, ageConfirmed: true }, null)).status).toBe(401);
    expect((await call(h, { circle, ageConfirmed: true }, 'bad')).status).toBe(401);
    const noWallet = await call(h, { circle, ageConfirmed: true }, 'nowallet');
    expect(noWallet.status).toBe(409);
  });

  it('requires the 18+ self confirmation and a valid circle address', async () => {
    const h = createAttestHandler(makeDeps());
    const age = await call(h, { circle, ageConfirmed: false });
    expect(age.status).toBe(400);
    expect(((await age.json()) as { error: { code: string } }).error.code).toBe('AgeNotConfirmed');
    expect((await call(h, { circle: 'nope', ageConfirmed: true })).status).toBe(400);
    expect((await call(h, 'not json')).status).toBe(400);
  });

  it('refuses addresses the factory did not create', async () => {
    const h = createAttestHandler(makeDeps());
    const res = await call(h, { circle: wallet, ageConfirmed: true });
    expect(res.status).toBe(404);
  });

  it('limits each person to 20 attestations per hour', async () => {
    const h = createAttestHandler(makeDeps());
    for (let i = 0; i < ATTEST_PER_HOUR; i++) {
      expect((await call(h, { circle, ageConfirmed: true })).status).toBe(200);
    }
    const blocked = await call(h, { circle, ageConfirmed: true });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
    expect((await call(h, { circle, ageConfirmed: true }, 'carol')).status).toBe(200);
  });

  it('never logs the token, the DID or the signature', async () => {
    const deps = makeDeps();
    await call(createAttestHandler(deps), { circle, ageConfirmed: true }, 'alice-secret-token');
    const all = deps.logs.join('\n');
    expect(all).not.toContain('alice');
    expect(all).not.toContain('0x'.padEnd(10, 'f'));
    expect(all).toContain('req-1');
  });
});
