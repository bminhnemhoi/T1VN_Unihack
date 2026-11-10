'use client';
/**
 * Shared plumbing for every button that sends a transaction: guards (deployed? logged in? wallet on the right chain?),
 * pending / success / error state, and the Vietnamese notice under the button. The write flows (`useHuiActions`) never
 * throw for expected problems, so the notice just prints their `message`.
 */
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { formatUsdc } from 'sdk';
import { useChain } from '@/lib/chain/provider';
import { useHuiActions } from '@/lib/chain/actions';
import { useHuiWallet } from '@/lib/chain/walletProvider';
import { cn } from '@/lib/utils';

type Actions = NonNullable<ReturnType<typeof useHuiActions>>;
export type RunResult = { ok: true; txHash: `0x${string}` } | { ok: false; code: string; message: string };
export type TxRun = (actions: Actions) => Promise<RunResult>;

export const EXPLORER_TX = 'https://testnet.snowtrace.io/tx/';
const FUJI_ID = 43113;

export const SOON_DEFAULT = 'Cần mạng và ví để làm việc này, sắp có. Hiện là màn hình mẫu, chưa gửi gì.';

export interface TxState {
  pending: boolean;
  result?: RunResult;
}

/** Why nothing was sent, as a failure result the notice can print. */
const notReady = (code: string, message: string): RunResult => ({ ok: false, code, message });

export function useTx() {
  const chain = useChain();
  const actions = useHuiActions();
  const { status, login } = useHuiWallet();
  const [state, setState] = useState<TxState>({ pending: false });
  const busy = useRef(false);

  /** `soon` is what a sample-mode click says. Returns the result, or undefined when nothing was sent. */
  const run = useCallback(
    async (job: TxRun, soon: string = SOON_DEFAULT): Promise<RunResult | undefined> => {
      if (busy.current) return undefined;
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
      setState({ pending: true });
      try {
        const r = await job(actions);
        setState({ pending: false, result: r });
        return r;
      } finally {
        busy.current = false;
      }
    },
    [chain, actions, status, login],
  );

  const clear = useCallback(() => setState({ pending: false }), []);
  return { run, clear, ...state, deployed: chain !== null, chainId: chain?.chainId };
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
    return (
      <p role="status" className={cn('mt-3 text-base', className)}>
        Đang gửi giao dịch và chờ mạng xác nhận. Đừng đóng trang.
      </p>
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
