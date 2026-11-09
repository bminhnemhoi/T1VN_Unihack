import Link from 'next/link';
import { formatBps, formatUsdc, huiMath } from 'sdk';
import { CascadeBar } from '@/components/circle/CascadeBar';
import { CirclePageHead } from '@/components/circle/CirclePageHead';
import { RiskTable } from '@/components/circle/RiskTable';
import { simulateDefaults } from '@/lib/hui-calc';
import { getSampleCircle, settledRound, type CircleId } from '@/lib/sample-circles';

/** S09: the cascade holdback, bond, reserve, uncovered, for every shortfall so far, plus what happens next if the defaulter never pays. */
export function CoverageView({ id }: { id: CircleId }) {
  const c = getSampleCircle(id);
  const t = c.terms;
  const total = c.shortfalls.reduce(
    (a, s) => ({ holdback: a.holdback + s.fromHoldback, bond: a.bond + s.fromBond, reserve: a.reserve + s.fromReserve, uncovered: a.uncovered + s.uncovered }),
    { holdback: 0n, bond: 0n, reserve: 0n, uncovered: 0n },
  );
  const index = huiMath.coverageIndexBps(t.alphaBps, c.bondRemaining, c.reserve, t.n, t.c);
  const defaulted = c.shortfalls.filter((s) => s.status === 'defaulted');
  const claims = c.shortfalls.filter((s) => s.uncovered > 0n);

  // Defaulted receivers keep failing in every later round: replay the circle to see the bond drain (docs/03 section 8 branch B).
  const projection =
    defaulted.length > 0
      ? simulateDefaults(t, c.bond, (seat) => {
          const hit = defaulted.find((s) => c.winnerByRound[seat - 1] === s.member);
          return hit?.round;
        })
      : undefined;

  return (
    <main id="noi-dung" className="mx-auto max-w-6xl px-4 py-10">
      <CirclePageHead circle={c} title="Bảo chứng">
        Khi có người không góp được, dây bù lần lượt từ tiền giữ lại của chính người đó, ký quỹ của chủ hụi, quỹ dự phòng. Phần cuối cùng chưa bù được là khoản đòi công khai.
      </CirclePageHead>

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_3fr] lg:items-start [&>*]:min-w-0">
        <section aria-labelledby="tom-tat-bc" className="nen-muc rounded-xl p-6 md:p-8">
          <h2 id="tom-tat-bc" className="font-display text-h2 font-bold">
            Ký quỹ còn {formatUsdc(c.bondRemaining)} trên {formatUsdc(c.bond)}
          </h2>
          <p className="so-ke mt-3 text-lead text-[#dfe5f0]">
            Chỉ số bảo chứng hiện tại <strong className="text-white">{formatBps(index)}</strong>, tính cả quỹ dự phòng {formatUsdc(c.reserve)}.
          </p>
          <p className="mt-2 text-[#c9d2e0]">
            Chỉ số 100% nghĩa là ký quỹ chịu được cú sốc lớn nhất: mọi người đã hốt cùng bỏ đóng một lúc. Bỏ đóng lần lượt qua nhiều kỳ có thể vượt ký quỹ.
          </p>
        </section>

        <section aria-labelledby="thac" className="to-giay p-6">
          <h2 id="thac" className="font-display text-h2 font-bold">
            Thác bù của các khoản thiếu
          </h2>
          {c.shortfalls.length === 0 ? (
            <p className="mt-2 text-lead text-muted-foreground">Chưa có khoản thiếu nào, nên chưa cần bù. Ký quỹ còn nguyên.</p>
          ) : (
            <div className="mt-4 space-y-6">
              {c.shortfalls.map((s) => (
                <CascadeBar
                  key={`${s.round}-${s.member}`}
                  title={`Kỳ ${s.round}: ${c.seats[s.member]!.name} thiếu ${formatUsdc(s.amount)}`}
                  parts={{ holdback: s.fromHoldback, bond: s.fromBond, reserve: s.fromReserve, uncovered: s.uncovered }}
                />
              ))}
              {c.shortfalls.length > 1 && <CascadeBar title="Tổng cộng" parts={total} />}
            </div>
          )}
        </section>
      </div>

      {defaulted.length > 0 && (
        <section aria-labelledby="ky-sau" className="o-phang mt-8 p-6">
          <h2 id="ky-sau" className="font-display text-h2 font-bold">
            Các kỳ còn lại nếu {c.seats[defaulted[0]!.member]!.name} không trả nữa
          </h2>
          <p className="mt-1 max-w-prose text-muted-foreground">
            Phần góp của người vỡ nợ tiếp tục được thử trích mỗi kỳ; thiếu thì lấy từ ký quỹ. Người hốt các kỳ sau vẫn nhận đủ.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[24rem] text-base">
              <caption className="sr-only">Ký quỹ còn lại sau từng kỳ nếu người vỡ nợ không trả</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="p-3 font-semibold">Sau kỳ</th>
                  <th scope="col" className="p-3 text-right font-semibold">Khoản thiếu của kỳ</th>
                  <th scope="col" className="p-3 text-right font-semibold">Ký quỹ còn lại</th>
                  <th scope="col" className="p-3 text-right font-semibold">Chưa bù được</th>
                </tr>
              </thead>
              <tbody>
                {projection!.bondAfter.map((b, i) => (
                  <tr key={i} className="dong-ke last:border-b-0">
                    <th scope="row" className="p-3 text-left font-semibold">
                      Kỳ {i + 1}
                      {i + 1 > c.settled && <span className="ml-2 font-normal text-muted-foreground">(dự kiến)</span>}
                    </th>
                    <td className="so-ke p-3 text-right">{formatUsdc(projection!.shortfall[i]!)}</td>
                    <td className="so-ke p-3 text-right">{formatUsdc(b)}</td>
                    <td className="so-ke p-3 text-right">{formatUsdc(projection!.uncovered[i]!)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="so-ke mt-3">
            Tiền công kỳ {defaulted[0]!.round} ({formatUsdc(settledRound(c, defaulted[0]!.round).fee)}) chuyển vào quỹ dự phòng vì có người vỡ nợ ở kỳ đó.
          </p>
        </section>
      )}

      <section aria-labelledby="doi" className="o-phang mt-8 p-6">
        <h2 id="doi" className="font-display text-h2 font-bold">
          Khoản đòi công khai
        </h2>
        {claims.length === 0 ? (
          <p className="mt-2 text-lead text-muted-foreground">Không có. Mọi khoản thiếu đã được bù đủ.</p>
        ) : (
          <ul className="mt-2">
            {claims.map((s) => (
              <li key={`${s.round}-${s.member}`} className="dong-ke flex flex-wrap justify-between gap-2 py-2.5 last:border-b-0">
                <span>Ví {c.seats[s.member]!.name}, kỳ {s.round}</span>
                <span className="so-ke font-semibold">{formatUsdc(s.uncovered)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-muted-foreground">Chỉ ghi địa chỉ ví và số tiền, không có tên thật. Người vỡ nợ trả lại bằng nút &quot;Trả nợ&quot; khi dây còn chạy.</p>
      </section>

      <RiskTable terms={t} bond={c.bond} highlight={c.state === 'active' ? c.viewer + 1 : undefined} className="mt-10" />

      <p className="mt-8 text-muted-foreground">
        Từng khoản thiếu và hạn trả nằm ở{' '}
        <Link href={`/circles/${id}/thieu`} className="font-semibold text-primary underline underline-offset-4">
          mục Khoản thiếu
        </Link>
        .
      </p>
    </main>
  );
}
