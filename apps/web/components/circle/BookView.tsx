'use client';

import { Download, Printer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatBps, formatUsdc, huiMath } from 'sdk';
import { keccak256, toHex } from 'viem';
import { CirclePageHead } from '@/components/circle/CirclePageHead';
import { LedgerList } from '@/components/LedgerList';
import { SoonButton } from '@/components/shell/SoonButton';
import { useToast } from '@/components/shell/Toast';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatVnTime, getSampleCircle, settledAtMs, settledRound, type CircleId, type SampleCircleData } from '@/lib/sample-circles';
import { TOGGLE_ON } from '@/lib/utils';

type Kind = 'Góp' | 'Thiếu' | 'Bù' | 'Hốt' | 'Nhả tiền giữ lại' | 'Vỡ nợ';

interface Line {
  ms: number;
  round: number;
  member: string;
  kind: Kind;
  detail?: string;
  amount: bigint;
  tx: string;
}

const txOf = (id: string, key: string): string => {
  const h = keccak256(toHex(`${id}:${key}`));
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
};

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
export function BookView({ id }: { id: CircleId }) {
  const c = getSampleCircle(id);
  const { show } = useToast();
  const [round, setRound] = useState('all');
  const lines = useMemo(() => buildLines(c), [c]);
  const shown = round === 'all' ? lines : lines.filter((l) => l.round === Number(round));
  const sum = (kind: Kind) => lines.filter((l) => l.kind === kind).reduce((a, l) => a + l.amount, 0n);
  const claims = c.shortfalls.reduce((a, s) => a + s.uncovered, 0n);
  const t = c.terms;

  const exportJson = () => {
    const payload = {
      circle: { label: c.label, mode: t.mode, members: Number(t.n), contribution: t.c.toString(), sample: true },
      lines: shown.map((l) => ({ time: formatVnTime(l.ms), round: l.round, member: l.member, kind: l.kind, detail: l.detail ?? null, amountUsdc: formatUsdc(l.amount), tx: l.tx })),
      note: 'Dữ liệu mẫu. Bản thật dựng từ sự kiện trên mạng.',
    };
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `so-ho-${c.id}${round === 'all' ? '' : `-ky-${round}`}.json`;
      a.click();
      URL.revokeObjectURL(url);
      show(`Đã tải ${shown.length} dòng sổ họ dạng JSON (dữ liệu mẫu).`);
    } catch {
      show('Máy không cho tải file. Thử lại bằng trình duyệt khác.', 'error');
    }
  };

  return (
    <main id="noi-dung" className="mx-auto max-w-6xl px-4 py-10">
      <CirclePageHead circle={c} title="Sổ hụi">
        Mỗi dòng là một lần tiền đi: góp, bù, hốt, nhả. Ai cũng xem được, không cần đăng nhập.
      </CirclePageHead>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" size="lg" onClick={exportJson}>
          <Download aria-hidden className="size-5" /> Tải JSON
        </Button>
        <SoonButton size="lg" variant="outline" message="Sổ hụi dạng PDF sẽ dựng từ dữ liệu trên mạng, sắp có. Hiện là màn hình mẫu.">
          <Printer aria-hidden className="size-5" /> Tải PDF
        </SoonButton>
      </div>

      <section aria-labelledby="dau-so" className="to-giay mt-8 p-6">
        <h2 id="dau-so" className="font-display text-h2 font-bold">
          Thông tin dây
        </h2>
        <div className="grid gap-x-10 md:grid-cols-2">
          <LedgerList
            items={[
              { label: 'Tên dây', value: c.label },
              { label: 'Chủ hụi', value: c.organizerAddr },
              { label: 'Kiểu họ', value: t.mode === 'fixed' ? 'Cố định (hốt lần lượt)' : 'Bỏ thăm' },
              { label: 'Số phần / mức góp', value: `${t.n} phần × ${formatUsdc(t.c)}` },
              { label: 'Kỳ danh nghĩa', value: `${t.periodDays} ngày` },
            ]}
          />
          <LedgerList
            items={[
              { label: 'Trần lãi / lãi chậm góp', value: t.mode === 'fixed' ? 'Không có lãi / 10%/năm' : '20%/năm / 10%/năm' },
              { label: 'Tiền giữ lại', value: formatBps(t.alphaBps) },
              { label: 'Tiền công / quỹ dự phòng', value: `${formatBps(t.feeBps)} / ${formatBps(t.reserveBps)}` },
              { label: 'Ký quỹ', value: formatUsdc(c.bond) },
              { label: 'Bắt đầu', value: formatVnTime(c.startMs) },
            ]}
          />
        </div>
      </section>

      <section aria-labelledby="cac-dong" className="mt-10">
        <h2 id="cac-dong" className="font-display text-h2 font-bold">
          Các dòng
        </h2>
        {c.settled === 0 ? (
          <p className="o-phang mt-4 p-6 text-lead text-muted-foreground">Chưa có dòng nào vì chưa kỳ nào được chi.</p>
        ) : (
          <>
            <p id="loc-ky" className="mt-2 text-muted-foreground">
              Lọc theo kỳ
            </p>
            <ToggleGroup type="single" variant="outline" value={round} onValueChange={(v) => v && setRound(v)} aria-labelledby="loc-ky" className="mt-1 flex-wrap">
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
            <div className="o-phang mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label="Bảng sổ hụi, kéo ngang để xem hết">
              <table className="w-full min-w-[46rem] text-base">
                <caption className="sr-only">Các dòng sổ hụi</caption>
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className="p-3 font-semibold">Ngày giờ</th>
                    <th scope="col" className="p-3 font-semibold">Kỳ</th>
                    <th scope="col" className="p-3 font-semibold">Thành viên</th>
                    <th scope="col" className="p-3 font-semibold">Loại</th>
                    <th scope="col" className="p-3 text-right font-semibold">Số tiền</th>
                    <th scope="col" className="p-3 font-semibold">Giao dịch (mã mẫu)</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((l, i) => (
                    <tr key={i} className="dong-ke last:border-b-0">
                      <td className="so-ke p-3 whitespace-nowrap">{formatVnTime(l.ms)}</td>
                      <td className="so-ke p-3">{l.round}</td>
                      <td className="p-3">{l.member}</td>
                      <td className="p-3">
                        {l.kind}
                        {l.detail ? ` (${l.detail})` : ''}
                      </td>
                      <td className="so-ke p-3 text-right font-semibold whitespace-nowrap">{formatUsdc(l.amount)}</td>
                      <td className="so-ke p-3 text-muted-foreground">{l.tx}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="cuoi-so" className="o-phang mt-8 p-6">
        <h2 id="cuoi-so" className="font-display text-h3 font-bold">
          Tổng kết sổ
        </h2>
        <LedgerList
          className="mt-2"
          items={[
            { label: 'Tổng góp', value: formatUsdc(sum('Góp')) },
            { label: 'Tổng hốt (thực nhận)', value: formatUsdc(sum('Hốt')) },
            { label: 'Tổng đã bù', value: formatUsdc(sum('Bù') - claims) },
            { label: 'Khoản đòi còn lại', value: formatUsdc(claims) },
          ]}
        />
        <p className="mt-3 text-muted-foreground">Bản in này dựng từ dữ liệu trên mạng tại thời điểm in. Màn hình này đang dùng số liệu mẫu.</p>
      </section>
    </main>
  );
}
