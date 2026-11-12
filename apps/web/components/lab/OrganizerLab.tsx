'use client';

import { useState } from 'react';
import { RowCards, WideTable } from '@/components/RowCards';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { economicsFor, type LabEconomics, type LabSybil } from '@/lib/lab-organizer';
import { cn, TOGGLE_ON } from '@/lib/utils';

const fmt = (v: number, digits: number): string => v.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: digits });
const usdc = (v: number, digits = 2): string => `${fmt(v, digits)} USDC`;
const pct = (v: number): string => `${fmt(v, 2)}%`;
/** A sign alone is easy to miss, so a loss also says so in words. */
const signed = (v: number, shown: string): string => (v < 0 ? `${shown} (lỗ)` : shown);

const PERIOD_LABEL = (days: number): string => (days === 7 ? 'Hụi tuần' : days === 30 ? 'Hụi tháng' : `Kỳ ${days} ngày`);

/** The yearly return key in the file is the hazard scale: "1" is the assumed risk, "0.5" half of it. */
const scaleKey = (s: number): string => String(s);
const scaleLabel = (s: number): string => (s === 1 ? 'Rủi ro như giả định' : s === 0.5 ? 'Rủi ro bằng một nửa' : `Rủi ro × ${fmt(s, 2)}`);

/** The tables are wider than a tablet, so up to `lg` each row is a card (RowCards) and the table starts at `lg`. */
function Table({ caption, label, minWidth, children }: { caption: string; label: string; minWidth: string; children: React.ReactNode }) {
  return (
    <WideTable label={label} below="lg">
      <table className={cn('w-full text-base', minWidth)}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </WideTable>
  );
}

