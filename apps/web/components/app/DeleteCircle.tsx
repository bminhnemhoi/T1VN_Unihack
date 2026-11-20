'use client';
/**
 * "Xóa" a cancelled circle from the list (B25). The circle is a smart contract on the blockchain and stays there: deleting
 * hides it for this wallet on this device. When the organizer's bond is still in the contract, the dialog first withdraws it
 * (and, for a gathering circle past its deadline, cancels it first) with the same Ký → Gửi → Xác nhận button as every other
 * transaction, and the circle is hidden only after the receipt. A failure hides nothing and says why.
 */
import { Archive, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import { formatUsdcNumber, huiCircleFullAbi } from 'sdk';
import { TxButton, TxNote, TxSteps, useStepTx } from '@/components/app/tx';
import { useChain } from '@/lib/chain/provider';
import { deleteVerb, freshSteps, planDelete, type DeletePlan, type FreshDeleteState } from '@/lib/hidden-circles';
import type { SampleCircle } from '@/lib/sample';
import s from './DeleteDialog.module.css';

const usdc = (u: bigint): string => {
  const n = formatUsdcNumber(u);
  return `${n.includes(',') ? n : `${n},00`} USDC`;
};
const SWIPE = 96;

/** The row's button, 44px high: "Xóa" (trash, red ink) for a cancelled circle, "Lưu trữ" (archive, neutral) for a finished one. */
export function DeleteButton({ c, onOpen }: { c: SampleCircle; onOpen: (c: SampleCircle) => void }) {
  const verb = deleteVerb(c);
  const archive = verb === 'Lưu trữ';
  return (
    <button type="button" className={`delBtn${archive ? ' arch' : ''}`} onClick={() => onOpen(c)} aria-label={`${verb} dây ${c.label}`} data-testid="delete-circle">
      {archive ? <Archive aria-hidden /> : <Trash2 aria-hidden />}
      {verb}
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

function bodyOf(plan: DeletePlan, label: string, completed: boolean) {
  const amount = usdc(plan.bond);
  if (completed)
    return <p className={s.body}>Dây {label} đã xong. Lưu trữ chỉ ẩn dây khỏi Tổng quan trên máy này; sổ hụi và kết quả trên blockchain vẫn giữ.</p>;
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
export function DeleteDialog({ c, viewer, onClose, onDeleted }: { c: SampleCircle; viewer?: `0x${string}`; onClose: () => void; onDeleted: (plan: DeletePlan) => void }) {
  const plan = planDelete(c);
  const t = useStepTx();
  const chain = useChain();
  /** USDC waiting in `claimable` for this wallet: the circle may not be hidden until it is claimed (audit B25 M-01). */
  const [owed, setOwed] = useState(0n);
  const [checking, setChecking] = useState(false);
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

  /** Fresh read from the chain (audit B25 L-01). `null` on sample data or when the read fails (then the cached plan stands). */
  const readFresh = async (): Promise<FreshDeleteState | null> => {
    if (!chain || !viewer) return null;
    const read = (functionName: string, args: unknown[] = []) =>
      chain.client.readContract({ address, abi: huiCircleFullAbi, functionName, args } as never) as Promise<unknown>;
    try {
      const [state, bondRemaining, organizer, claimable] = await Promise.all([read('state'), read('bondRemaining'), read('organizer'), read('claimable', [viewer])]);
      return { state: Number(state), bondRemaining: bondRemaining as bigint, isOrganizer: String(organizer).toLowerCase() === viewer.toLowerCase(), claimable: claimable as bigint };
    } catch {
      return null;
    }
  };

  /** Hides only when the chain shows nothing left for this wallet; otherwise offers `claim()` first. */
  const finish = async (): Promise<void> => {
    const f = await readFresh();
    if (f && f.claimable > 0n) {
      setOwed(f.claimable);
      return;
    }
    onDeleted(plan);
  };

  const confirm = async () => {
    setChecking(true);
    const f = await readFresh();
    setChecking(false);
    const steps = f ? freshSteps(plan, f) : { cancel: plan.kind === 'cancel-withdraw', withdraw: plan.kind === 'withdraw' || plan.kind === 'cancel-withdraw', owed: 0n };
    if (steps.cancel && !cancelDone.current) {
      setPhase(1);
      if (!(await t.run((a) => a.cancel(address)))) return;
      cancelDone.current = true; // a retry after a failed withdrawal must not ask for the cancel again
    }
    if (steps.withdraw) {
      setPhase(2);
      if (!(await t.run((a) => a.withdrawBond(address)))) return;
    }
    await finish();
  };

  const claimThenHide = async () => {
    if (!(await t.run((a) => a.claim(address)))) return;
    setOwed(0n);
    await finish();
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
  const verb = deleteVerb(c);
  const completed = c.state === 'completed';
  const label = plan.kind === 'withdraw' ? `Rút ${usdc(plan.bond)} và xóa` : plan.kind === 'cancel-withdraw' ? `Hủy dây, rút ${usdc(plan.bond)} và xóa` : verb;
  return createPortal(
    <div className={s.layer} onKeyDown={onKey}>
      <div className={s.scrim} onClick={() => !t.busy && onClose()} aria-hidden="true" />
      <div ref={card} className={s.card} role="dialog" aria-modal="true" aria-labelledby={titleId} data-testid="delete-dialog">
        <h2 id={titleId} ref={title} tabIndex={-1} className={s.title}>
          {verb} dây &quot;{c.label}&quot;?
        </h2>
        {owed > 0n ? (
          <p className={s.body} data-testid="delete-owed">
            Dây còn <span className={s.amount}>{usdc(owed)}</span> chờ bạn nhận (chuyển thẳng không được nên hợp đồng giữ lại). Nhận tiền về ví trước, rồi mới ẩn dây.
          </p>
        ) : (
          bodyOf(plan, c.label, completed)
        )}
        {plan.signatures === 2 && t.busy && <p className={s.steps}>Lần ký {phase}/2</p>}
        <TxSteps t={t} />
        <TxNote t={t} />
        <p className={s.sure}>
          {completed
            ? 'Xem lại bất cứ lúc nào trong Cài đặt → Dây đã ẩn.'
            : <>Dây là smart contract trên blockchain nên không xóa hẳn được; &quot;xóa&quot; là ẩn khỏi danh sách của ví này.</>}
        </p>
        <div className={s.actions}>
          {owed > 0n ? (
            <TxButton t={t} label={`Nhận ${usdc(owed)} rồi ${verb.toLowerCase()}`} retryLabel="Thử lại" tone="ink" onRun={() => void claimThenHide()} />
          ) : money ? (
            <TxButton t={t} label={label} retryLabel="Thử lại" tone="ink" onRun={() => void confirm()} />
          ) : (
            <button type="button" className="btn ink" disabled={checking} onClick={() => void (async () => { setChecking(true); await finish(); setChecking(false); })()}>
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
