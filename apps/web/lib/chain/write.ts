/**
 * Write flows (A11): framework-free async functions, one per button. Each one signs EIP-712 data with the member's
 * wallet, relays it through `POST /api/relay` (the member pays no gas), waits for the receipt and returns a typed
 * result. They NEVER throw for expected problems: a failure is `{ ok: false, code, message }` with a Vietnamese
 * message (custom errors decoded by the server / `packages/sdk/errors.ts`). `onMined` lets the hook layer invalidate
 * the A10 queries. The LLM never reaches this file (hard rule 5).
 *
 * Security notes: signatures, tokens and salts are never logged here; the bid salt is saved to IndexedDB BEFORE the
 * commit is sent; the dev wallet refuses non-anvil domains (`wallet.ts`).
 */
import { encodeFunctionData, parseEventLogs, type Abi } from 'viem';
import {
  commitHash,
  decodeError,
  encodeJoin,
  formatUsdc,
  huiCircleFullAbi,
  huiFactoryAbi,
  loadSalt,
  mockUsdcAbi,
  newSalt,
  postRelay,
  readCircle,
  relayPermit,
  repayPermitQuote,
  requestAttestation,
  saltKey,
  saveSalt,
  signForwardRequest,
  signPermit,
  signRepayPermit,
  indexedDbSaltStore,
  type CircleView,
  type FetchLike,
  type PermitArg,
  type SaltStore,
  type SignContext,
  type TxFailure,
} from 'sdk';
import type { ChainConfig } from './config';
import type { HuiWallet } from './wallet';

type Address = `0x${string}`;
type Hex = `0x${string}`;

export interface TxContext {
  chain: ChainConfig;
  wallet: HuiWallet;
  /** Privy access token provider; required by `/api/attest` and by `createCircle` on `/api/relay`. */
  getAccessToken?: () => Promise<string | null>;
  fetchFn?: FetchLike;
  relayUrl?: string;
  /** `POST /api/relay/permit` (docs/05 8.2b): lets a member without AVAX raise the allowance `payLate`/`repayDebt` need. */
  permitUrl?: string;
  attestUrl?: string;
  saltStore?: SaltStore;
  /** Called after a mined success, e.g. to invalidate the read queries. */
  onMined?: (r: TxSuccess) => void | Promise<void>;
}

export interface TxSuccess {
  ok: true;
  txHash: Hex;
  blockNumber: bigint;
  gasUsed: bigint;
}
export type TxResult<T extends object = object> = (TxSuccess & T) | TxFailure;

const GAS = { light: 600_000n, join: 1_000_000n, heavy: 5_000_000n, create: 1_800_000n, repay: 900_000n } as const;
const REQUEST_TTL_SEC = 600;
const PERMIT_TTL_SEC = 3600;
/** Repayment permits go through /api/relay/permit, which accepts at most one hour; leave room for block-time drift. */
const REPAY_PERMIT_TTL_SEC = 1800;

const fail = (code: string, message: string): TxFailure => ({ ok: false, code, message });
const defaultFetch: FetchLike = (url, init) => globalThis.fetch(url, init);

const sameAddr = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

async function chainNow(ctx: TxContext): Promise<number> {
  return Number((await ctx.chain.client.getBlock({ blockTag: 'latest' })).timestamp);
}

const signCtx = (ctx: TxContext): SignContext => ({
  publicClient: ctx.chain.client,
  signer: ctx.wallet.signer,
  chainId: ctx.chain.chainId,
});

function guard(ctx: TxContext): TxFailure | undefined {
  if (ctx.wallet.chainId !== ctx.chain.chainId) {
    return fail('WrongChain', 'Ví đang ở mạng khác với HụiSafe. Hãy chuyển sang mạng Fuji.');
  }
  return undefined;
}

const UNEXPECTED = 'Không đọc được dữ liệu từ mạng hoặc ví. Hãy thử lại sau.';

