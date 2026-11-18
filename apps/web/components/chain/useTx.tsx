'use client';
/**
 * Shared plumbing for every button that sends a transaction: guards (deployed? logged in? wallet on the right chain?),
 * pending / success / error state, and the Vietnamese notice under the button. The write flows (`useHuiActions`) never
 * throw for expected problems, so the notice just prints their `message`.
 */
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { formatUsdc } from 'sdk';
import { PAUSED_REASON, usePaused } from '@/components/chain/PauseLock';
import { useChain } from '@/lib/chain/provider';
import { useHuiActions } from '@/lib/chain/actions';
import type { TxStep } from '@/lib/chain/write';
import { useHuiWallet } from '@/lib/chain/walletProvider';
import { txBegin, txEnd, txSuccess } from '@/lib/install-store';
import { cn } from '@/lib/utils';

type Actions = NonNullable<ReturnType<typeof useHuiActions>>;
export type RunResult = { ok: true; txHash: `0x${string}` } | { ok: false; code: string; message: string };
export type TxRun = (actions: Actions) => Promise<RunResult>;

export const EXPLORER_TX = 'https://testnet.snowtrace.io/tx/';
const FUJI_ID = 43113;

export const SOON_DEFAULT = 'Cần mạng và ví để làm việc này, sắp có. Hiện là màn hình mẫu, chưa gửi gì.';

export interface TxState {
  pending: boolean;
  /** While pending: 0 = waiting for the signature, 1 = sending through the relay, 2 = waiting for the receipt. */
  step?: number;
  result?: RunResult;
}

export const TX_STEPS = ['Ký', 'Gửi', 'Xác nhận'] as const;
export const TX_STEP_TEXT = ['Đang chờ bạn ký', 'Đang gửi qua relay', 'Chờ xác nhận trên Fuji'] as const;
const STEP_INDEX: Record<TxStep, number> = { sign: 0, send: 1, confirm: 2 };

/** Why nothing was sent, as a failure result the notice can print. */
const notReady = (code: string, message: string): RunResult => ({ ok: false, code, message });

/** `allowWhenPaused`: the one transaction that still works on a paused circle (`claim`). */
export function useTx({ allowWhenPaused = false }: { allowWhenPaused?: boolean } = {}) {
  const paused = usePaused() && !allowWhenPaused;
  const chain = useChain();
  const [state, setState] = useState<TxState>({ pending: false });
  // Steps of this hook's own run only (audit B22 L-02): the actions report to this callback, set while `run` is going.
  const stepTo = useRef<((s: TxStep) => void) | undefined>(undefined);
  const actions = useHuiActions({ onStep: (s) => stepTo.current?.(s) });
  const { status, login } = useHuiWallet();
  const busy = useRef(false);

  /** `soon` is what a sample-mode click says. Returns the result, or undefined when nothing was sent. */
  const run = useCallback(
    async (job: TxRun, soon: string = SOON_DEFAULT): Promise<RunResult | undefined> => {
      if (busy.current) return undefined;
      if (paused) {
        const r = notReady('CircleIsPaused', PAUSED_REASON);
        setState({ pending: false, result: r });
        return r;
      }
      if (!chain) {
        const r = notReady('NotDeployed', soon);
        setState({ pending: false, result: r });
        return r;
      }
      if (status === 'loading') {
        const r = notReady('WalletLoading', 'Ví đang khởi động, thử lại sau vài giây.');
        setState({ pending: false, result: r });
        return r;
      }
      if (status === 'unavailable') {
        const r = notReady('NoWallet', 'Chưa có cách đăng nhập trên mạng này. Cần ví Privy để gửi giao dịch.');
        setState({ pending: false, result: r });
        return r;
      }
      if (!actions) {
        login();
        const r = notReady('NotLoggedIn', 'Hãy đăng nhập trước, rồi bấm lại.');
        setState({ pending: false, result: r });
        return r;
      }
      busy.current = true;
      txBegin();
      setState({ pending: true, step: 0 });
      stepTo.current = (st) => setState((s) => (s.pending ? { ...s, step: STEP_INDEX[st] } : s));
      try {
        const r = await job(actions);
        setState((s) => ({ pending: false, result: r, step: s.step }));
        if (r.ok) txSuccess();
        return r;
      } finally {
        stepTo.current = undefined;
        busy.current = false;
        txEnd();
      }
    },
    [chain, actions, status, login, paused],
  );

  const clear = useCallback(() => setState({ pending: false }), []);
  return { run, clear, ...state, paused, deployed: chain !== null, chainId: chain?.chainId };
}

const short = (h: string): string => `${h.slice(0, 10)}…${h.slice(-6)}`;

/** Under-the-button status: pending, success with the transaction (link on Fuji, plain hash on anvil), or the error. */
export function TxNotice({
  state,
  chainId,
  success,
  needed,
  className,
}: {
  state: TxState;
  chainId?: number;
  /** What to say on success, before the transaction. */
  success?: ReactNode;
  /** Amount behind a `NeedAllowance` error, for the M-02 explanation. */
  needed?: bigint;
  className?: string;
}) {
  if (state.pending) {
    const cur = state.step ?? 0;
    return (
      <div role="status" className={cn('mt-3 grid gap-2 text-base', className)}>
        <ol className="grid grid-cols-3 gap-1 font-mono text-xs" aria-label="Tiến độ giao dịch">
          {TX_STEPS.map((s, i) => (
            <li key={s} className={cn('border-t-[3px] pt-2', i <= cur ? 'border-current font-semibold opacity-100' : 'border-current/25 opacity-60')}>
              {i + 1}. {s}
            </li>
          ))}
        </ol>
        <p className="text-sm opacity-85">{TX_STEP_TEXT[cur]} · Đừng đóng trang.</p>
      </div>
    );
  }
  const r = state.result;
  if (!r) return null;
  if (r.ok) {
    return (
      <p role="status" className={cn('so-ke mt-3 text-base font-semibold text-state-ok', className)}>
        {success ?? 'Xong.'} Giao dịch:{' '}
        {chainId === FUJI_ID ? (
          <a href={`${EXPLORER_TX}${r.txHash}`} target="_blank" rel="noreferrer" className="underline underline-offset-4">
            {short(r.txHash)}
          </a>
        ) : (
          <span className="break-all" data-testid="tx-hash">{r.txHash}</span>
        )}
      </p>
    );
  }
  return (
    <div role="alert" className={cn('mt-3 text-base text-state-bad', className)}>
      <p className="font-semibold">{r.message}</p>
      {r.code === 'NeedAllowance' && (
        <p className="mt-1 text-foreground">
          Ví của bạn chưa cho dây quyền trích thêm{needed !== undefined ? ` ${formatUsdc(needed)}` : ''}, và cho phép thêm thì cần một ít AVAX để trả phí mà ví đăng nhập bằng email không có. Cách xử lý đang chờ quyết định của nhóm; hiện chưa trả được ở bước này.
        </p>
      )}
    </div>
  );
}
