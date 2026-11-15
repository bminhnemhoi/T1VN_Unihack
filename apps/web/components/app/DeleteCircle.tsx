'use client';
/**
 * "Xóa" a cancelled circle from the list (B25). The circle is a smart contract on the blockchain and stays there: deleting
 * hides it for this wallet on this device. When the organizer's bond is still in the contract, the dialog first withdraws it
 * (and, for a gathering circle past its deadline, cancels it first) with the same Ký → Gửi → Xác nhận button as every other
 * transaction, and the circle is hidden only after the receipt. A failure hides nothing and says why.
 */
import { Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import { formatUsdcNumber } from 'sdk';
import { TxButton, TxNote, TxSteps, useStepTx } from '@/components/app/tx';
import { planDelete, type DeletePlan } from '@/lib/hidden-circles';
import type { SampleCircle } from '@/lib/sample';
import s from './DeleteDialog.module.css';

const usdc = (u: bigint): string => {
  const n = formatUsdcNumber(u);
  return `${n.includes(',') ? n : `${n},00`} USDC`;
};
const SWIPE = 96;

/** The "Xóa" button of a row: trash icon and word, 44px high. */
export function DeleteButton({ c, onOpen }: { c: SampleCircle; onOpen: (c: SampleCircle) => void }) {
  return (
    <button type="button" className="delBtn" onClick={() => onOpen(c)} aria-label={`Xóa dây ${c.label}`} data-testid="delete-circle">
      <Trash2 aria-hidden />
      Xóa
    </button>
  );
}

/**
 * Swipe left on a row of a phone reveals the red "Xóa" panel behind it (a shortcut: the real button in the row is always
 * there, so nothing needs the gesture). Returns the props for the sliding layer.
 */
export function useSwipeReveal() {
  const [open, setOpen] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const layer = useRef<HTMLDivElement>(null);
  const place = (x: number | null) => {
    if (!layer.current) return;
    layer.current.style.transition = x === null ? '' : 'none';
    layer.current.style.transform = x === null ? '' : `translateX(${x}px)`;
  };
  return {
    open,
    close: () => setOpen(false),
    layer,
    props: {
      onTouchStart: (e: TouchEvent) => {
        const t = e.touches[0]!;
        start.current = { x: t.clientX, y: t.clientY };
        moved.current = false;
      },
      onTouchMove: (e: TouchEvent) => {
        if (!start.current) return;
        const t = e.touches[0]!;
        const dx = t.clientX - start.current.x;
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(t.clientY - start.current.y)) return;
        moved.current = true;
        place(Math.max(-SWIPE, Math.min(0, (open ? -SWIPE : 0) + dx)));
      },
      onTouchEnd: (e: TouchEvent) => {
        if (!start.current) return;
        const dx = (e.changedTouches[0]?.clientX ?? start.current.x) - start.current.x;
        start.current = null;
        if (moved.current) setOpen(open ? dx <= 40 : dx < -40);
        place(null);
      },
      onClickCapture: (e: { preventDefault: () => void; stopPropagation: () => void }) => {
        if (moved.current) {
          e.preventDefault();
          e.stopPropagation();
          moved.current = false;
        }
      },
    },
  };
}

function bodyOf(plan: DeletePlan, label: string) {
  const amount = usdc(plan.bond);
  switch (plan.kind) {
    case 'withdraw':
      return (
        <p className={s.body}>
          Dây còn <span className={s.amount}>{amount}</span> ký quỹ của bạn. Xóa sẽ rút <span className={s.amount}>{amount}</span> về ví rồi ẩn dây khỏi danh sách. Sổ trên blockchain vẫn giữ.
        </p>
      );
    case 'cancel-withdraw':
      return (
        <>
          <p className={s.body}>
            Dây này đã quá hạn gom người mà chưa ai hủy, và còn <span className={s.amount}>{amount}</span> ký quỹ của bạn. Xóa sẽ hủy dây, rút <span className={s.amount}>{amount}</span> về ví rồi ẩn dây khỏi danh sách. Sổ trên blockchain vẫn giữ.
          </p>
          <p className={s.steps}>Cần 2 lần ký: 1. hủy dây · 2. rút ký quỹ</p>
        </>
      );
    case 'member':
      return (
        <>
          <p className={s.body}>Dây {label} đã hủy và không giữ tiền nào của bạn. Xóa chỉ ẩn dây khỏi danh sách trên máy này; sổ trên blockchain vẫn giữ.</p>
          <p className={s.note}>Tùy chọn: nếu từng cấp quyền trích USDC cho dây này, bạn có thể thu hồi quyền đó trong ví. Không bắt buộc.</p>
        </>
      );
    default:
      return <p className={s.body}>Ẩn dây này khỏi danh sách? Sổ trên blockchain vẫn giữ.</p>;
  }
}