/** Per-wallet queue: two clicks must not sign with the same forwarder nonce (audit I-04). */
const queues = new Map<string, Promise<unknown>>();
function serial<T>(key: string, job: () => Promise<T>): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve();
  const next = prev.then(job, job);
  queues.set(key, next.catch(() => undefined));
  return next;
}

/** Expected problems are results, but an unexpected throw (RPC down, wallet crash) must not escape either (audit L-03). */
async function safely<T extends object>(job: () => Promise<TxResult<T>>): Promise<TxResult<T>> {
  try {
    return await job();
  } catch (e) {
    const d = decodeError(e);
    return fail(d.code === 'Unknown' ? 'Unexpected' : d.code, d.code === 'Unknown' ? UNEXPECTED : d.message);
  }
}

/**
 * Progress of the transaction being sent (sign, send through the relay, wait for the receipt), so the button can show
 * "Ký -> Gửi -> Xác nhận" (lamng-design-rule section 1). Calls are serialised per wallet, so one channel is enough.
 */
export type TxStep = 'sign' | 'send' | 'confirm';
export const txSteps: EventTarget | undefined = typeof EventTarget === 'undefined' ? undefined : new EventTarget();
const step = (s: TxStep): void => void txSteps?.dispatchEvent(new CustomEvent<TxStep>('step', { detail: s }));

/** Sign a forward request for `data`, relay it, wait for the receipt. */
function relayCall(
  ctx: TxContext,
  to: Address,
  data: Hex,
  gas: bigint,
  opts: { needToken?: boolean } = {},
): Promise<TxResult> {
  return safely(() => serial(ctx.wallet.address.toLowerCase(), () => relayOnce(ctx, to, data, gas, opts)));
}

async function relayOnce(
  ctx: TxContext,
  to: Address,
  data: Hex,
  gas: bigint,
  opts: { needToken?: boolean },
): Promise<TxResult> {
  const bad = guard(ctx);
  if (bad) return bad;
  const token = opts.needToken ? await ctx.getAccessToken?.() : undefined;
  if (opts.needToken && !token) return fail('NotLoggedIn', 'Bạn cần đăng nhập trước.');
  let signed;
  step('sign');
  try {
    signed = await signForwardRequest(signCtx(ctx), ctx.chain.forwarder, to, data, {
      gas,
      deadlineSec: (await chainNow(ctx)) + REQUEST_TTL_SEC,
    });
  } catch {
    return fail('SignRejected', 'Ví không ký được hoặc bạn đã huỷ. Chưa có giao dịch nào được gửi.');
  }
  step('send');
  const sent = await postRelay(ctx.fetchFn ?? defaultFetch, ctx.relayUrl ?? '/api/relay', signed, token);
  if (!sent.ok) return sent;
  step('confirm');
  let receipt;
  try {
    receipt = await ctx.chain.client.waitForTransactionReceipt({ hash: sent.txHash });
  } catch (e) {
    return fail(decodeError(e).code, 'Giao dịch đã gửi nhưng chưa xác nhận được. Hãy tải lại trang để xem kết quả.');
  }
  if (receipt.status !== 'success') return fail('Reverted', 'Giao dịch bị từ chối trên mạng.');
  const ok: TxSuccess & { receipt: typeof receipt } = {
    ok: true,
    txHash: sent.txHash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
    receipt,
  };
  await ctx.onMined?.(ok);
  return ok;
}

const circleCall = (ctx: TxContext, circle: Address, fn: string, args: readonly unknown[], gas: bigint = GAS.light): Promise<TxResult> =>
  relayCall(ctx, circle, encodeFunctionData({ abi: huiCircleFullAbi as Abi, functionName: fn, args } as never), gas);

const readCircleFn = <T,>(ctx: TxContext, circle: Address, functionName: string, args: readonly unknown[] = []): Promise<T> =>
  ctx.chain.client.readContract({ address: circle, abi: huiCircleFullAbi, functionName, args } as never) as Promise<T>;

