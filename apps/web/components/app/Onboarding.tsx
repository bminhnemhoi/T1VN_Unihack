'use client';
/**
 * First-run guide (B23 part 2): two questions, then a short guide that depends on the answers. Opens by itself right after a
 * wallet's first login when that wallet is in no circle yet (`shouldAutoShowOnboarding`), and again from Cài đặt. The wording
 * is the brief's fixed text. Answers stay in this browser; nothing is sent anywhere.
 * Phone: a full-height sheet sliding up. Desktop: a 560px dialog. "Bỏ qua" and Esc skip, focus is trapped, the heading takes focus.
 */
import { ArrowRightLeft, Lock, Wallet } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PasteInvite } from '@/components/app/parts';
import { useChain } from '@/lib/chain/provider';
import { useHuiWallet } from '@/lib/chain/walletProvider';
import { useMyCircles } from '@/lib/live/useCircleData';
import { useWalletBalance } from '@/lib/live/useWalletBalance';
import {
  isBusyRoute,
  markOnboarded,
  needsFaucet,
  readOnboarded,
  shouldAutoShowOnboarding,
  stepsFor,
  tourAction,
  type Answers,
  type PlayedBefore,
  type Purpose,
} from '@/lib/onboarding';
import { closeOnboarding, openOnboarding, useOnboardingOpen } from '@/lib/onboarding-store';
import s from './Onboarding.module.css';

/** Mounted once in the app frame: opens the guide for a new wallet, and renders it whenever it is open. */
export function OnboardingHost() {
  const open = useOnboardingOpen();
  const chain = useChain();
  const { wallet, status } = useHuiWallet();
  const my = useMyCircles();
  const pathname = usePathname();
  const tried = useRef<string | null>(null);
  const address = wallet?.address;
  const signedIn = chain !== null && status === 'ready' && address !== undefined;
  const circlesLoaded = my.status === 'ready' && my.source === 'chain';
  const circleCount = my.status === 'ready' ? my.circles.length : 0;

  useEffect(() => {
    if (!address || tried.current === address) return;
    const show = shouldAutoShowOnboarding({ signedIn, circlesLoaded, circleCount, onboarded: readOnboarded(address), busyRoute: isBusyRoute(pathname) });
    if (!circlesLoaded) return; // wait for the real answer before deciding
    tried.current = address;
    if (show) openOnboarding();
  }, [address, signedIn, circlesLoaded, circleCount, pathname]);

  return open ? <Guide address={address} onChain={chain !== null} /> : null;
}

