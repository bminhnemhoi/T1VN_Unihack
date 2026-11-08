/**
 * POST /api/attest core (docs/05 section 8.1, docs/04 section 3.2). Issues a `MemberAttestation` signed by the
 * attester key: one wallet per person (the wallet comes from Privy, never from the request), a person-and-circle
 * specific `attestationId` that cannot be inverted, 20 requests per hour per person, valid for one hour.
 * Everything the route needs is injected so tests can fake Privy, the chain and the clock.
 */
import { encodePacked, keccak256, type Hex } from 'viem';
import { z } from 'zod';
import { attestationTypes, huiSafeDomain } from 'sdk';
import { errorResponse, jsonResponse, readLimited, clientIp, type Logger } from './http';
import { InvalidTokenError, NoWalletError, type PrivyVerifier } from './privy';
import type { SlidingWindowLimiter } from './ratelimit';

type Address = `0x${string}`;

export const ATTESTATION_TTL_SECONDS = 3600;
export const ATTEST_PER_HOUR = 20;
const MAX_BODY_BYTES = 2048;

const bodySchema = z.object({
  circle: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  /** The user ticked "I am 18 or older" (docs/04 section 3.2). Anything but literal true is refused. */
  ageConfirmed: z.literal(true),
});

export interface AttesterSigner {
  address: Address;
  signTypedData(args: {
    domain: ReturnType<typeof huiSafeDomain>;
    types: typeof attestationTypes;
    primaryType: 'MemberAttestation';
    message: { member: Address; circle: Address; attestationId: Hex; expiry: bigint };
  }): Promise<Hex>;
}

export interface AttestDeps {
  verifier: PrivyVerifier;
  attester: AttesterSigner;
  /** Server-only secret mixed into `attestationId` so it cannot be recomputed from a DID. */
  idSecret: string;
  chainId: number;
  /** `factory.isCircle(circle)`. */
  isCircle(circle: Address): Promise<boolean>;
  userLimiter: SlidingWindowLimiter;
  ipLimiter: SlidingWindowLimiter;
  now: () => number;
  requestId: () => string;
  log: Logger;
}

/** attestationId = keccak256(serverSecret || privyUserId || circle) (docs/05 section 8.1). */
export function computeAttestationId(idSecret: string, userId: string, circle: Address): Hex {
  return keccak256(
    encodePacked(['bytes', 'bytes', 'address'], [toBytesHex(idSecret), toBytesHex(userId), circle]),
  );
}

const toBytesHex = (s: string): Hex => `0x${Buffer.from(s, 'utf8').toString('hex')}`;

export function createAttestHandler(deps: AttestDeps): (req: Request) => Promise<Response> {
  return async function POST(req: Request): Promise<Response> {
    const requestId = deps.requestId();
    const started = deps.now();
    const done = (res: Response, outcome: string): Response => {
      deps.log('info', 'attest', { requestId, outcome, status: res.status, ms: deps.now() - started });
      return res;
    };

    const ip = deps.ipLimiter.take(clientIp(req));
    if (!ip.ok) {
      return done(
        errorResponse(429, 'RateLimited', 'Bạn gửi quá nhiều yêu cầu. Hãy thử lại sau.', {
          'retry-after': String(ip.retryAfterSec),
        }),
        'ip-limited',
      );
    }

    const auth = req.headers.get('authorization') ?? '';
    const token = /^Bearer\s+(\S+)$/i.exec(auth)?.[1];
    if (!token) return done(errorResponse(401, 'Unauthorized', 'Cần đăng nhập để xin xác nhận.'), 'no-token');

    let identity;
    try {
      identity = await deps.verifier.verify(token);
    } catch (e) {
      if (e instanceof NoWalletError) {
        return done(errorResponse(409, 'NoWallet', 'Tài khoản chưa có ví. Hãy đăng nhập lại để tạo ví.'), 'no-wallet');
      }
      if (e instanceof InvalidTokenError) {
        return done(errorResponse(401, 'Unauthorized', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'), 'bad-token');
      }
      deps.log('error', 'attest privy failure', { requestId });
      return done(errorResponse(502, 'AuthUnavailable', 'Chưa xác minh được đăng nhập. Hãy thử lại.'), 'privy-error');
    }

    const user = deps.userLimiter.take(identity.userId);
    if (!user.ok) {
      return done(
        errorResponse(429, 'RateLimited', 'Bạn xin xác nhận quá nhiều lần. Hãy thử lại sau.', {
          'retry-after': String(user.retryAfterSec),
        }),
        'user-limited',
      );
    }

    const raw = await readLimited(req, MAX_BODY_BYTES);
    if (raw === null) return done(errorResponse(413, 'TooLarge', 'Yêu cầu quá lớn.'), 'too-large');
    let parsed;
    try {
      parsed = bodySchema.safeParse(JSON.parse(raw));
    } catch {
      parsed = undefined;
    }
    if (!parsed?.success) {
      const age = (() => {
        try {
          return (JSON.parse(raw) as { ageConfirmed?: unknown }).ageConfirmed !== true;
        } catch {
          return false;
        }
      })();
      return done(
        age
          ? errorResponse(400, 'AgeNotConfirmed', 'Bạn cần tự xác nhận đã đủ 18 tuổi.')
          : errorResponse(400, 'BadRequest', 'Yêu cầu không hợp lệ.'),
        'bad-body',
      );
    }
    const circle = parsed.data.circle as Address;

    let known: boolean;
    try {
      known = await deps.isCircle(circle);
    } catch {
      deps.log('error', 'attest chain failure', { requestId });
      return done(errorResponse(502, 'ChainUnavailable', 'Chưa đọc được dữ liệu từ mạng. Hãy thử lại.'), 'chain-error');
    }
    if (!known) return done(errorResponse(404, 'NotCircle', 'Địa chỉ này không phải một dây của HụiSafe.'), 'not-circle');

    const attestationId = computeAttestationId(deps.idSecret, identity.userId, circle);
    const expiry = BigInt(Math.floor(deps.now() / 1000) + ATTESTATION_TTL_SECONDS);
    const message = { member: identity.wallet, circle, attestationId, expiry };
    const signature = await deps.attester.signTypedData({
      domain: huiSafeDomain(circle, deps.chainId),
      types: attestationTypes,
      primaryType: 'MemberAttestation',
      message,
    });

    return done(
      jsonResponse(200, {
        attestation: {
          member: message.member,
          circle,
          attestationId,
          expiry: expiry.toString(),
        },
        signature,
      }),
      'issued',
    );
  };
}
