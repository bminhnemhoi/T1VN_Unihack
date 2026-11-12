'use client';
/**
 * Transaction buttons of the web app (prototype "Ký -> Gửi -> Xác nhận"). Never optimistic: the caller changes what the
 * screen shows (stamp, sealed slip) only after `run` resolves true, i.e. after the receipt. On sample data the three
 * steps are simulated with the demo network's fixed latencies and nothing is sent.
 */
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useTx, type TxRun } from '@/components/chain/useTx';
import { useChain } from '@/lib/chain/provider';
import { demoNet, TX_LATENCY } from '@/lib/demo-store';

const STEPS = ['Ký', 'Gửi', 'Xác nhận'];
const STEP_TEXT = ['Đang chờ bạn ký', 'Đang gửi qua relay', 'Chờ xác nhận trên Fuji'];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface StepTx {
  busy: boolean;
  step: number;
  err?: string;
  txHash?: `0x${string}`;
  /** Runs the job (chain) or the simulation (sample). Resolves true once confirmed. */
  run: (job: TxRun, opts?: { failText?: string; forceOk?: boolean }) => Promise<boolean>;
  reset: () => void;
}

export function useStepTx(): StepTx {
  const chain = useChain();
  const tx = useTx();
  const [sim, setSim] = useState<{ busy: boolean; step: number; err?: string }>({ busy: false, step: 0 });
  const lock = useRef(false);
  const run = useCallback<StepTx['run']>(
    async (job, opts = {}) => {
      if (lock.current) return false;
      lock.current = true;
      try {
        if (chain) {
          const r = await tx.run(job);
          return r?.ok === true;
        }
        const net = opts.forceOk ? 'ok' : demoNet();
        const d = TX_LATENCY[net];
        for (let i = 0; i < 3; i++) {
          setSim({ busy: true, step: i });
          await wait(d[i]!);
          if (net === 'fail' && i === 1) {
            setSim({ busy: false, step: 1, err: opts.failText ?? 'Gửi không được vì mạng lỗi. Lệnh chưa lên chuỗi, bạn chưa mất gì.' });
            return false;
          }
        }
        setSim({ busy: false, step: 0 });
        return true;
      } finally {
        lock.current = false;
      }
    },
    [chain, tx],
  );
  const reset = useCallback(() => {
    setSim({ busy: false, step: 0 });
    tx.clear();
  }, [tx]);
  if (chain) {
    const r = tx.result;
    return {
      busy: tx.pending,
      step: tx.step ?? 0,
      ...(r && !r.ok ? { err: r.message } : {}),
      ...(r && r.ok ? { txHash: r.txHash } : {}),
      run,
      reset,
    };
  }
  return { ...sim, run, reset };
}

/** The step bar under a transaction button. */
export function TxSteps({ t }: { t: StepTx }) {
  if (!t.busy && !t.err) return null;
  return (
    <ol className="txSteps" aria-label="Tiến độ giao dịch">
      {STEPS.map((s, i) => (
        <li key={s} className={i < t.step ? 'done' : i === t.step ? (t.err ? 'fail' : 'now') : ''}>
          {i + 1}. {s}
          {i === t.step && t.err ? ' · lỗi' : ''}
        </li>
      ))}
    </ol>
  );
}

/**
 * One primary action that sends a transaction: idle label, spinner + step while busy (locked against a double tap),
 * retry label after a failure. `tone`: lime for the screen's main action, ink otherwise.
 */
export function TxButton({
  t,
  label,
  retryLabel,
  onRun,
  disabled,
  tone = 'lime',
  className = '',
}: {
  t: StepTx;
  label: ReactNode;
  retryLabel: string;
  onRun: (retry: boolean) => void;
  disabled?: boolean;
  tone?: 'lime' | 'ink';
  className?: string;
}) {
  if (t.busy) {
    return (
      <button type="button" className={`btn ${tone} ${className}`} disabled aria-busy="true">
        <span className="spin" aria-hidden="true" />
        {STEP_TEXT[t.step]} · {t.step + 1}/3
      </button>
    );
  }
  return (
    <button type="button" className={`btn ${tone} ${className}`} disabled={disabled} onClick={() => onRun(!!t.err)}>
      {t.err ? retryLabel : label}
    </button>
  );
}

/** Error line under the steps (role=alert), or the confirmed transaction. */
export function TxNote({ t, ok }: { t: StepTx; ok?: string }) {
  if (t.err) {
    return (
      <p className="hint err" role="alert">
        {t.err}
      </p>
    );
  }
  if (ok && t.txHash) {
    return (
      <p className="txOk" role="status">
        {ok}{' '}
        <a href={`https://testnet.snowtrace.io/tx/${t.txHash}`} target="_blank" rel="noreferrer">
          {t.txHash.slice(0, 10)}…
        </a>
      </p>
    );
  }
  return null;
}