/** The confirmation. `onDeleted` runs once, after the receipt of every transaction the plan needs (or at once when none is needed). */
export function DeleteDialog({ c, onClose, onDeleted }: { c: SampleCircle; onClose: () => void; onDeleted: (plan: DeletePlan) => void }) {
  const plan = planDelete(c);
  const t = useStepTx();
  const [phase, setPhase] = useState<1 | 2>(1);
  const cancelDone = useRef(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const from = useRef<Element | null>(null);
  const titleId = useId();
  const address = c.id as `0x${string}`;

  useEffect(() => {
    from.current = document.activeElement;
    setHost(document.getElementById('hs-root') ?? document.body);
    return () => {
      if (from.current instanceof HTMLElement && from.current.isConnected) from.current.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    if (host) title.current?.focus({ preventScroll: true });
  }, [host]);

  const confirm = async () => {
    if (plan.kind === 'cancel-withdraw' && !cancelDone.current) {
      setPhase(1);
      if (!(await t.run((a) => a.cancel(address)))) return;
      cancelDone.current = true; // a retry after a failed withdrawal must not ask for the cancel again
    }
    if (plan.kind === 'withdraw' || plan.kind === 'cancel-withdraw') {
      setPhase(2);
      if (!(await t.run((a) => a.withdrawBond(address)))) return;
    }
    onDeleted(plan);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (!t.busy) onClose();
      return;
    }
    if (e.key !== 'Tab' || !card.current) return;
    const items = [...card.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === title.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || (active === title.current && items.length === 1))) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!host) return null;
  const money = plan.kind === 'withdraw' || plan.kind === 'cancel-withdraw';
  const label = plan.kind === 'withdraw' ? `Rút ${usdc(plan.bond)} và xóa` : plan.kind === 'cancel-withdraw' ? `Hủy dây, rút ${usdc(plan.bond)} và xóa` : 'Xóa';
  return createPortal(
    <div className={s.layer} onKeyDown={onKey}>
      <div className={s.scrim} onClick={() => !t.busy && onClose()} aria-hidden="true" />
      <div ref={card} className={s.card} role="dialog" aria-modal="true" aria-labelledby={titleId} data-testid="delete-dialog">
        <h2 id={titleId} ref={title} tabIndex={-1} className={s.title}>
          Xóa dây &quot;{c.label}&quot;?
        </h2>
        {bodyOf(plan, c.label)}
        {plan.signatures === 2 && t.busy && <p className={s.steps}>Lần ký {phase}/2</p>}
        <TxSteps t={t} />
        <TxNote t={t} />
        <p className={s.sure}>Dây là smart contract trên blockchain nên không xóa hẳn được; &quot;xóa&quot; là ẩn khỏi danh sách của ví này.</p>
        <div className={s.actions}>
          {money ? (
            <TxButton t={t} label={label} retryLabel="Thử lại" tone="ink" onRun={() => void confirm()} />
          ) : (
            <button type="button" className="btn ink" onClick={() => onDeleted(plan)}>
              {label}
            </button>
          )}
          <button type="button" className="btn ghost" disabled={t.busy} onClick={onClose}>
            Giữ lại
          </button>
        </div>
      </div>
    </div>,
    host,
  );
}
