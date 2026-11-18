'use client';
/**
 * "Dây mới" (prototype `viewCreate`): focus mode, one question per screen, six steps. Holdback, commission and reserve
 * keep the defaults (shown on the review step); the bond is the minimum for 100% coverage, the Fuji floor (ADR-22).
 * On chain data "Tạo dây" sends `createCircle` then `depositBond`; on sample data the steps are simulated.
 */
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { DEFAULT_MIN_COVERAGE_BPS, formatUsdcNumber, parseUsdc, previewCircle } from 'sdk';
import { TxButton, TxNote, TxSteps, useStepTx } from '@/components/app/tx';
import { useChain } from '@/lib/chain/provider';
import { useHuiWallet } from '@/lib/chain/walletProvider';
import { DEFAULTS, termsOf, validateForm, type FormState } from '@/lib/circleForm';
import { createThenDeposit } from '@/lib/create-flow';
import { capOf } from '@/lib/hui-calc';
import { buildCreateInput } from '@/lib/live/createInput';
import { useWalletBalance } from '@/lib/live/useWalletBalance';

const f = (u: bigint): string => {
  const s = formatUsdcNumber(u);
  return s.includes(',') ? s : `${s},00`;
};
const STEPS = 6;
const DRAFT_KEY = 'huisafe.wizard.v1';
const DEMO_BUILD = process.env.NEXT_PUBLIC_HUISAFE_DEMO === 'true';