function Guide({ address, onChain }: { address: `0x${string}` | undefined; onChain: boolean }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>({});
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState<'next' | 'back'>('next');
  const [pasting, setPasting] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const card = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const from = useRef<Element | null>(null);
  const titleId = useId();
  const steps = useMemo(() => stepsFor(answers.played), [answers.played]);
  const step = steps[Math.min(idx, steps.length - 1)]!;
  const balance = useWalletBalance(address);

  useEffect(() => {
    from.current = document.activeElement;
    setHost(document.getElementById('hs-root') ?? document.body); // inside the app frame, so the app's form styles apply
    return () => {
      if (from.current instanceof HTMLElement && from.current.isConnected) from.current.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    if (host) title.current?.focus({ preventScroll: true });
  }, [host, step, pasting]);

  const finish = (next?: () => void) => {
    if (address) markOnboarded(address, answers);
    closeOnboarding();
    next?.();
  };
  const go = (to: number) => {
    setDir(to < idx ? 'back' : 'next');
    setIdx(Math.max(0, to));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      finish();
      return;
    }
    if (e.key !== 'Tab' || !card.current) return;
    const items = [...card.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === title.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!host) return null;
  const action = tourAction(answers.purpose, onChain);
  const last = step === 'tour';
  const body = pasting ? (
    <Step dir="next" k="paste">
      <h2 id={titleId} ref={title} tabIndex={-1} className={s.title}>
        Dán link mời
      </h2>
      <PasteGuideForm />
    </Step>
  ) : (
    <Step dir={dir} k={step}>
      {step === 'q-played' && (
        <>
          <div>
            <h2 id={titleId} ref={title} tabIndex={-1} className={s.title}>
              Chào bạn. Cho mình hỏi nhanh 2 câu.
            </h2>
            <p className={s.sub}>Để chỉ đúng chỗ bạn cần. Câu trả lời chỉ lưu trên máy này.</p>
          </div>
          <Radios
            label="Bạn chơi hụi bao giờ chưa?"
            value={answers.played}
            options={[
              ['new', 'Chưa, mình mới nghe tới'],
              ['played', 'Rồi, mình từng góp hoặc làm chủ hụi'],
            ]}
            onPick={(v: PlayedBefore) => {
              setAnswers((a) => ({ ...a, played: v }));
              go(idx + 1);
            }}
          />
        </>
      )}
      {step === 'q-purpose' && (
        <>
          <h2 id={titleId} ref={title} tabIndex={-1} className={s.title}>
            Bạn vào HụiSafe để làm gì?
          </h2>
          <Radios
            label="Bạn vào HụiSafe để làm gì?"
            hideLabel
            value={answers.purpose}
            options={[
              ['invite', 'Vào một dây người quen mời'],
              ['own', 'Tự mở dây, làm chủ hụi'],
              ['look', 'Xem thử cho biết'],
            ]}
            onPick={(v: Purpose) => {
              setAnswers((a) => ({ ...a, purpose: v }));
              go(idx + 1);
            }}
          />
        </>
      )}
      {step.startsWith('learn-') && <LearnCard n={Number(step.slice(6)) as 1 | 2 | 3 | 4} titleId={titleId} titleRef={title} />}
      {step === 'played' && (
        <>
          <h2 id={titleId} ref={title} tabIndex={-1} className={s.title}>
            Ba điểm khác so với hụi bạn từng chơi
          </h2>
          <ul className={s.rows}>
            {[
              [<ArrowRightLeft key="a" aria-hidden />, 'Không ai cầm tiền', 'tiền góp đi thẳng từ ví người góp sang ví người hốt trong một giao dịch.'],
              [<Lock key="b" aria-hidden />, 'Thăm kín thật', 'lá thăm được niêm phong trên chuỗi, tới giờ mới mở, không ai đọc trộm được.'],
              [<Wallet key="c" aria-hidden />, 'Không cần AVAX', 'đăng nhập bằng Google hoặc email là có ví, phí mạng do HụiSafe trả.'],
            ].map(([icon, head, rest]) => (
              <li key={head as string}>
                <span className={s.ico}>{icon}</span>
                <span>
                  <b>{head}:</b> {rest}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {step === 'tour' && (
        <>
          <h2 id={titleId} ref={title} tabIndex={-1} className={s.title}>
            App có 4 chỗ chính
          </h2>
          <ul className={s.rows}>
            {[
              ['Tổng quan', 'việc bạn cần làm hôm nay và các dây của bạn.'],
              ['Dây', 'nộp thăm, mở thăm, xem ai hốt từng kỳ.'],
              ['Sổ hụi', 'mọi khoản tiền vào ra, mỗi dòng có link kiểm trên Snowtrace.'],
              ['Dây mới', 'mở một dây qua 6 câu hỏi.'],
            ].map(([head, rest]) => (
              <li key={head} style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
                <span>
                  <b>{head}:</b> {rest}
                </span>
              </li>
            ))}
          </ul>
          {needsFaucet(balance.data?.usdc) && (
            <p className={s.note} role="status">
              Ví của bạn chưa có USDC thử nghiệm. Lấy miễn phí 20 USDC ở{' '}
              <a className={s.link} href="https://faucet.circle.com" target="_blank" rel="noreferrer">
                faucet.circle.com
              </a>{' '}
              (chọn Avalanche Fuji).
            </p>
          )}
        </>
      )}
    </Step>
  );

  return createPortal(
    <div className={s.layer} data-testid="onboarding" onKeyDown={onKey}>
      <div className={s.scrim} onClick={() => finish()} aria-hidden />
      <section ref={card} className={s.card} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className={s.head}>
          <div className={s.dots} role="img" aria-label={`Bước ${Math.min(idx, steps.length - 1) + 1} trên ${steps.length}`}>
            {steps.map((id, i) => (
              <i key={id} className={i === idx ? s.on : i < idx ? s.done : ''} />
            ))}
          </div>
          <button type="button" className={s.skip} onClick={() => finish()}>
            Bỏ qua
          </button>
        </div>
        <div className={s.body}>{body}</div>
        {(pasting || idx > 0) && (
        <div className={s.foot}>
          {pasting ? (
            <button type="button" className={`${s.btn} ${s.ghost}`} onClick={() => setPasting(false)}>
              Quay lại
            </button>
          ) : last ? (
            <>
              {action.href ? (
                <button type="button" className={`${s.btn} ${s.main}`} onClick={() => finish(() => router.push(action.href!))}>
                  {action.label}
                </button>
              ) : (
                <button
                  type="button"
                  className={`${s.btn} ${s.main}`}
                  onClick={() => {
                    if (address) markOnboarded(address, answers);
                    setPasting(true);
                  }}
                >
                  {action.label}
                </button>
              )}
              <button type="button" className={`${s.btn} ${s.ghost}`} onClick={() => finish()}>
                Để sau
              </button>
            </>
          ) : (
            <>
              {idx > 0 && (
                <button type="button" className={`${s.btn} ${s.ghost}`} onClick={() => go(idx - 1)}>
                  Quay lại
                </button>
              )}
              {step !== 'q-played' && step !== 'q-purpose' && (
                <button type="button" className={`${s.btn} ${s.main}`} onClick={() => go(idx + 1)}>
                  Tiếp tục
                </button>
              )}
            </>
          )}
        </div>
        )}
      </section>
    </div>,
    host,
  );
}

function Step({ children, dir, k }: { children: ReactNode; dir: 'next' | 'back'; k: string }) {
  return (
    <div key={k} className={s.step} data-dir={dir} data-step={k}>
      {children}
    </div>
  );
}

/** Radio cards with roving focus: arrows move focus, Enter or Space picks (and moves on). */
function Radios<T extends string>({ label, value, options, onPick, hideLabel }: { label: string; value: T | undefined; options: [T, string][]; onPick: (v: T) => void; hideLabel?: boolean }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (e: KeyboardEvent, i: number) => {
    const delta = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    refs.current[(i + delta + options.length) % options.length]?.focus();
  };
  const tabbable = Math.max(0, options.findIndex(([v]) => v === value));
  return (
    <div role="radiogroup" aria-label={label} className={s.opts} data-hide-label={hideLabel}>
      {options.map(([v, text], i) => (
        <button
          key={v}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === v}
          tabIndex={i === tabbable ? 0 : -1}
          className={s.opt}
          onKeyDown={(e) => move(e, i)}
          onClick={() => onPick(v)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

const LEARN: Record<1 | 2 | 3 | 4, { head: string; text: string }> = {
  1: { head: 'Hụi là gì', text: 'Một nhóm người góp tiền đều đặn mỗi kỳ. Mỗi kỳ có một người nhận phần góp của cả nhóm, gọi là hốt. Mỗi người hốt đúng một lần.' },
  2: { head: 'Bỏ thăm để hốt sớm', text: 'Ai cần tiền trước thì bỏ thăm: chịu bớt cho mỗi người còn lại một khoản. Thăm cao nhất được hốt kỳ đó. Người hốt sau được các thăm trước bớt cho, nên nhận nhiều hơn.' },
  3: { head: 'Hụi truyền thống sợ gì', text: 'Chủ hụi ôm tiền bỏ trốn, hoặc người đã hốt không đóng tiếp. Người góp chỉ biết trông vào lòng tin.' },
  4: { head: 'HụiSafe làm gì khác', text: 'Luật của dây nằm trong smart contract trên blockchain Avalanche. Tiền góp ở trong ví bạn tới lúc chi, chủ hụi không giữ đồng nào. Chủ hụi phải khóa ký quỹ; ai bỏ đóng thì hợp đồng lấy ký quỹ bù ngay.' },
};

function LearnCard({ n, titleId, titleRef }: { n: 1 | 2 | 3 | 4; titleId: string; titleRef: React.RefObject<HTMLHeadingElement | null> }) {
  const { head, text } = LEARN[n];
  return (
    <div className={s.card3}>
      <Art n={n} />
      <h2 id={titleId} ref={titleRef} tabIndex={-1} className={s.title} style={{ fontSize: 22 }}>
        {head}
      </h2>
      <p>{text}</p>
    </div>
  );
}

/** Four small line drawings in the app palette: a ring of members, a ballot, a runaway bag, a locked contract. */
function Art({ n }: { n: 1 | 2 | 3 | 4 }) {
  const common = { viewBox: '0 0 240 120', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, role: 'presentation' } as const;
  if (n === 1)
    return (
      <svg {...common}>
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          return <circle key={i} cx={120 + Math.cos(a) * 44} cy={60 + Math.sin(a) * 44} r={9} fill={i === 0 ? '#a1ff62' : 'none'} />;
        })}
        <circle cx={120} cy={60} r={14} fill="#a1ff62" />
        <path d="M113 60h14M120 53v14" />
      </svg>
    );
  if (n === 2)
    return (
      <svg {...common}>
        <rect x={60} y={20} width={120} height={80} rx={8} />
        <path d="M76 44h50M76 76h30" />
        <rect x={132} y={56} width={36} height={28} rx={6} fill="#a1ff62" />
        <path d="M142 70h16" />
      </svg>
    );
  if (n === 3)
    return (
      <svg {...common}>
        <path d="M70 44c0-10 8-16 18-16s18 6 18 16l10 44H60z" />
        <path d="M80 28l8-8 8 8M82 62h12" />
        <path d="M150 64h40m-10-10 10 10-10 10" strokeDasharray="4 6" />
        <circle cx={206} cy={64} r={8} />
      </svg>
    );
  return (
    <svg {...common}>
      <rect x={84} y={52} width={72} height={52} rx={8} />
      <path d="M100 52V40a20 20 0 0 1 40 0v12" />
      <circle cx={120} cy={78} r={7} fill="#a1ff62" />
      <path d="M120 85v8M40 60h26M174 60h26" strokeDasharray="4 6" />
    </svg>
  );
}

/** The existing paste box, inside the guide. */
function PasteGuideForm() {
  return (
    <div className={s.form}>
      <PasteInvite />
    </div>
  );
}
