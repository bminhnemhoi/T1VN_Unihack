'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { formatUsdcNumber } from 'sdk';
import { cascadeRound2, coverage, quoteRound1, ROUND1_BID_CAP } from '@/lib/landing-demo';
import s from './landing.module.css';

function pulseEl(el: Element | null, scale = 0.96) {
  if (!el || typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  void import('gsap').then(({ gsap }) => {
    gsap.fromTo(el, { scale, opacity: 0.82 }, { scale: 1, opacity: 1, duration: 0.28, ease: 'back.out(2.2)', overwrite: 'auto', clearProps: 'transform,opacity' });
  });
}

const cap = formatUsdcNumber(ROUND1_BID_CAP);

/** "Muốn hốt sớm?": type a round-1 bid, see what the winner receives at once. */
export function BidCalc() {
  const [value, setValue] = useState('6');
  const q = quoteRound1(value);
  return (
    <div className={s.mini}>
      <label className={`${s.label} ${s.bidLabel}`} htmlFor="lp-bid">
        Thăm kỳ 1 · trần {cap}
      </label>
      <div className={s.bidIn}>
        <input id="lp-bid" type="text" inputMode="decimal" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} aria-describedby="lp-bid-hint" />
        <span>USDC</span>
      </div>
      <p id="lp-bid-hint" className={q.ok ? s.hint : `${s.hint} ${s.err}`} aria-live="polite">
        {q.ok
          ? `Hợp lệ. Mỗi người còn lại bớt ${formatUsdcNumber(q.bid)} USDC.`
          : q.reason === 'cap'
            ? `Vượt trần ${cap} USDC: smart contract không cho mở thăm này.`
            : 'Nhập số, tối đa 6 chữ số sau dấu phẩy.'}
      </p>
      {q.ok && (
        <dl>
          <div className={s.kv}><dt>4 người góp</dt><dd>{formatUsdcNumber(q.pot)}</dd></div>
          <div className={s.kv}><dt>Hoa hồng + quỹ dự phòng</dt><dd>−{formatUsdcNumber(q.cut)}</dd></div>
          <div className={s.kv}><dt>Giữ lại tới cuối dây</dt><dd>−{formatUsdcNumber(q.holdback)}</dd></div>
          <div className={`${s.kv} ${s.big}`}><dt>Bạn nhận ngay</dt><dd data-testid="lp-payout">{formatUsdcNumber(q.payout)}</dd></div>
        </dl>
      )}
    </div>
  );
}

/** "M4 hốt rồi trốn!": toggle the default and watch the cascade split M4's 100 USDC. */
export function CascadeDemo() {
  const [bad, setBad] = useState(false);
  const noteRef = useRef<HTMLParagraphElement>(null);
  const pick = (next: boolean) => {
    if (next === bad) return;
    setBad(next);
    pulseEl(noteRef.current, 0.985);
  };
  const r = cascadeRound2(bad);
  const pct = (part: bigint) => Number((part * 100n) / r.m4Due);
  // Bar segments move with transform only (B22g): each spans the bar, `--x` places it, `--w` scales it (0..1).
  const seg = (x: number, w: number) => ({ '--x': `${x}%`, '--w': w / 100 }) as CSSProperties;
  const paid = bad ? 0 : 100;
  const hold = pct(r.fromHoldback);
  const live = Number(r.livePays / 1_000_000n);
  return (
    <div className={s.mini}>
      <div className={s.seg} role="group" aria-label="Kịch bản kỳ 2">
        <button type="button" aria-pressed={!bad} onClick={() => pick(false)}>Mọi người đóng đủ</button>
        <button type="button" aria-pressed={bad} onClick={() => pick(true)}>M4 bỏ đóng</button>
      </div>
      <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none' }} aria-label="Phần góp kỳ 2 của từng người">
        {['M2', 'M3', 'M4', 'M5'].map((m) => (
          <li key={m} className={s.mem}>
            <span>{m}</span>
            <span className={s.bar} aria-hidden>
              {m === 'M4' ? (
                <>
                  <i className={s.pPaid} style={seg(0, paid)} />
                  <i className={s.pHold} style={seg(paid, hold)} />
                  <i className={s.pBond} style={seg(paid + hold, pct(r.fromBond))} />
                </>
              ) : (
                <i className={s.pPaid} style={seg(0, live)} />
              )}
            </span>
            <span className={s.mono}>{m === 'M4' ? formatUsdcNumber(r.m4Due) : live}</span>
          </li>
        ))}
      </ul>
      <p className={s.legend}>
        <span><i className={s.pPaid} />tự đóng</span>
        <span><i className={s.pHold} />bù từ tiền giữ lại của M4</span>
        <span><i className={s.pBond} />bù từ ký quỹ</span>
      </p>
      <p ref={noteRef} className={s.note} aria-live="polite" data-testid="lp-cascade">
        {bad
          ? `M4 thiếu ${formatUsdcNumber(r.m4Due)}: bù ${formatUsdcNumber(r.fromHoldback)} từ tiền giữ lại của M4, ${formatUsdcNumber(r.fromBond)} từ ký quỹ (còn ${formatUsdcNumber(r.bondLeft)}). M1 vẫn nhận ${formatUsdcNumber(r.payout)} USDC.`
          : `Pot ${formatUsdcNumber(r.pot)} USDC. M1 nhận ngay ${formatUsdcNumber(r.payout)} USDC.`}
      </p>
    </div>
  );
}