async function permitFor(ctx: TxContext, circle: Address, value: bigint): Promise<PermitArg> {
  return signPermit(signCtx(ctx), ctx.chain.usdc, circle, value, BigInt((await chainNow(ctx)) + PERMIT_TTL_SEC));
}

// ------------------------------------------------------------------------------------------------ Forming

export interface CreateCircleInput {
  mode: 0 | 1; // 0 Fixed, 1 Bidding
  memberCount: number;
  contribution: bigint;
  periodSeconds: number;
  roundDuration: number;
  commitWindow: number;
  revealWindow: number;
  graceSeconds: number;
  alphaBps: number;
  commissionMode: boolean;
  feeBps: number;
  reserveBps: number;
  revealBondBps: number;
  capBps: number;
  joinDeadline: bigint;
  organizerIsMember: boolean;
  label: Hex;
  /** phi in bps of the interest room (docs/03 2.7); 0 = fixed fee. */
  commissionShareBps: number;
  /** keccak256 of the agreement text (ADR-27), see `termsHashOf` in the SDK. */
  termsHash: Hex;
}

/** `factory.createCircle`. Needs a Privy login (the relay checks it). Returns the new circle address. */
export function createCircle(ctx: TxContext, params: CreateCircleInput): Promise<TxResult<{ circle: Address }>> {
  return safely(() => createCircleInner(ctx, params));
}

async function createCircleInner(ctx: TxContext, params: CreateCircleInput): Promise<TxResult<{ circle: Address }>> {
  const data = encodeFunctionData({ abi: huiFactoryAbi, functionName: 'createCircle', args: [params] });
  const r = await relayCall(ctx, ctx.chain.factory, data, GAS.create, { needToken: true });
  if (!r.ok) return r;
  const logs = parseEventLogs({
    abi: huiFactoryAbi,
    eventName: 'CircleCreated',
    logs: (r as unknown as { receipt: { logs: never[] } }).receipt.logs,
  });
  const circle = logs[0]?.args.circle;
  if (!circle) return fail('NoCircle', 'Dây đã tạo nhưng không đọc được địa chỉ. Hãy xem trong danh sách dây.');
  return { ...r, circle };
}

/**
 * Organizer bond with a permit for `amount` PLUS whatever allowance the organizer already granted this circle. A permit
 * overwrites the allowance, so an organizer who is also a member (joined first) would otherwise lose the allowance the
 * member contributions need (audit M-01).
 */
export function depositBond(ctx: TxContext, circle: Address, amount: bigint): Promise<TxResult> {
  return safely(async () => {
    if (amount <= 0n) return fail('InvalidAmount', 'Số tiền ký quỹ phải lớn hơn 0.');
    const current = (await ctx.chain.client.readContract({
      address: ctx.chain.usdc,
      abi: mockUsdcAbi,
      functionName: 'allowance',
      args: [ctx.wallet.address, circle],
    })) as bigint;
    let permit: PermitArg;
    try {
      permit = await permitFor(ctx, circle, amount + current);
    } catch {
      return fail('SignRejected', 'Ví không ký được hoặc bạn đã huỷ. Chưa có giao dịch nào được gửi.');
    }
    return circleCall(ctx, circle, 'depositBond', [amount, permit]);
  });
}

/**
 * Join: attestation from `/api/attest` (needs the user's own 18+ tick) plus a permit of EXACTLY `requiredAllowance`.
 * The circle calls `permit(member, circle, requiredAllowance, ...)` itself, so a permit signed for any other value
 * (for example 1 C extra, as DE-XUAT-M02 section 6.1 suggested) fails the signature check silently and `join` then
 * reverts `InsufficientAllowance`. Headroom for late fees is added later by the repay permit instead.
 */
export function join(ctx: TxContext, circle: Address, opts: { ageConfirmed: boolean }): Promise<TxResult> {
  return safely(() => joinInner(ctx, circle, opts));
}

