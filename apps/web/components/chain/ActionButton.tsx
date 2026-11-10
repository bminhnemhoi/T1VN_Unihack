'use client';

import type { ComponentProps, ReactNode } from 'react';
import { TxNotice, useTx, type RunResult, type TxRun } from '@/components/chain/useTx';
import { Button } from '@/components/ui/button';

type Props = Omit<ComponentProps<typeof Button>, 'onClick'> & {
  run: TxRun;
  /** Said when the screen is on sample data (nothing deployed). */
  soon?: string;
  /** Text after the button's success, before the transaction link. */
  success?: ReactNode;
  pendingLabel?: string;
  needed?: bigint;
  onDone?: (r: RunResult) => void;
  /** Hint under the button is placed here (defaults to directly under). */
  noticeClassName?: string;
  /** `claim` only: stays enabled while the circle is paused. */
  allowWhenPaused?: boolean;
};

/**
 * A button that sends one transaction through `useHuiActions`. Sample mode answers right away (never a dead button),
 * logged-out mode opens the login, otherwise it shows pending, success and the Vietnamese error under the button.
 */
export function ActionButton({ run, soon, success, pendingLabel = 'Đang gửi…', needed, onDone, noticeClassName, allowWhenPaused, children, disabled, ...props }: Props) {
  const tx = useTx({ allowWhenPaused });
  return (
    <>
      <Button
        type="button"
        {...props}
        disabled={disabled || tx.pending || tx.paused}
        onClick={async () => {
          const r = await tx.run(run, soon);
          if (r) onDone?.(r);
        }}
      >
        {tx.pending ? pendingLabel : children}
      </Button>
      <TxNotice state={tx} chainId={tx.chainId} success={success} needed={needed} className={noticeClassName} />
    </>
  );
}