/** v1.2: what the organizer earns by commission schedule, by period and number of members. Every number comes from `sim/outputs/organizer_economics.json`. */
export function OrganizerEconomics({ data }: { data: LabEconomics }) {
  const [period, setPeriod] = useState(data.periods.includes(30) ? 30 : (data.periods[0] ?? 30));
  const [members, setMembers] = useState(data.members.includes(10) ? 10 : (data.members[0] ?? 10));
  const rows = economicsFor(data, period, members);
  const lossRows = rows.filter((r) => Object.values(r.annualReturnPctByHazardScale).some((v) => v !== null && v < 0));
  const bond = rows[0]?.bondUsdc;

  return (
    <section aria-labelledby="chu-hui-loi" className="mt-12">
      <h2 id="chu-hui-loi" className="font-display text-h2 font-bold">
        Chủ hụi kiếm được bao nhiêu
      </h2>
      <p className="mt-2 max-w-prose text-lead">
        Chủ hụi không cầm tiền nhưng phải ký quỹ, nên hoa hồng phải bù được rủi ro bảo lãnh. Bảng so ba cách tính hoa hồng: tiền công cố định 1% mỗi lần hốt, và hoa hồng nằm trong trần lãi (φ là phần quỹ lãi chủ hụi nhận).
      </p>

      <div className="nen-muc mt-4 rounded-xl p-6">
        <h3 className="font-display text-h3 font-bold text-white">Giả định của phần này</h3>
        <ul className="so-ke mt-2 space-y-1 text-[#e9e4da]">
          <li>
            Mức góp {usdc(data.c, 0)} mỗi kỳ, giữ lại {fmt(data.alphaBps / 100, 2)}%, ký quỹ vừa đủ chỉ số bảo chứng 100%{bond !== undefined ? ` (${usdc(bond, 0)} với dây đang chọn)` : ''}.
          </li>
          <li>
            Người đã hốt bỏ đóng một lần trong đời dây: {pct(data.hazardEarly * 100)} ở nửa đầu dây, {pct(data.hazardLate * 100)} ở nửa sau. Người thắng thăm mỗi kỳ bỏ thăm bằng {fmt(data.bidPctOfCap, 0)}% trần thực thi.
          </li>
        </ul>
        <p className="mt-3 font-semibold text-white">Các tỷ lệ bỏ đóng chỉ là giả định cho mô phỏng (tham khảo Klonner &amp; Rai, 2008), không phải số đo thật. Tỷ suất là kết quả của giả định, không phải dự báo.</p>
      </div>

      <div className="mt-6 flex flex-wrap gap-6">
        <div>
          <p id="chon-chu-ky" className="text-muted-foreground">
            Chu kỳ
          </p>
          <ToggleGroup type="single" variant="outline" value={String(period)} onValueChange={(v) => v && setPeriod(Number(v))} aria-labelledby="chon-chu-ky" className="mt-1 flex-wrap">
            {data.periods.map((p) => (
              <ToggleGroupItem key={p} value={String(p)} className={TOGGLE_ON}>
                {PERIOD_LABEL(p)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div>
          <p id="chon-so-nguoi" className="text-muted-foreground">
            Số người
          </p>
          <ToggleGroup type="single" variant="outline" value={String(members)} onValueChange={(v) => v && setMembers(Number(v))} aria-labelledby="chon-so-nguoi" className="mt-1 flex-wrap">
            {data.members.map((m) => (
              <ToggleGroupItem key={m} value={String(m)} className={TOGGLE_ON}>
                {m} người
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-muted-foreground">Chưa chạy mô phỏng cho cấu hình này.</p>
      ) : (
        <>
          <Table caption="Lời của chủ hụi theo cách tính hoa hồng" label="Bảng lời của chủ hụi, kéo ngang để xem hết" minWidth="min-w-[56rem]">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="p-3 font-semibold">Cách tính hoa hồng</th>
                <th scope="col" className="p-3 text-right font-semibold">Hoa hồng cả dây</th>
                <th scope="col" className="p-3 text-right font-semibold">Tổn thất kỳ vọng do bỏ đóng</th>
                <th scope="col" className="p-3 text-right font-semibold">Lời ròng sau rủi ro</th>
                {data.scales.map((s) => (
                  <th key={s} scope="col" className="p-3 text-right font-semibold">
                    Mỗi năm trên ký quỹ
                    <span className="block text-sm font-normal text-muted-foreground">{scaleLabel(s)}</span>
                  </th>
                ))}
                <th scope="col" className="p-3 font-semibold">Trong trần lãi luật</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.schedule} className="dong-ke last:border-b-0">
                  <th scope="row" className="p-3 text-left font-semibold">{r.schedule}</th>
                  <td className="so-ke p-3 text-right">{usdc(r.grossFeeUsdc)}</td>
                  <td className="so-ke p-3 text-right">{usdc(r.expectedLossUsdc)}</td>
                  <td className="so-ke p-3 text-right font-semibold">{signed(r.netAfterRiskUsdc, usdc(r.netAfterRiskUsdc))}</td>
                  {data.scales.map((s) => {
                    const v = r.annualReturnPctByHazardScale[scaleKey(s)] ?? null;
                    return (
                      <td key={s} className="so-ke p-3 text-right font-semibold">
                        {v === null ? 'không áp dụng' : signed(v, pct(v))}
                      </td>
                    );
                  })}
                  <td className="p-3">{r.insideInterestCap ? 'Có' : 'Không: vượt trần'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <RowCards
            below="lg"
            label="Lời của chủ hụi theo cách tính hoa hồng"
            items={rows.map((r) => ({
              title: r.schedule,
              rows: [
                { k: 'Hoa hồng cả dây', v: usdc(r.grossFeeUsdc) },
                { k: 'Tổn thất kỳ vọng do bỏ đóng', v: usdc(r.expectedLossUsdc) },
                { k: 'Lời ròng sau rủi ro', v: signed(r.netAfterRiskUsdc, usdc(r.netAfterRiskUsdc)), strong: true },
                ...data.scales.map((sc) => {
                  const v = r.annualReturnPctByHazardScale[scaleKey(sc)] ?? null;
                  return { k: `Mỗi năm trên ký quỹ (${scaleLabel(sc).toLowerCase()})`, v: v === null ? 'không áp dụng' : signed(v, pct(v)), strong: true };
                }),
                { k: 'Trong trần lãi luật', v: r.insideInterestCap ? 'Có' : 'Không: vượt trần' },
              ],
            }))}
          />
          <p className="mt-3 max-w-prose text-muted-foreground">
            Người hốt kỳ đầu thường ròng âm vì nhận sớm, trả bớt thăm; người hốt kỳ cuối ròng dương:{' '}
            {rows.map((r, i) => (
              <span key={r.schedule} className="so-ke">
                {i > 0 ? '; ' : ''}
                {r.schedule}: {usdc(r.firstSeatNetUsdc)} và {usdc(r.lastSeatNetUsdc)}
              </span>
            ))}
            .
          </p>
          {lossRows.length > 0 && (
            <p className="mt-2 max-w-prose font-semibold">
              Với chu kỳ và số người này, {lossRows.length === rows.length ? 'cả ba cách' : lossRows.map((r) => r.schedule).join(', ')} cho chủ hụi lỗ sau rủi ro. Dây tuần ít người gánh rủi ro bảo lãnh nhiều so với hoa hồng thu được.
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** v1.2: the dummy-wallet cases of docs/03 section 7.3, read from `sim/outputs/organizer_sybil.json`. */
export function OrganizerSybil({ data }: { data: LabSybil }) {
  return (
    <section aria-labelledby="vi-ao" className="mt-12">
      <h2 id="vi-ao" className="font-display text-h2 font-bold">
        Chủ hụi dùng ví ảo
      </h2>
      <p className="mt-2 max-w-prose text-lead">
        Dây {data.n} người, mức góp {usdc(data.c, 0)}, giữ lại {fmt(data.alphaBps / 100, 2)}%. Ví ảo là ví của chính chủ hụi, cho hốt sớm rồi bỏ đóng.
      </p>
      <p className="nen-muc mt-4 rounded-xl p-6 font-semibold text-white">
        Cọc 100% chặn được chủ hụi dùng một ví ảo: làm vậy chủ hụi tự lỗ. Dùng nhiều ví ảo thì bị chặn bằng xác thực mỗi người một tài khoản (OTP, attestation), và mọi người thấy trước rủi ro tối đa của mình.
      </p>
      <Table caption="Chủ hụi dùng một hoặc hai ví ảo ở chỉ số bảo chứng 50% và 100%" label="Bảng ví ảo, kéo ngang để xem hết" minWidth="min-w-[48rem]">
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col" className="p-3 font-semibold">Kịch bản</th>
            <th scope="col" className="p-3 text-right font-semibold">Ký quỹ</th>
            <th scope="col" className="p-3 text-right font-semibold">Chủ hụi, gộp các ví ảo</th>
            <th scope="col" className="p-3 text-right font-semibold">Tiền không bù được</th>
            <th scope="col" className="p-3 text-right font-semibold">Người hốt kỳ cuối nhận</th>
          </tr>
        </thead>
        <tbody>
          {data.cases.map((c) => (
            <tr key={c.label} className="dong-ke last:border-b-0">
              <th scope="row" className="p-3 text-left font-semibold">{c.label}</th>
              <td className="so-ke p-3 text-right">{usdc(c.bondUsdc, 0)}</td>
              <td className="so-ke p-3 text-right font-semibold">{c.organizerNetUsdc < 0 ? `lỗ ${usdc(-c.organizerNetUsdc, 6)}` : `lời ${usdc(c.organizerNetUsdc, 6)}`}</td>
              <td className="so-ke p-3 text-right">{usdc(c.uncoveredUsdc, 6)}</td>
              <td className="so-ke p-3 text-right">
                {usdc(c.lastReceiverPayoutUsdc, 6)}
                {c.lastReceiverPayoutUsdc < c.lastReceiverNormalUsdc ? <span className="block text-sm text-muted-foreground">thiếu so với {usdc(c.lastReceiverNormalUsdc, 0)}</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <RowCards
        below="lg"
        label="Chủ hụi dùng ví ảo"
        items={data.cases.map((c) => ({
          title: c.label,
          rows: [
            { k: 'Ký quỹ', v: usdc(c.bondUsdc, 0) },
            { k: 'Chủ hụi, gộp các ví ảo', v: c.organizerNetUsdc < 0 ? `lỗ ${usdc(-c.organizerNetUsdc, 6)}` : `lời ${usdc(c.organizerNetUsdc, 6)}`, strong: true },
            { k: 'Tiền không bù được', v: usdc(c.uncoveredUsdc, 6) },
            { k: 'Người hốt kỳ cuối nhận', v: usdc(c.lastReceiverPayoutUsdc, 6) + (c.lastReceiverPayoutUsdc < c.lastReceiverNormalUsdc ? ` (thiếu so với ${usdc(c.lastReceiverNormalUsdc, 0)})` : '') },
          ],
        }))}
      />
      <p className="mt-3 max-w-prose text-muted-foreground">Kết quả tính tất định từ luật của dây, không có yếu tố ngẫu nhiên. Dòng CI 50% là luật v1.1 cũ, nay Fuji ép 100%.</p>
    </section>
  );
}