export function CreateCircle() {
  const chain = useChain();
  const { wallet } = useHuiWallet();
  const walletBal = useWalletBalance(chain ? wallet?.address : undefined);
  const t = useStepTx();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(0);
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [over18, setOver18] = useState(false);
  const [tried18, setTried18] = useState(false);
  const [made, setMade] = useState<{ address?: `0x${string}` } | null>(null);
  const [pendingCircle, setPendingCircle] = useState<`0x${string}` | undefined>(undefined);
  const q = useRef<HTMLDivElement>(null);
  const n = Number(form.n);
  const cUnits = parseUsdc(form.c.trim().replace(/\./g, ''));
  const okC = cUnits !== undefined && cUnits >= 1_000_000n && cUnits <= 10_000_000_000n;
  const preview = useMemo(
    () => previewCircle({ n: BigInt(n), c: okC ? cUnits! : 100_000_000n, periodDays: BigInt(form.periodDays), alphaBps: 2000n, bond: 0n, capBps: 2000n, minCoverageBps: DEFAULT_MIN_COVERAGE_BPS }),
    [n, okC, cUnits, form.periodDays],
  );
  // The bond is always the minimum for 100% coverage.
  const bond = preview.bondFor100;
  const full = { ...form, bond: (Number(bond) / 1_000_000).toString() };
  const { value } = validateForm(full);
  const cap1 = value ? capOf(termsOf(full, value), 1) : 0n;
  const revealBond = ((okC ? cUnits! : 0n) * 100n) / 10_000n;
  const allowance = BigInt(n - 1) * ((okC ? cUnits! : 0n) + revealBond);

  /** The circle this screen already created on chain, kept across retries and page reloads (audit L-01 + B27). */
  const createdRef = useRef<`0x${string}` | undefined>(undefined);

  // Keep what was typed on this device (and give the assistant the draft, `draftFromStorage`).
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null') as { f?: Partial<FormState>; created?: string } | null;
      if (raw?.f && typeof raw.f === 'object') setForm((s) => ({ ...s, mode: raw.f!.mode === 'fixed' ? 'fixed' : 'bidding', n: String(raw.f!.n ?? s.n), c: String(raw.f!.c ?? s.c), periodDays: String(raw.f!.periodDays ?? s.periodDays) }));
      if (raw?.created && /^0x[0-9a-fA-F]{40}$/.test(raw.created)) {
        createdRef.current = raw.created as `0x${string}`;
        setPendingCircle(raw.created as `0x${string}`);
      }
    } catch {
      // storage blocked or broken: start from the defaults
    }
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          f: { ...form, bond: (Number(bond) / 1_000_000).toString() },
          ...(pendingCircle ? { created: pendingCircle } : {}),
        }),
      );
    } catch {
      // storage blocked: nothing to keep
    }
  }, [form, bond, pendingCircle]);

  // Focus the question after a step change (keyboard and screen readers land on it), not on the first paint.
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) {
      moved.current = true;
      return;
    }
    q.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
  }, [step, made]);

  const go = (to: number) => {
    setDir(Math.sign(to - step));
    setStep(to);
  };
  const set = (patch: Partial<FormState>) => setForm((s) => ({ ...s, ...patch }));
  const insufficientBondUsdc = Boolean(chain && wallet?.address && walletBal.data && walletBal.data.usdc < bond);

  const create = async (retry: boolean) => {
    if (!over18) {
      setTried18(true);
      document.getElementById('over18')?.focus();
      return;
    }
    if (!value || insufficientBondUsdc) return;
    // A retry after the bond deposit failed deposits into the circle already created, never a second one (audit L-01).
    const ok = await t.run(
      (a) =>
        createThenDeposit(
          a,
          async () => buildCreateInput(full, value, { nowSec: Number((await chain!.client.getBlock()).timestamp), demo: DEMO_BUILD }),
          value.bond,
          createdRef.current,
          (c) => {
            createdRef.current = c;
            setPendingCircle(c);
          },
        ),
      { forceOk: retry, failText: 'Gửi không được vì mạng lỗi. Dây chưa được tạo, bạn chưa mất gì.' },
    );
    if (ok) {
      const doneAddr = createdRef.current;
      createdRef.current = undefined;
      setPendingCircle(undefined);
      setMade({ ...(doneAddr ? { address: doneAddr } : {}) });
    }
  };

  const bars = Array.from({ length: STEPS }, (_, i) => <i key={i} className={made || i < step ? 'd' : i === step ? 'n' : ''} />);
  const top = (
    <div className="crTop">
      <span className="label">Tạo dây · {made ? 'xong' : `bước ${step + 1}/${STEPS}`}</span>
      <div className="strip" style={{ ['--n' as string]: STEPS }} aria-hidden>
        {bars}
      </div>
    </div>
  );

  if (made) {
    return (
      <main id="noi-dung" className="cr in">
        {top}
        <div className="crQ crDone in" ref={q}>
          <div className="stamp on win land">
            ĐÃ TẠO DÂY
            <small>
              {n} người × {f(cUnits ?? 0n)} USDC
            </small>
          </div>
          <h1 tabIndex={-1}>Gửi đường dẫn mời cho {n - 1} người còn lại.</h1>
          <p className="sub">
            Đủ người thì bạn bấm &quot;Bắt đầu dây&quot;. Ký quỹ {f(bond)} USDC khóa trong smart contract, bạn không rút được cho tới khi dây kết thúc.
            {chain ? '' : ' Bản xem thử: chưa gửi gì lên blockchain.'}
          </p>
          <TxNote t={t} ok="Đã xác nhận trên Fuji." />
        </div>
        <div className="crNav">
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              setMade(null);
              setForm(DEFAULTS);
              setOver18(false);
              setStep(0);
              t.reset();
            }}
          >
            Tạo dây khác
          </button>
          <Link className="btn lime" href={made.address ? `/circles/${made.address}` : '/circles/dang-gom'}>
            Mở dây vừa tạo ↗
          </Link>
        </div>
      </main>
    );
  }

  const opt = (k: 'mode' | 'periodDays', val: string, title: string, sub: string) => (
    <button type="button" className="opt" role="radio" aria-checked={form[k] === val} tabIndex={form[k] === val ? 0 : -1} data-val={val} onClick={() => set({ [k]: val } as Partial<FormState>)}>
      <strong>{title}</strong>
      <small>{sub}</small>
    </button>
  );
  /** Arrow keys move the choice inside a radio group (WAI-ARIA radio pattern). */
  const arrows = (k: 'mode' | 'periodDays') => (e: KeyboardEvent<HTMLDivElement>) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    const at = items.findIndex((b) => b.getAttribute('aria-checked') === 'true');
    const to = items[(at + d + items.length) % items.length]!;
    set({ [k]: to.dataset.val } as Partial<FormState>);
    to.focus();
  };
  const canNext = step !== 2 || okC;
  let body = null;
  if (step === 0)
    body = (
      <>
        <h1 id="qMode" tabIndex={-1}>
          Dây hụi của bạn chơi kiểu gì?
        </h1>
        <div className="opts" role="radiogroup" aria-labelledby="qMode" onKeyDown={arrows('mode')}>
          {opt('mode', 'bidding', 'Bỏ thăm', 'Ai cần tiền sớm thì bỏ thăm. Thăm cao nhất hốt, mọi người góp bớt đúng số đó.')}
          {opt('mode', 'fixed', 'Cố định', 'Hốt lần lượt theo thứ tự vào dây. Không lãi, không bỏ thăm.')}
        </div>
      </>
    );
  if (step === 1)
    body = (
      <>
        <h1 tabIndex={-1}>Bao nhiêu người chơi?</h1>
        <div className="stepper">
          <button type="button" aria-label="Bớt một người" disabled={n <= 3} onClick={() => set({ n: String(n - 1) })}>
            −
          </button>
          <output aria-live="polite">{n}</output>
          <button type="button" aria-label="Thêm một người" disabled={n >= 30} onClick={() => set({ n: String(n + 1) })}>
            +
          </button>
        </div>
        <div className="range">
          <input type="range" min={3} max={30} step={1} value={n} aria-label="Số người chơi, từ 3 đến 30" onChange={(e) => set({ n: e.target.value })} />
          <span>
            <span>3</span>
            <span>30</span>
          </span>
        </div>
        <p className="sub">Dây có {n} kỳ, mỗi người hốt đúng một lần. Từ 3 đến 30 người, tính cả bạn nếu bạn cũng chơi.</p>
      </>
    );
  if (step === 2)
    body = (
      <>
        <h1 tabIndex={-1}>
          <label htmlFor="cIn">Mỗi kỳ, mỗi người góp bao nhiêu?</label>
        </h1>
        <div className="bigIn">
          <input
            id="cIn"
            inputMode="decimal"
            autoComplete="off"
            value={form.c}
            aria-describedby="cHint"
            aria-invalid={!okC}
            onChange={(e) => set({ c: e.target.value.trim() })}
            onKeyDown={(e) => e.key === 'Enter' && okC && go(3)}
          />
          <span>USDC</span>
        </div>
        <div className="chips">
          {['10', '50', '100', '500'].map((v) => (
            <button key={v} type="button" aria-pressed={form.c === v} onClick={() => set({ c: v })}>
              {v}
            </button>
          ))}
        </div>
        <p className={`sub${okC ? '' : ' err'}`} id="cHint">
          {cUnits === undefined
            ? 'Nhập số tiền, ví dụ 100.'
            : !okC
              ? cUnits < 1_000_000n
                ? 'Tối thiểu 1 USDC.'
                : 'Bản thử nghiệm tối đa 10.000 USDC mỗi kỳ.'
              : `Mỗi kỳ người hốt nhận khoảng ${f(BigInt(n - 1) * cUnits)} USDC trước phí và tiền giữ lại.`}
        </p>
      </>
    );
  if (step === 3)
    body = (
      <>
        <h1 id="qPeriod" tabIndex={-1}>
          Bao lâu một kỳ?
        </h1>
        <div className="opts" role="radiogroup" aria-labelledby="qPeriod" onKeyDown={arrows('periodDays')}>
          {opt('periodDays', '7', 'Mỗi tuần', 'Nhanh, nhưng trần thăm theo luật rất nhỏ.')}
          {opt('periodDays', '15', 'Nửa tháng', 'Cân bằng.')}
          {opt('periodDays', '30', 'Mỗi tháng', 'Kiểu hụi quen thuộc nhất.')}
        </div>
        <p className="sub">
          {form.mode === 'bidding' ? (
            <>
              Trần thăm kỳ 1 theo NĐ 19 Điều 21: <b className="mono">{f(cap1)} USDC</b> (cách hiểu của nhóm, chờ luật sư xác nhận).
            </>
          ) : (
            'Hụi cố định không có thăm nên không có trần thăm.'
          )}
        </p>
      </>
    );
  if (step === 4)
    body = (
      <>
        <h1 tabIndex={-1}>Bạn khóa ký quỹ bao nhiêu?</h1>
        <div className="bondBig">
          {f(bond)}
          <span>USDC</span>
        </div>
        <div className="meter">
          <span className="label">Chỉ số bảo chứng 100%</span>
          <div>
            <i />
          </div>
        </div>
        <p className="sub">
          Đủ để mọi người nhận đủ tiền khi những ai đã hốt cùng bỏ đóng một lúc. Rủi ro lớn nhất {f(preview.maxExposure)} USDC, tiền giữ lại 20% của người hốt che trước, ký quỹ che phần còn lại. Thấp hơn mức này dây không được bắt đầu.
        </p>
      </>
    );
  if (step === 5)
    body = (
      <>
        <h1 tabIndex={-1}>Xem lại rồi tạo dây.</h1>
        <dl className="rc">
          <div>
            <dt>Kiểu</dt>
            <dd>{form.mode === 'bidding' ? 'Bỏ thăm' : 'Cố định'}</dd>
          </div>
          <div>
            <dt>Số người, số kỳ</dt>
            <dd>{n}</dd>
          </div>
          <div>
            <dt>Góp mỗi kỳ</dt>
            <dd>{f(cUnits ?? 0n)} USDC</dd>
          </div>
          <div>
            <dt>Một kỳ</dt>
            <dd>{form.periodDays} ngày</dd>
          </div>
          <div>
            <dt>Ký quỹ bạn khóa</dt>
            <dd>{f(bond)} USDC</dd>
          </div>
          <div>
            <dt>Mỗi thành viên cho dây trích tối đa</dt>
            <dd>{f(allowance)} USDC</dd>
          </div>
          <div>
            <dt>Giữ lại / quỹ dự phòng / hoa hồng tối đa</dt>
            <dd>
              {form.alpha}% / {form.reserve}% / {form.fee}%
            </dd>
          </div>
        </dl>
        <label className="check" htmlFor="over18">
          <input id="over18" type="checkbox" checked={over18} onChange={(e) => setOver18(e.target.checked)} aria-invalid={tried18 && !over18} aria-describedby="over18Hint" />
          <span>Tôi đủ 18 tuổi và tự nguyện tổ chức dây hụi này (NĐ 19/2019 Điều 5, 6).</span>
        </label>
        <p className={`sub${tried18 && !over18 ? ' err' : ''}`} id="over18Hint">
          {tried18 && !over18 ? 'Tích ô xác nhận đủ 18 tuổi để tạo dây.' : 'Tạo dây gồm hai lệnh: tạo dây rồi khóa ký quỹ. Bạn không cần AVAX.'}
        </p>
        {insufficientBondUsdc && walletBal.data && (
          <p className="sub err" role="status">
            Ví hiện có {f(walletBal.data.usdc)} USDC, còn thiếu {f(bond - walletBal.data.usdc)} USDC để khóa ký quỹ. Hãy nhận thêm USDC thử nghiệm tại{' '}
            <a href="https://faucet.circle.com" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
              faucet.circle.com
            </a>{' '}
            rồi{' '}
            <button
              type="button"
              onClick={() => void walletBal.refetch()}
              style={{ background: 'none', border: 0, padding: 0, textDecoration: 'underline', fontWeight: 700, cursor: 'pointer' }}
            >
              kiểm tra lại số dư
            </button>
            .
          </p>
        )}
        <TxSteps t={t} />
        <TxNote t={t} />
      </>
    );

  const back =
    step > 0 ? (
      <button className="btn ghost" type="button" disabled={t.busy} onClick={() => go(step - 1)}>
        ‹ Quay lại
      </button>
    ) : (
      <Link className="btn ghost" href="/circles">
        Huỷ tạo dây
      </Link>
    );
  const next =
    step === 5 ? (
      <TxButton
        t={t}
        label={pendingCircle ? 'Nạp ký quỹ vào dây vừa tạo' : 'Tạo dây'}
        retryLabel={pendingCircle ? 'Nạp lại ký quỹ vào dây vừa tạo' : 'Gửi lại lệnh tạo dây'}
        disabled={insufficientBondUsdc}
        onRun={(r) => void create(r)}
      />
    ) : (
      <button className="btn ink" type="button" disabled={!canNext} onClick={() => go(step + 1)}>
        Tiếp tục ›
      </button>
    );
  return (
    <main id="noi-dung" className="cr in">
      {top}
      <div key={step} ref={q} className={`crQ ${dir > 0 ? 'inL' : dir < 0 ? 'inR' : 'in'}`}>
        {body}
      </div>
      <div className="crNav">
        {back}
        {next}
      </div>
    </main>
  );
}
