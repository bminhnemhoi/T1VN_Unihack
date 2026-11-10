/**
 * Client side of `/api/relay` and `/api/attest` (docs/05 sections 8.1 and 8.2). Every failure becomes a
 * `TxFailure` with a stable `code` and a Vietnamese `message`: the server already decodes custom errors, network
 * and parse problems are mapped here. Nothing is logged here; callers must not log signatures or tokens.
 */
import type { ForwardRequestJson } from './sign';

type Address = `0x${string}`;
type Hex = `0x${string}`;

export interface TxFailure {
  ok: false;
  code: string;
  message: string;
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<Response>;

const NETWORK: TxFailure = {
  ok: false,
  code: 'NetworkError',
  message: 'Không kết nối được tới máy chủ. Kiểm tra mạng rồi thử lại.',
};

async function postJson(
  fetchFn: FetchLike,
  url: string,
  body: unknown,
  token?: string | null,
): Promise<{ status: number; json: unknown } | TxFailure> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetchFn(url, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch {
    return NETWORK;
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, code: 'BadResponse', message: 'Máy chủ trả lời không đúng định dạng. Thử lại sau.' };
  }
  return { status: res.status, json };
}

const errorOf = (json: unknown, status: number): TxFailure => {
  const e = (json as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  return {
    ok: false,
    code: typeof e?.code === 'string' ? e.code : `Http${status}`,
    message: typeof e?.message === 'string' ? e.message : 'Giao dịch bị từ chối. Hãy thử lại hoặc báo cho chủ hụi.',
  };
};

/** `POST /api/relay`. `token` (Privy access token) is required by the server for `createCircle`. */
export async function postRelay(
  fetchFn: FetchLike,
  url: string,
  payload: { request: ForwardRequestJson; signature: Hex },
  token?: string | null,
): Promise<{ ok: true; txHash: Hex } | TxFailure> {
  const r = await postJson(fetchFn, url, payload, token);
  if ('ok' in r) return r;
  const hash = (r.json as { txHash?: unknown } | null)?.txHash;
  if (r.status === 200 && typeof hash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(hash)) return { ok: true, txHash: hash as Hex };
  return errorOf(r.json, r.status);
}

/**
 * `POST /api/relay/permit` (docs/05 section 8.2b): the relayer submits a permit the member signed, so a member without
 * AVAX can raise the allowance `payLate`/`repayDebt` need. `skipped` means somebody already submitted it and the
 * allowance is enough: nothing was sent and there is no hash to wait for.
 */
export async function relayPermit(
  fetchFn: FetchLike,
  url: string,
  owner: Address,
  circle: Address,
  permit: { value: bigint; deadline: bigint; v: number; r: Hex; s: Hex },
): Promise<{ ok: true; txHash?: Hex; skipped?: true } | TxFailure> {
  const body = {
    permit: {
      owner,
      spender: circle,
      value: permit.value.toString(),
      deadline: Number(permit.deadline),
      v: permit.v,
      r: permit.r,
      s: permit.s,
    },
  };
  const r = await postJson(fetchFn, url, body);
  if ('ok' in r) return r;
  const j = r.json as { txHash?: unknown; skipped?: unknown } | null;
  if (r.status === 200 && j?.skipped === true) return { ok: true, skipped: true };
  if (r.status === 200 && typeof j?.txHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(j.txHash)) return { ok: true, txHash: j.txHash as Hex };
  return errorOf(r.json, r.status);
}

export interface AttestationResponse {
  attestation: { member: Address; circle: Address; attestationId: Hex; expiry: bigint };
  signature: Hex;
}

/** `POST /api/attest`: the wallet comes from the Privy account on the server, never from the body. */
export async function requestAttestation(
  fetchFn: FetchLike,
  url: string,
  circle: Address,
  token: string | null | undefined,
  /** The user's own tick "đủ 18 tuổi" (docs/05 section 8.1). Never defaulted: the UI must ask. */
  ageConfirmed: boolean,
): Promise<{ ok: true; value: AttestationResponse } | TxFailure> {
  if (!ageConfirmed) return { ok: false, code: 'AgeNotConfirmed', message: 'Bạn cần xác nhận đủ 18 tuổi để vào dây.' };
  if (!token) return { ok: false, code: 'NotLoggedIn', message: 'Bạn cần đăng nhập trước.' };
  const r = await postJson(fetchFn, url, { circle, ageConfirmed }, token);
  if ('ok' in r) return r;
  const j = r.json as { attestation?: Record<string, unknown>; signature?: unknown } | null;
  const a = j?.attestation;
  const isAddr = (v: unknown): v is Address => typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);
  const isHex32 = (v: unknown): v is Hex => typeof v === 'string' && /^0x[0-9a-fA-F]{64}$/.test(v);
  if (r.status === 200) {
    if (
      a &&
      typeof j?.signature === 'string' &&
      /^0x[0-9a-fA-F]+$/.test(j.signature) &&
      isAddr(a.member) &&
      isAddr(a.circle) &&
      a.circle.toLowerCase() === circle.toLowerCase() &&
      isHex32(a.attestationId) &&
      typeof a.expiry === 'string' &&
      /^\d{1,20}$/.test(a.expiry)
    ) {
      return {
        ok: true,
        value: {
          attestation: { member: a.member, circle: a.circle, attestationId: a.attestationId, expiry: BigInt(a.expiry) },
          signature: j.signature as Hex,
        },
      };
    }
    return { ok: false, code: 'BadResponse', message: 'Máy chủ trả lời không đúng định dạng. Thử lại sau.' };
  }
  return errorOf(r.json, r.status);
}
