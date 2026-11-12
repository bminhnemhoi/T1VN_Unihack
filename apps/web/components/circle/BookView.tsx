'use client';

import { Download, Printer } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatBps, formatUsdc, huiMath } from 'sdk';
import { keccak256, toHex } from 'viem';
import { CirclePageHead } from '@/components/circle/CirclePageHead';
import { LedgerGrid } from '@/components/circle/LedgerGrid';
import type { Phase } from '@/components/circle/RoundTimeline';
import { toLedger, toSampleMembers } from '@/lib/chain/adapter';
import { DEMO_LEDGER, DEMO_MEMBERS, VIEWER } from '@/lib/sample';
import { EXPLORER_TX } from '@/components/chain/useTx';
import { LedgerList } from '@/components/LedgerList';
import { useChain } from '@/lib/chain/provider';
import { bookTotals, eventsToLines, type BookLine } from '@/lib/live/bookLines';
import { useCircleEvents } from '@/lib/live/useCircleEvents';
import { QrCode } from '@/components/circle/QrCode';
import { useToast } from '@/components/shell/Toast';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatVnTime, settledAtMs, settledRound, type SampleCircleData } from '@/lib/sample-circles';
import { shortAddress } from '@/lib/live/circleData';
import { TOGGLE_ON } from '@/lib/utils';

type Line = BookLine;

const txOf = (id: string, key: string): string => {
  const h = keccak256(toHex(`${id}:${key}`));
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
};

const SNOWTRACE = 'https://testnet.snowtrace.io';

/**
 * Nicknames live only in the organizer's own browser (docs/05 section 13, key `huisafe.nicknames.<circle>`); nothing
 * personal ever comes from the server or the chain. Every storage access is wrapped: no storage means no nicknames.
 */
function useNicknames(circle: string | undefined): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!circle) return;
    try {
      const raw = window.localStorage.getItem(`huisafe.nicknames.${circle}`);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object') {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) if (typeof v === 'string' && v.trim()) out[k.toLowerCase()] = v.trim().slice(0, 40);
        setNames(out);
      }
    } catch {
      /* no storage, or a broken value: no nicknames */
    }
  }, [circle]);
  return names;
}

/** The book is rebuilt from the same events the contract emits (docs/05 section 10): one line per money movement. */
function buildLines(c: SampleCircleData): Line[] {
  const out: Line[] = [];
  const release = huiMath.releasePerRound(c.terms.alphaBps, c.terms.c);
  for (let r = 1; r <= c.settled; r++) {
    const ms = settledAtMs(c, r);
    const s = settledRound(c, r);
    c.seats.forEach((seat, i) => {
      if (!seat.joined || i === s.winner) return;
      const sf = c.shortfalls.find((x) => x.round === r && x.member === i);
      const received = c.winnerByRound.slice(0, r - 1).includes(i);
      const key = `${r}:${i}`;
      if (sf) {
        out.push({ ms, round: r, member: seat.name, kind: 'Thiếu', amount: sf.amount, tx: txOf(c.id, `${key}:thieu`) });
        const cover: [string, bigint][] = [['tiền giữ lại', sf.fromHoldback], ['ký quỹ', sf.fromBond], ['quỹ dự phòng', sf.fromReserve], ['chưa bù được', sf.uncovered]];
        cover.forEach(([name, amount]) => amount > 0n && out.push({ ms, round: r, member: seat.name, kind: 'Bù', detail: name, amount, tx: txOf(c.id, `${key}:bu:${name}`) }));
        if (sf.status === 'defaulted') {
          out.push({ ms: ms + c.graceSeconds * 1000, round: r, member: seat.name, kind: 'Vỡ nợ', amount: sf.amount, tx: txOf(c.id, `${key}:vo`) });
        }
        return;
      }
      const due = received ? c.terms.c : c.terms.c - (c.bids[r - 1] ?? 0n);
      out.push({ ms, round: r, member: seat.name, kind: 'Góp', amount: due, tx: txOf(c.id, `${key}:gop`) });
      if (received && release > 0n) out.push({ ms, round: r, member: seat.name, kind: 'Nhả tiền giữ lại', amount: release, tx: txOf(c.id, `${key}:nha`) });
    });
    out.push({ ms, round: r, member: c.seats[s.winner]!.name, kind: 'Hốt', detail: 'thực nhận', amount: s.payout, tx: txOf(c.id, `${r}:hot`) });
  }
  return out.sort((a, b) => a.ms - b.ms || a.round - b.round);
}