async function joinInner(ctx: TxContext, circle: Address, opts: { ageConfirmed: boolean }): Promise<TxResult> {
  const bad = guard(ctx);
  if (bad) return bad;
  const att = await requestAttestation(
    ctx.fetchFn ?? defaultFetch,
    ctx.attestUrl ?? '/api/attest',
    circle,
    await ctx.getAccessToken?.(),
    opts.ageConfirmed,
  );
  if (!att.ok) return att;
  if (!sameAddr(att.value.attestation.member, ctx.wallet.address)) {
    return fail('WalletMismatch', 'Ví đang dùng khác với ví gắn với tài khoản của bạn. Hãy đăng nhập lại.');
  }
  let data: Hex;
  try {
    const permit = await permitFor(ctx, circle, await readCircleFn<bigint>(ctx, circle, 'requiredAllowance'));
    data = encodeJoin(att.value.attestation, att.value.signature, permit);
  } catch {
    return fail('SignRejected', 'Ví không ký được hoặc bạn đã huỷ. Chưa có giao dịch nào được gửi.');
  }
  return relayCall(ctx, circle, data, GAS.join);
}

export const leave = (ctx: TxContext, circle: Address) => circleCall(ctx, circle, 'leave', []);
export const activate = (ctx: TxContext, circle: Address) => circleCall(ctx, circle, 'activate', [], GAS.join);
export const withdrawBond = (ctx: TxContext, circle: Address) => circleCall(ctx, circle, 'withdrawBond', []);

// ------------------------------------------------------------------------------------------------ Bidding

const ZERO_HASH = `0x${'0'.repeat(64)}`;
const candidateKey = (circle: Address, round: number, member: Address, hash: Hex): string =>
  `${saltKey(circle, round, member)}#${hash.toLowerCase()}`;

/**
 * Seal a bid. Checks the round and phase, `bid < C` and `bid <= maxBid(round)` first (a wrong bid could never be
 * revealed and would cost the reveal bond). The salt comes from Web Crypto and is saved to IndexedDB BEFORE anything
 * is sent, both under the usual key and under `key#commitHash`. Nothing is ever deleted or rolled back: when a send
 * fails in an unclear way (timeout after the relay broadcast) the chain may hold the old or the new commit, and
 * `revealBid` picks the salt that matches the commit actually on chain (audit H-01).
 */
export function commitBid(ctx: TxContext, circle: Address, round: number, bid: bigint): Promise<TxResult> {
  return safely(async () => {
    const store = ctx.saltStore ?? indexedDbSaltStore;
    const member = ctx.wallet.address;
    const [params, max, current, phase] = await Promise.all([
      readCircleFn<{ contribution: bigint }>(ctx, circle, 'params'),
      readCircleFn<bigint>(ctx, circle, 'maxBid', [round]),
      readCircleFn<number>(ctx, circle, 'currentRound'),
      readCircleFn<number>(ctx, circle, 'phase'),
    ]);
    if (round !== current) return fail('WrongRound', `Hiện là kỳ ${current}, không phải kỳ ${round}.`);
    if (phase !== 1) return fail('NotInCommitWindow', 'Chưa hoặc không còn trong thời gian nộp thăm kín.');
    if (bid < 0n || bid >= params.contribution) {
      return fail('BidTooHigh', `Tiền thăm phải nhỏ hơn mức góp ${formatUsdc(params.contribution)}.`);
    }
    if (bid > max) return fail('BidTooHigh', `Tiền thăm vượt trần của kỳ này (tối đa ${formatUsdc(max)}).`);

    const salt = newSalt();
    const hash = commitHash(circle, round, member, bid, salt);
    const saved =
      (await saveSalt(circle, round, member, bid, salt, store)) &&
      (await store
        .set(candidateKey(circle, round, member, hash), { bid: bid.toString(), salt, createdAt: Date.now() })
        .then(() => true, () => false));
    if (!saved) {
      return fail('SaltNotSaved', 'Không lưu được mã bí mật của thăm trên máy này, nên chưa nộp thăm để tránh mất cọc. Hãy bật lưu trữ của trình duyệt.');
    }
    return circleCall(ctx, circle, 'commitBid', [hash]);
  });
}

