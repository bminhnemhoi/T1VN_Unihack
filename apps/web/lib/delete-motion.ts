/**
 * Motion of "Xóa" on a list row (B25), loaded only when someone deletes: `import('gsap')` and the Flip plugin stay out of the
 * app's main bundle. With a bond coming back the amount flies from the row to the wallet balance in the top bar (curved,
 * 0.5 s) and the balance counts up; then the row slides left and fades (0.25 s) and the rows below close the gap with Flip
 * (0.3 s). About 0.9 s in all. With reduced motion, or if anything fails to load, the row is just hidden at once.
 */
import { flushSync } from 'react-dom';
import { formatUsdc } from 'sdk';

export interface DeleteMotion {
  /** The row (`li`) that leaves. */
  row: HTMLElement;
  /** Base units that came back to the wallet; 0 or undefined when nothing did (no flight). */
  amount?: bigint;
  /** Hides the circle in the store. Runs synchronously inside `flushSync`, so Flip can measure the new layout. */
  commit: () => void;
}

const BALANCE = '[data-testid="wallet-balance"]';

/** Reads "1.234,56 USDC" / "12 USDC" back into base units, or null if the chip shows something else ("…", "–"). */
export function parseBalance(text: string): bigint | null {
  const m = /^\s*([\d.]+(?:,\d+)?)\s*USDC/.exec(text);
  if (!m) return null;
  const [whole = '0', frac = ''] = m[1]!.replace(/\./g, '').split(',');
  return BigInt(whole) * 1_000_000n + BigInt(frac.padEnd(6, '0').slice(0, 6));
}

export async function playDelete({ row, amount, commit }: DeleteMotion): Promise<void> {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    flushSync(commit);
    return;
  }
  let committed = false;
  const once = () => {
    if (committed) return;
    committed = true;
    commit();
  };
  // Safety net: a hidden tab pauses the GSAP ticker, and the circle must still be hidden.
  const net = window.setTimeout(() => flushSync(once), 2000);
  try {
    const [{ gsap }, { Flip }] = await Promise.all([import('gsap'), import('gsap/Flip')]);
    gsap.registerPlugin(Flip);
    const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });

    // 1. The amount flies to the balance (only when money came back), and the balance counts up under it.
    let exitAt = 0;
    if (amount && amount > 0n) {
      const target = document.querySelector<HTMLElement>(BALANCE) ?? document.querySelector<HTMLElement>('.acct');
      const fromBox = (row.querySelector('.delBtn') ?? row).getBoundingClientRect();
      if (target) {
        const toBox = target.getBoundingClientRect();
        const fly = document.createElement('span');
        fly.setAttribute('aria-hidden', 'true');
        fly.textContent = `+${formatUsdc(amount)}`;
        Object.assign(fly.style, {
          position: 'fixed', left: `${fromBox.left + fromBox.width / 2}px`, top: `${fromBox.top + fromBox.height / 2}px`, zIndex: '120', pointerEvents: 'none',
          transform: 'translate(-50%, -50%)', padding: '4px 10px', borderRadius: '999px', background: '#a1ff62', color: '#201d1d', whiteSpace: 'nowrap',
          font: '600 13px var(--font-mono), ui-monospace, Menlo, monospace', boxShadow: '0 6px 16px -6px rgb(32 29 29 / 0.5)', willChange: 'transform, opacity',
        } satisfies Partial<CSSStyleDeclaration>);
        document.body.appendChild(fly);
        const dx = toBox.left + toBox.width / 2 - (fromBox.left + fromBox.width / 2);
        const dy = toBox.top + toBox.height / 2 - (fromBox.top + fromBox.height / 2);
        // Two different eases on x and y bend the path: it rises first, then glides in.
        tl.fromTo(fly, { x: 0 }, { x: dx, duration: 0.5, ease: 'power2.inOut' }, 0)
          .fromTo(fly, { y: 0 }, { y: dy, duration: 0.5, ease: 'power3.out' }, 0)
          .to(fly, { scale: 0.7, opacity: 0, duration: 0.12, ease: 'power1.in', onComplete: () => fly.remove() }, 0.4);
        // Count-up: a copy of the chip text sits on the chip for a moment (the real chip is React's and is never touched).
        const before = target.matches(BALANCE) ? parseBalance(target.textContent ?? '') : null;
        if (before !== null) {
          const over = document.createElement('span');
          over.setAttribute('aria-hidden', 'true');
          const cs = getComputedStyle(target);
          Object.assign(over.style, {
            position: 'fixed', left: `${toBox.left}px`, top: `${toBox.top}px`, width: `${toBox.width}px`, height: `${toBox.height}px`, zIndex: '119', pointerEvents: 'none',
            display: 'grid', placeItems: 'center', borderRadius: '999px', background: cs.backgroundColor, color: cs.color, font: cs.font, opacity: '0',
          } satisfies Partial<CSSStyleDeclaration>);
          over.textContent = formatUsdc(before);
          document.body.appendChild(over);
          const n = { v: 0 };
          tl.to(over, { opacity: 1, duration: 0.05 }, 0.5)
            .to(n, { v: 1, duration: 0.35, ease: 'power1.out', onUpdate: () => {
              over.textContent = formatUsdc(before + BigInt(Math.round(Number(amount) * n.v)));
            } }, 0.5)
            .fromTo(target, { scale: 1 }, { scale: 1.1, duration: 0.12, yoyo: true, repeat: 1, ease: 'power1.inOut' }, 0.5)
            .to(over, { opacity: 0, duration: 0.15, onComplete: () => over.remove() }, 0.85);
        }
        exitAt = 0.35;
      }
    }

    // 2. The row slides left and fades, 3. the rest closes the gap (Flip), measured around the real removal.
    const rows = [...(row.parentElement?.children ?? [])].filter((el): el is HTMLElement => el instanceof HTMLElement && el !== row);
    tl.to(row, { x: -48, opacity: 0, duration: 0.25, ease: 'power2.in' }, exitAt);
    tl.add(() => {
      const state = Flip.getState(rows);
      flushSync(once);
      Flip.from(state, { duration: 0.3, ease: 'power2.out' });
    }, exitAt + 0.25);
    await tl.then();
    await new Promise<void>((r) => setTimeout(r, 300)); // let the Flip finish before the caller moves on
  } catch {
    flushSync(once); // the animation is a nicety: never let it stop the delete
  } finally {
    window.clearTimeout(net);
  }
}