/** S11: the "sổ họ" table with a round filter. JSON export downloads what is on screen; PDF waits for the server. */
const PHASE_OF = { commit: 'commit', reveal: 'reveal', 'awaiting-settle': 'settle', 'not-started': 'commit', done: 'settle' } as const;

/** Kỳ x member grid for the top of the book: chain data, or the bidding sample (docs/03 section 8); null for the other samples. */
function gridOf(c: SampleCircleData) {
  if (c.live) {
    const { members, viewer } = toSampleMembers(c.live.view, c.live.viewerAddress);
    const now = c.live.view.rounds.find((r) => r.k === c.settled + 1);
    return { members, viewer, rounds: toLedger(c.live.view), phase: PHASE_OF[now?.phase ?? 'commit'] as Phase };
  }
  return c.id === 'demo' ? { members: DEMO_MEMBERS, viewer: VIEWER, rounds: DEMO_LEDGER, phase: 'commit' as Phase } : null;
}

export function BookView({ c }: { c: SampleCircleData }) {
  const { show } = useToast();
  const [round, setRound] = useState('all');
  const chain = useChain();
  const events = useCircleEvents(c.live?.address);
  const nick = useNicknames(c.live?.address);
  const printedAt = useRef<HTMLSpanElement>(null);
  const lines = useMemo(
    () =>
      c.live
        ? eventsToLines(events.data ?? [], (a) => {
            const seat = c.seats.find((s) => s.address?.toLowerCase() === a.toLowerCase());
            return nick[a.toLowerCase()] ?? seat?.name ?? 'Chủ hụi hoặc ví khác';
          }, { organizer: c.live.view.organizer, commission: c.live.view.params.commissionMode })
        : buildLines(c),
    [c, events.data, nick],
  );
  // The print date is written straight into the DOM just before the browser prints (also for Ctrl+P), so the server
  // and browser renders stay identical and no stale time is shown.
  useEffect(() => {
    const stamp = () => {
      if (printedAt.current) printedAt.current.textContent = formatVnTime(Date.now());
    };
    window.addEventListener('beforeprint', stamp);
    return () => window.removeEventListener('beforeprint', stamp);
  }, []);
  const liveLoading = Boolean(c.live) && events.isPending;
  const shown = round === 'all' ? lines : lines.filter((l) => l.round === Number(round));
  const claims = c.live
    ? c.live.view.rounds.reduce((a, r) => a + r.shortfalls.filter((s) => !s.resolved).reduce((b, s) => b + s.uncovered, 0n), 0n)
    : c.shortfalls.reduce((a, s) => a + s.uncovered, 0n);
  const totals = bookTotals(lines, claims);
  const t = c.terms;
  const onFuji = chain?.chainId === 43113;
  const explorerUrl = c.live ? (onFuji ? `${SNOWTRACE}/address/${c.live.address}` : null) : SNOWTRACE;
  const memberRows = c.seats
    .map((seat, i) => ({ seat, i }))
    .filter(({ seat }) => seat.joined)
    .map(({ seat, i }) => {
      const r = c.winnerByRound.slice(0, c.settled).indexOf(i) + 1;
      const nickname = seat.address ? nick[seat.address.toLowerCase()] : undefined;
      return { order: i + 1, name: nickname ?? seat.name, address: seat.address, round: r > 0 ? r : null };
    });

  const printBook = () => {
    setRound('all');
    // Let React show every line first, then open the print dialog.
    window.setTimeout(() => window.print(), 50);
  };

  const exportJson = () => {
    const payload = {
      circle: { label: c.label, mode: t.mode, members: Number(t.n), contributionUsdc: formatUsdc(t.c), sample: !c.live, ...(c.live ? { address: c.live.address } : {}) },
      lines: shown.map((l) => ({ time: formatVnTime(l.ms), round: l.round, member: l.member, kind: l.kind, detail: l.detail ?? null, amountUsdc: formatUsdc(l.amount), tx: l.tx })),
      note: c.live ? 'Dựng từ sự kiện trên mạng tại thời điểm tải.' : 'Dữ liệu mẫu. Bản thật dựng từ sự kiện trên mạng.',
    };
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `so-ho-${c.id}${round === 'all' ? '' : `-ky-${round}`}.json`;
      a.click();
      URL.revokeObjectURL(url);
      show(`Đã tải ${shown.length} dòng sổ hụi dạng JSON${c.live ? '' : ' (dữ liệu mẫu)'}.`);
    } catch {
      show('Máy không cho tải file. Thử lại bằng trình duyệt khác.', 'error');
    }
  };

  return (
    <main id="noi-dung" className="book mx-auto max-w-6xl px-4 py-10 print:max-w-none print:p-0">
      <p className="hidden text-sm print:block">
        HụiSafe · Sổ hụi điện tử · In lúc <span ref={printedAt}>…</span> (giờ Việt Nam)
      </p>
      <CirclePageHead circle={c} title="Sổ hụi">
        Mỗi dòng là một lần tiền đi: góp, bù, hốt, nhả. Ai cũng xem được, không cần đăng nhập.
      </CirclePageHead>

      <div className="mt-6 flex flex-wrap gap-3 print:hidden">
        <Button type="button" size="lg" onClick={printBook}>
          <Printer aria-hidden className="size-5" /> In sổ hụi
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={exportJson}>
          <Download aria-hidden className="size-5" /> Tải JSON
        </Button>
      </div>

      {(() => {
        const g = gridOf(c);
        return g && (
          <div className="mt-8 print:hidden">
            <LedgerGrid members={g.members} rounds={g.rounds} viewer={g.viewer} phase={g.phase} />
          </div>
        );
      })()}

      <section aria-labelledby="dau-so" className="to-giay mt-8 p-6 print:break-inside-avoid">
        <h2 id="dau-so" className="font-display text-h2 font-bold">
          Thông tin dây
        </h2>
        <div className="grid gap-x-10 md:grid-cols-2">
          <LedgerList
            items={[
              { label: 'Tên dây', value: c.label },
              ...(c.live ? [{ label: 'Địa chỉ dây', value: <span className="break-all font-mono text-[0.9rem] font-normal">{c.live.address}</span> }] : []),
              { label: 'Chủ hụi', value: <span className="break-all">{c.organizerAddr}</span> },
              { label: 'Kiểu họ', value: t.mode === 'fixed' ? 'Cố định (hốt lần lượt)' : 'Bỏ thăm' },
              { label: 'Số phần / mức góp', value: `${t.n} phần × ${formatUsdc(t.c)}` },
              { label: 'Kỳ danh nghĩa', value: `${t.periodDays} ngày` },
            ]}
          />
          <LedgerList
            items={[
              { label: 'Trần lãi / lãi chậm góp', value: `${t.mode === 'fixed' ? 'Không có lãi' : `${formatBps(t.capBps)}/năm`} / ${formatBps(c.live?.view.lateRateBps ?? 1000)}/năm` },
              { label: 'Tiền giữ lại', value: formatBps(t.alphaBps) },
              { label: 'Tiền công / quỹ dự phòng', value: `${formatBps(t.feeBps)} / ${formatBps(t.reserveBps)}` },
              { label: 'Ký quỹ', value: formatUsdc(c.bond) },
              { label: 'Bắt đầu', value: formatVnTime(c.startMs) },
            ]}
          />
        </div>
        <div className="mt-4 flex items-center gap-4 border-t border-border pt-4">
          {explorerUrl ? (
            <>
              <QrCode text={explorerUrl} label={c.live ? 'Mã QR dẫn tới trang của dây trên Snowtrace' : 'Mã QR mẫu dẫn tới Snowtrace, sổ thật dẫn tới trang của dây'} size={112} />
              <p className="text-muted-foreground">
                {c.live ? 'Quét mã để mở trang của dây trên Snowtrace và đối chiếu từng giao dịch.' : 'Mã mẫu. Sổ của dây thật có mã dẫn tới trang của dây trên Snowtrace để đối chiếu từng giao dịch.'}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">Dây chạy trên mạng thử nội bộ nên không có trang Snowtrace để đối chiếu.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="thanh-vien" className="mt-10 print:break-inside-avoid">
        <h2 id="thanh-vien" className="font-display text-h2 font-bold">
          Thành viên
        </h2>
        <div className="o-phang mt-4 overflow-x-auto print:overflow-visible" tabIndex={0} role="region" aria-label="Danh sách thành viên, kéo ngang để xem hết">
          <table className="w-full text-base">
            <caption className="sr-only">Thành viên theo thứ tự vào dây</caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="p-3 font-semibold">Thứ tự vào dây</th>
                <th scope="col" className="p-3 font-semibold">Thành viên</th>
                <th scope="col" className="p-3 font-semibold">Ví</th>
                <th scope="col" className="p-3 font-semibold">Kỳ đã hốt</th>
              </tr>
            </thead>
            <tbody>
              {memberRows.map((m) => (
                <tr key={m.order} className="dong-ke last:border-b-0 print:break-inside-avoid">
                  <td className="so-ke p-3">{m.order}</td>
                  <td className="p-3">{m.name}</td>
                  <td className="so-ke p-3 break-all text-muted-foreground">{m.address ? (c.live ? m.address : shortAddress(m.address)) : '—'}</td>
                  <td className="so-ke p-3">{m.round ?? 'Chưa hốt'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="cac-dong" className="mt-10">
        <h2 id="cac-dong" className="font-display text-h2 font-bold">
          Các dòng
        </h2>
        {liveLoading ? (
          <p role="status" className="o-phang mt-4 p-6 text-lead text-muted-foreground">Đang đọc sự kiện của dây từ mạng…</p>
        ) : c.settled === 0 ? (
          <p className="o-phang mt-4 p-6 text-lead text-muted-foreground">Chưa có dòng nào vì chưa kỳ nào được chi.</p>
        ) : (
          <>
            <p id="loc-ky" className="mt-2 text-muted-foreground print:hidden">
              Lọc theo kỳ
            </p>
            <ToggleGroup type="single" variant="outline" value={round} onValueChange={(v) => v && setRound(v)} aria-labelledby="loc-ky" className="mt-1 flex-wrap print:hidden">
              <ToggleGroupItem value="all" className={TOGGLE_ON}>Tất cả</ToggleGroupItem>
              {Array.from({ length: c.settled }, (_, i) => (
                <ToggleGroupItem key={i} value={String(i + 1)} className={TOGGLE_ON}>
                  Kỳ {i + 1}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p role="status" className="mt-3 text-muted-foreground">
              Đang hiện {shown.length} trên {lines.length} dòng.
            </p>
            <div className="o-phang mt-2 overflow-x-auto print:overflow-visible" tabIndex={0} role="region" aria-label="Bảng sổ hụi, kéo ngang để xem hết">
              <table className="w-full min-w-[46rem] text-base print:min-w-0 print:text-[9pt]">
                <caption className="sr-only">Các dòng sổ hụi</caption>
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className="p-3 font-semibold">Ngày giờ</th>
                    <th scope="col" className="p-3 font-semibold">Kỳ</th>
                    <th scope="col" className="p-3 font-semibold">Thành viên</th>
                    <th scope="col" className="p-3 font-semibold">Loại</th>
                    <th scope="col" className="p-3 text-right font-semibold">Số tiền</th>
                    <th scope="col" className="p-3 font-semibold">{c.live ? 'Giao dịch' : 'Giao dịch (mã mẫu)'}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((l, i) => (
                    <tr key={i} className="dong-ke last:border-b-0 print:break-inside-avoid">
                      <td className="so-ke p-3 whitespace-nowrap">{formatVnTime(l.ms)}</td>
                      <td className="so-ke p-3">{l.round}</td>
                      <td className="p-3">{l.member}</td>
                      <td className="p-3">
                        {l.kind}
                        {l.detail ? ` (${l.detail})` : ''}
                      </td>
                      <td className="so-ke p-3 text-right font-semibold whitespace-nowrap">{formatUsdc(l.amount)}</td>
                      <td className="so-ke p-3 text-muted-foreground print:break-all">
                        {c.live ? (
                          chain?.chainId === 43113 ? (
                            <a href={`${EXPLORER_TX}${l.tx}`} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                              {l.tx.slice(0, 10)}…{l.tx.slice(-6)}
                            </a>
                          ) : (
                            <span title={l.tx}>{l.tx.slice(0, 10)}…{l.tx.slice(-6)}</span>
                          )
                        ) : (
                          l.tx
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="cuoi-so" className="o-phang mt-8 p-6 print:break-inside-avoid">
        <h2 id="cuoi-so" className="font-display text-h3 font-bold">
          Tổng kết sổ
        </h2>
        <LedgerList
          className="mt-2"
          items={[
            { label: 'Tổng góp', value: formatUsdc(totals.contributed) },
            { label: 'Tổng hốt (thực nhận)', value: formatUsdc(totals.paidOut) },
            { label: 'Tổng đã bù', value: formatUsdc(totals.covered) },
            { label: 'Khoản đòi còn lại', value: formatUsdc(totals.claims) },
          ]}
        />
        {c.live?.view.ndc19.mustNotifyCommune && (
          <p className="mt-3 font-semibold">Dây này chạm ngưỡng phải thông báo cho UBND cấp xã (Nghị định 19/2019, Điều 14). Xem mục Thông báo UBND.</p>
        )}
        <p className="mt-3 text-muted-foreground">Bản in này dựng từ dữ liệu on-chain tại thời điểm in.{c.live ? '' : ' Màn hình này đang dùng số liệu mẫu.'}</p>
      </section>
    </main>
  );
}