/**
 * Reveal the bid sealed on this device: reads the commit hash that is on chain and uses the saved salt that matches it.
 * Without a matching salt there is nothing to reveal and the reveal bond would be lost, so nothing is sent.
 */
export function revealBid(ctx: TxContext, circle: Address, round: number): Promise<TxResult> {
  return safely(async () => {
    const store = ctx.saltStore ?? indexedDbSaltStore;
    const member = ctx.wallet.address;
    const onchain = await readCircleFn<{ hash: Hex }>(ctx, circle, 'commitOf', [round, member]);
    if (onchain.hash === ZERO_HASH) return fail('NoCommit', 'Bạn chưa nộp thăm kín ở kỳ này.');
    let rec = await store.get(candidateKey(circle, round, member, onchain.hash)).catch(() => undefined);
    if (!rec) {
      const plain = await loadSalt(circle, round, member, store);
      if (plain && commitHash(circle, round, member, plain.bid, plain.salt).toLowerCase() === onchain.hash.toLowerCase()) {
        rec = { bid: plain.bid.toString(), salt: plain.salt, createdAt: plain.createdAt };
      }
    }
    if (!rec) {
      return fail(
        'SaltMissing',
        'Không tìm thấy mã bí mật khớp với thăm đã nộp trên máy này. Hãy nạp lại từ file sao lưu. Nếu không mở thăm, bạn sẽ mất cọc mở thăm.',
      );
    }
    return circleCall(ctx, circle, 'revealBid', [BigInt(rec.bid), rec.salt]);
  });
}

// ------------------------------------------------------------------------------------------------ Repayment

/** Late fees grow every second; the quote adds the request lifetime so the permit value is not too tight. */
const QUOTE_MARGIN_SEC = REQUEST_TTL_SEC;

async function viewOf(ctx: TxContext, circle: Address): Promise<CircleView> {
  return readCircle(ctx.chain.client, circle, { fromBlock: ctx.chain.fromBlock, factory: ctx.chain.factory, vndPerUsdc: ctx.chain.vndPerUsdc });
}

/**
 * `payLate`/`repayDebt` pull with `transferFrom`, and a Privy member has no AVAX to approve. When the allowance is
 * below what the payment AND the remaining contributions need, sign a permit for that total (a permit sets the
 * allowance, it does not add), have the relayer submit it through `/api/relay/permit` and wait until it is mined,
 * so the main call's simulation sees the new allowance (docs/05 8.2b). The member never needs `approve`.
 */
async function ensureRepayAllowance(
  ctx: TxContext,
  circle: Address,
  view: CircleView,
  /** Chain time plus the request lifetime: the permit is signed for this (late fees keep growing). */
  nowWithMargin: number,
  /** Chain time now: what is needed this very second, so a retry right after a permit does not sign another one. */
  nowExact: number,
  opts: { round?: number; principal?: bigint },
): Promise<TxFailure | undefined> {
  const readAllowance = async (): Promise<bigint> =>
    (await ctx.chain.client.readContract({
      address: ctx.chain.usdc,
      abi: mockUsdcAbi,
      functionName: 'allowance',
      args: [ctx.wallet.address, circle],
    })) as bigint;

  const needNow = repayPermitQuote(view, ctx.wallet.address, nowExact, opts);
  if ((await readAllowance()) >= needNow.value) return undefined;

  let signed;
  try {
    signed = await signRepayPermit(signCtx(ctx), ctx.chain.usdc, view, nowWithMargin, opts, BigInt((await chainNow(ctx)) + REPAY_PERMIT_TTL_SEC));
  } catch {
    return fail('SignRejected', 'Ví không ký được hoặc bạn đã huỷ. Chưa có giao dịch nào được gửi.');
  }
  const sent = await relayPermit(ctx.fetchFn ?? defaultFetch, ctx.permitUrl ?? '/api/relay/permit', ctx.wallet.address, circle, signed.permit);
  let problem: TxFailure | undefined = sent.ok ? undefined : sent;
  if (sent.ok && sent.txHash) {
    try {
      const receipt = await ctx.chain.client.waitForTransactionReceipt({ hash: sent.txHash });
      if (receipt.status !== 'success') problem = fail('Reverted', 'Việc cấp quyền trích tiền bị từ chối trên mạng.');
    } catch (e) {
      problem = fail(decodeError(e).code, 'Đã gửi yêu cầu cấp quyền nhưng chưa xác nhận được. Hãy tải lại trang rồi thử lại.');
    }
  }
  if (!problem) return undefined;
  // The chain decides, not the transport (audit M-01): somebody may have front-run the very same permit (our
  // transaction then reverts although the allowance is set), or the relay may have answered late. When the allowance
  // already covers this payment, go on; otherwise report why the permit failed.
  try {
    if ((await readAllowance()) >= needNow.quote.total) return undefined;
  } catch {
    /* keep the original problem */
  }
  return problem;
}

