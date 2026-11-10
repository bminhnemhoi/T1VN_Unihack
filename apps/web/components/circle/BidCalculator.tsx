'use client';

import { useState } from 'react';
import { formatBps, formatUsdc, parseUsdc } from 'sdk';
import { LedgerList } from '@/components/LedgerList';
import { Input } from '@/components/ui/input';
import { bidQuote, roomOf, type Terms } from '@/lib/hui-calc';

interface Past {
  k: number;
  winner: string;
  bid: bigint;
}

/**
 * Bid calculator (decided 09/11): type a bid, see what you hold now, what is held back, what you pay in interest and
 * commission, and what that equals as a monthly rate (by the cap's own yardstick, docs/03 section 2.4). Numbers only: it never
 * says what to bid. Past winning bids sit beside it so the number has context.
 * The table is the cost breakdown of ADR-28 (vector V5): cash now, cash later, interest paid to the others, commission,
 * reserve. The ceiling is the one the contract enforces (law ceiling minus the organizer's share, docs/03 section 2.7).
 * `bidderIsOrganizer`: the person looking holds the organizer's own seat, so winning this round carries no commission.
 */
export function BidCalculator({ terms, round, past, bidderIsOrganizer = false }: { terms: Terms; round: number; past: Past[]; bidderIsOrganizer?: boolean }) {
  const [text, setText] = useState('2');
  const bid = parseUsdc(text);
  const q = bid === undefined ? undefined : bidQuote(terms, round, bid, bidderIsOrganizer);
  const shared = (terms.shareBps ?? 0n) > 0n && terms.feeBps > 0n;
  const room = roomOf(terms, round);
  const problem =
    bid === undefined
      ? 'Nhập thăm bằng số, ví dụ 2 hoặc 1,5.'
      : q?.problem === 'over-cap'
        ? `Thăm vượt trần kỳ này (${formatUsdc(q.cap)}). Thăm vượt trần không mở được và mất cọc.`
        : q?.problem === 'at-least-c'
          ? 'Thăm phải nhỏ hơn mức góp mỗi kỳ.'
          : undefined;
  const ok = q && !problem;
  return (
    <section aria-labelledby="may-tinh-tieu-de" className="o-phang p-6">
      <h3 id="may-tinh-tieu-de" className="font-display text-h3 font-bold">
        Máy tính thăm
      </h3>
      <p className="mt-1 text-muted-foreground">Gõ thử một số thăm để xem nó nghĩa là gì, trước khi niêm phong. Máy tính chỉ đưa số, không khuyên bạn nên thăm bao nhiêu.</p>

      <div className="mt-4">
        <label htmlFor="thu-tham" className="font-semibold">
          Thử thăm kỳ {round}
        </label>
        <div className="mt-1 flex items-center gap-2">
          <Input
            id="thu-tham"
            inputMode="decimal"
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-invalid={problem ? true : undefined}
            aria-describedby="thu-tham-ghi-chu"
            className="so-ke max-w-40 text-right text-lg"
          />
          <span className="text-lg">USDC</span>
        </div>
        <p id="thu-tham-ghi-chu" className={problem ? 'mt-1 font-semibold text-state-bad' : 'mt-1 text-muted-foreground'}>
          {problem ?? `Trần thăm kỳ ${round} là ${formatUsdc(q?.cap ?? 0n)}${shared ? ` (đã trừ phần hoa hồng; trần theo luật ${formatUsdc(q?.statutoryCap ?? 0n)})` : ''}.`}
        </p>
      </div>

      {ok && (
        <LedgerList
          className="mt-3"
          items={[
            { label: 'Bạn cầm ngay nếu thắng', value: formatUsdc(q.payout) },
            { label: 'Tiền giữ lại, nhận dần', value: `${formatUsdc(q.holdback)} (nhả ${formatUsdc(q.releaseEach)} mỗi kỳ bạn đóng đúng hạn)` },
            { label: `Lãi thăm bạn trả cho ${q.livePayers} người`, value: `${formatUsdc(q.interest)} (${formatUsdc(q.bid)} x ${q.livePayers})` },
            {
              label: 'Hoa hồng chủ hụi kỳ này',
              value: bidderIsOrganizer ? 'Không thu (kỳ chủ hụi tự hốt)' : formatUsdc(q.fee),
            },
            { label: 'Trích vào quỹ dự phòng', value: `${formatUsdc(q.premium)} (cuối dây chia lại theo thưởng đúng hạn)` },
            ...(shared
              ? [{ label: 'Lãi thăm cộng hoa hồng so với trần lãi luật', value: `${formatUsdc(q.interest + q.fee)} trên ${formatUsdc(room)}` }]
              : []),
            { label: `Bạn còn góp ${terms.n - BigInt(round)} kỳ sau`, value: formatUsdc(q.laterPayments) },
            { label: 'Giống vay lãi (chỉ lãi thăm)', value: q.interestRateBpsPerMonth === undefined ? 'Không có lãi' : `${formatBps(q.interestRateBpsPerMonth)} mỗi tháng` },
            { label: 'Giống vay lãi (gồm hoa hồng và quỹ)', value: q.allInRateBpsPerMonth === undefined ? 'Không có lãi' : `${formatBps(q.allInRateBpsPerMonth)} mỗi tháng` },
          ]}
        />
      )}
      <p className="mt-3 text-muted-foreground">
        Tỷ lệ theo cách tính trần lãi 20%/năm của dây (cách hiểu của HụiSafe, cần luật sư xác nhận). Nhiều người có thể cùng đặt đúng mức trần; khi bằng thăm, người ít lần trễ hơn thắng, rồi ai nộp trước thắng.
      </p>

      <h4 className="mt-5 font-semibold">Thăm thắng các kỳ trước</h4>
      {past.length === 0 ? (
        <p className="mt-1 text-muted-foreground">Chưa có kỳ nào được chi.</p>
      ) : (
        <ul className="mt-1">
          {past.map((p) => {
            const pq = bidQuote(terms, p.k, p.bid);
            return (
              <li key={p.k} className="dong-ke flex flex-wrap items-baseline justify-between gap-x-3 py-2 last:border-b-0">
                <span>
                  Kỳ {p.k}: {p.winner}
                </span>
                <span className="so-ke font-semibold">
                  {formatUsdc(p.bid)} <span className="font-normal text-muted-foreground">({pq.interestRateBpsPerMonth === undefined ? 'không lãi' : `${formatBps(pq.interestRateBpsPerMonth)}/tháng`})</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
