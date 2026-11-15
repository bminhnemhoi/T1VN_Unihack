'use client';
/** Small building blocks shared by the app views (prototype classes, see app/hs.css). */
import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';
import { FrameSlot } from '@/components/app/AppFrame';
import { formatUsdcNumber, huiMath } from 'sdk';
import { setDemoNet, useShowAfter } from '@/lib/demo-store';
import type { SampleCircleData } from '@/lib/sample-circles';

export const av = (i: number) => `M${i + 1}`;

export function Who({ rows }: { rows: { key: string | number; av: string; me?: boolean; name: ReactNode; sub?: ReactNode; right: ReactNode }[] }) {
  return (
    <ul className="who">
      {rows.map((r) => (
        <li key={r.key}>
          <span className={`av${r.me ? ' me' : ''}`} aria-hidden>
            {r.av}
          </span>
          <span>
            {r.name}
            {r.sub && <small>{r.sub}</small>}
          </span>
          {r.right}
        </li>
      ))}
    </ul>
  );
}

/** Top-bar chips of the screen (circle health, refresh state), rendered into the frame's health slot. */
export function HealthChips({ children, refreshing, stale, onRetry }: { children?: ReactNode; refreshing?: boolean; stale?: boolean; onRetry?: () => void }) {
  const showSync = useShowAfter(!!refreshing);
  return (
    <FrameSlot target="hs-health">
      {showSync && (
        <span className="sync" role="img" aria-label="Đang cập nhật dữ liệu">
          <i />
          Đang cập nhật
        </span>
      )}
      {stale && (
        <button type="button" className="staleChip" onClick={onRetry}>
          Chưa cập nhật được · Thử lại
        </button>
      )}
      {children}
    </FrameSlot>
  );
}

/** Loading region: blank for the first 180 ms, then the skeleton (kept ≥ 300 ms). */
export function Loading({ children, label = 'Đang tải dữ liệu on-chain…' }: { children: ReactNode; label?: string }) {
  const show = useShowAfter(true);
  return (
    <div aria-busy="true" style={{ height: '100%' }}>
      <p className="sr" role="status">
        {show ? label : ''}
      </p>
      {show && <div aria-hidden>{children}</div>}
    </div>
  );
}

export function ErrorState({ onRetry, text = 'Máy chủ đọc sự kiện đang chậm hoặc mạng chập chờn. Tiền của bạn vẫn nằm trong smart contract, không bị ảnh hưởng.' }: { onRetry?: () => void; text?: string }) {
  return (
    <main id="noi-dung" className="state in">
      <div className="stateBox" role="alert">
        <span className="label" style={{ color: 'var(--red-ink)' }}>
          Lỗi mạng
        </span>
        <h1>Chưa đọc được dữ liệu on-chain.</h1>
        <p>{text}</p>
        <div className="actions">
          <button type="button" className="btn ink" onClick={onRetry ?? (() => setDemoNet('ok'))}>
            Thử lại
          </button>
        </div>
      </div>
    </main>
  );
}

export function EmptyState({ label = 'Tài khoản mới', title, text, onPaste, extra }: { label?: string; title: string; text: string; onPaste?: () => void; extra?: ReactNode }) {
  return (
    <main id="noi-dung" className="state in">
      <div className="stateBox">
        <span className="label">{label}</span>
        <h1>{title}</h1>
        <p>{text}</p>
        <div className="actions">
          <Link className="btn lime" href="/circles/new">
            Tạo dây mới
          </Link>
          {onPaste && (
            <button type="button" className="btn ghost" onClick={onPaste}>
              Dán đường dẫn mời
            </button>
          )}
          {extra}
        </div>
      </div>
    </main>
  );
}