/** Pay a late contribution inside the grace period: principal of that round plus late fee. No `approve` needed. */
export function payLate(ctx: TxContext, circle: Address, round: number): Promise<TxResult> {
  return safely(() => payLateInner(ctx, circle, round));
}

async function payLateInner(ctx: TxContext, circle: Address, round: number): Promise<TxResult> {
  const bad = guard(ctx);
  if (bad) return bad;
  const view = await viewOf(ctx, circle);
  const nowExact = await chainNow(ctx);
  const opts = { round };
  if (repayPermitQuote(view, ctx.wallet.address, nowExact, opts).quote.principal === 0n) {
    return fail('NoShortfall', 'Không có khoản thiếu nào cần xử lý ở kỳ này.');
  }
  const short = await ensureRepayAllowance(ctx, circle, view, nowExact + QUOTE_MARGIN_SEC, nowExact, opts);
  if (short) return short;
  return circleCall(ctx, circle, 'payLate', [round], GAS.repay);
}

/** Repay `principal` of a defaulted debt (oldest round first), principal plus fees. No `approve` needed. */
export function repayDebt(ctx: TxContext, circle: Address, principal: bigint): Promise<TxResult> {
  return safely(() => repayDebtInner(ctx, circle, principal));
}

async function repayDebtInner(ctx: TxContext, circle: Address, principal: bigint): Promise<TxResult> {
  if (principal <= 0n) return fail('InvalidAmount', 'Số tiền trả phải lớn hơn 0.');
  const bad = guard(ctx);
  if (bad) return bad;
  const view = await viewOf(ctx, circle);
  const owed = repayPermitQuote(view, ctx.wallet.address, 0).quote;
  if (principal > owed.principal) return fail('RepayTooLarge', `Số tiền trả vượt quá khoản còn nợ (${formatUsdc(owed.principal)}).`);
  const nowExact = await chainNow(ctx);
  const short = await ensureRepayAllowance(ctx, circle, view, nowExact + QUOTE_MARGIN_SEC, nowExact, { principal });
  if (short) return short;
  return circleCall(ctx, circle, 'repayDebt', [principal], GAS.repay);
}

export const claim = (ctx: TxContext, circle: Address) => circleCall(ctx, circle, 'claim', []);

// ------------------------------------------------------------------------------------------------ Anyone can call

export const settleRound = (ctx: TxContext, circle: Address) => circleCall(ctx, circle, 'settleRound', [], GAS.heavy);
export const markDefault = (ctx: TxContext, circle: Address, member: Address) => circleCall(ctx, circle, 'markDefault', [member], GAS.light);
export const finalize = (ctx: TxContext, circle: Address) => circleCall(ctx, circle, 'finalize', [], GAS.heavy);
export const cancel = (ctx: TxContext, circle: Address) => circleCall(ctx, circle, 'cancel', []);