const CIRC = 2 * Math.PI * 50;

/** "Dây này an toàn không?": members and bond move the coverage ring; under 100% the circle cannot start on Fuji. */
export function CoverageDemo() {
  const [n, setN] = useState(5);
  const [bond, setBond] = useState(480);
  const ringRef = useRef<SVGSVGElement>(null);
  const c = coverage(n, bond);
  const prevOk = useRef(c.canStart);
  useEffect(() => {
    if (prevOk.current !== c.canStart) {
      prevOk.current = c.canStart;
      pulseEl(ringRef.current, 0.93);
    }
  }, [c.canStart]);
  const pct = Number(c.bps) / 100;
  return (
    <div className={s.mini}>
      <div className={s.ringWrap}>
        <svg ref={ringRef} className={s.ringSvg} viewBox="0 0 120 120" aria-hidden>
          <circle className={s.ringBg} cx="60" cy="60" r="50" />
          <circle className={c.canStart ? s.ringFg : `${s.ringFg} ${s.low}`} cx="60" cy="60" r="50" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - pct / 100)} />
          <text x="60" y="68" textAnchor="middle">{Math.floor(pct)}%</text>
        </svg>
        <div className={s.rng}>
          <label htmlFor="lp-n">Số người <output htmlFor="lp-n">{n}</output></label>
          <input id="lp-n" type="range" min={3} max={30} value={n} onChange={(e) => setN(Number(e.target.value))} />
          <label htmlFor="lp-bond">Ký quỹ (USDC) <output htmlFor="lp-bond">{bond}</output></label>
          <input id="lp-bond" type="range" min={0} max={2000} step={10} value={bond} onChange={(e) => setBond(Number(e.target.value))} />
        </div>
      </div>
      <p className={c.canStart ? s.verdict : `${s.verdict} ${s.no}`} aria-live="polite" data-testid="lp-coverage">
        Bảo chứng {Math.floor(pct)}%: {c.canStart ? 'đủ, được bắt đầu dây' : 'dưới 100%, không bắt đầu được dây'}
      </p>
    </div>
  );
}

/** Countdown in the app preview (visual only, loops; still under reduced motion). */
export function DemoClock() {
  const [t, setT] = useState(89);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setT((v) => (v <= 0 ? 89 : v - 1)), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className={s.clock} role="timer" aria-label="Thời gian còn lại để nộp thăm (minh họa)">
      0{Math.floor(t / 60)}:{String(t % 60).padStart(2, '0')}
    </div>
  );
}