/** Bottom sheet of the phone layout (prototype `.sheet`): scrim, drag handle, Esc and the scrim close it, focus returns. */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const from = useRef<Element | null>(null);
  const drag = useRef<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      from.current = document.activeElement;
      el.querySelector<HTMLElement>('[data-close]')?.focus({ preventScroll: true });
      const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }
    if (from.current instanceof HTMLElement && from.current.isConnected) from.current.focus({ preventScroll: true });
  }, [open, onClose]);
  return (
    <FrameSlot target="hs-root">
      <div className={`scrim${open ? ' open' : ''}`} onClick={onClose} aria-hidden />
      <section
        ref={ref}
        className={`sheet${open ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        inert={!open}
        onPointerDown={(e) => {
          if (!(e.target as HTMLElement).closest('.grab')) return;
          drag.current = e.clientY;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          if (ref.current) ref.current.style.transition = 'none';
        }}
        onPointerMove={(e) => {
          if (drag.current !== null && ref.current) ref.current.style.transform = `translateY(${Math.max(0, e.clientY - drag.current)}px)`;
        }}
        onPointerUp={(e) => {
          if (drag.current === null) return;
          const dy = e.clientY - drag.current;
          drag.current = null;
          if (ref.current) {
            ref.current.style.transition = '';
            ref.current.style.transform = '';
          }
          if (dy > 70) onClose();
        }}
      >
        <button type="button" className="grab" aria-label="Kéo xuống để đóng" onClick={onClose} />
        <div className="sheetHead">
          <h2>{title}</h2>
          <button type="button" data-close onClick={onClose}>
            Đóng
          </button>
        </div>
        <div>{children}</div>
      </section>
    </FrameSlot>
  );
}

/** "Dán đường dẫn mời": opens /moi/… links pasted from Zalo or Messenger, checks the shape first. */
export function PasteInvite() {
  return (
    <form
      className="field"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem('invite') as HTMLInputElement;
        const hint = e.currentTarget.querySelector<HTMLElement>('#inviteHint')!;
        let path: string | null = null;
        try {
          const u = new URL(input.value.trim());
          if (/^\/moi\/[^/]+/.test(u.pathname)) path = u.pathname + u.search;
        } catch {
          path = null;
        }
        input.setAttribute('aria-invalid', String(!path));
        hint.classList.toggle('err', !path);
        if (!path) {
          hint.textContent = 'Chưa đúng đường dẫn mời. Dán nguyên đường dẫn có dạng https://…/moi/…';
          return;
        }
        window.location.assign(path);
      }}
    >
      <label htmlFor="inviteIn">Đường dẫn mời</label>
      <input id="inviteIn" name="invite" type="url" inputMode="url" autoComplete="off" placeholder="https://…/moi/…" aria-describedby="inviteHint" />
      <p className="hint" id="inviteHint">
        Dán đường dẫn bạn bè gửi qua Zalo hoặc Messenger.
      </p>
      <button className="btn ink" type="submit">
        Mở lời mời
      </button>
    </form>
  );
}

/** Coverage at activation (reserve 0), the first chip of the prototype. */
function coveragePct(c: SampleCircleData): number {
  const bps = c.live?.view.guaranteedCoverageBps ?? Number(huiMath.coverageIndexBps(c.terms.alphaBps, c.bond, 0n, c.terms.n, c.terms.c));
  return Math.floor(bps / 100);
}

/** The circle's health in the top bar: coverage at opening, bond left, reserve. Each chip opens the page that explains it. */
export function CircleChips({ c, bondSpent = 0n, refreshing, stale }: { c: SampleCircleData; bondSpent?: bigint; refreshing?: boolean; stale?: boolean }) {
  const w = (u: bigint) => formatUsdcNumber(u);
  return (
    <HealthChips refreshing={refreshing} stale={stale} onRetry={() => setDemoNet('ok')}>
      <Link className="chip" href={`/circles/${c.id}/bao-chung`}>
        <i className="dot" />
        <span className="long">Bảo chứng lúc mở</span>
        <span className="short">Bảo chứng</span> <b>{coveragePct(c)}%</b>
      </Link>
      <Link className="chip" href={`/circles/${c.id}/bao-chung`}>
        Ký quỹ còn{' '}
        <b>
          {w(c.bondRemaining - bondSpent)}/{w(c.bond)}
        </b>
      </Link>
      <Link className="chip" href={`/circles/${c.id}/giu-lai`}>
        Quỹ dự phòng <b>{w(c.reserve)}</b>
      </Link>
    </HealthChips>
  );
}
