'use client';
/**
 * Organizer-led settlement (B28). When a round's reveal window closes the circle waits for the organizer: the
 * organizer sees who wins, what they receive and who will come up short, may wait for a short member to top up, then
 * settles (which also opens the next round). Members see "waiting for the organizer". The keeper, and members, may
 * settle in the organizer's place `organizerSettleWaitSec` after the deadline, so a missing organizer can delay a round
 * but never hold the pot. The contract itself lets anyone settle at the deadline (docs/03 section 6.5).
 */
import { useQuery } from '@tanstack/react-query';
import { erc20Abi } from 'viem';
import { organizerSettleWaitSec } from 'config';
import { formatUsdcNumber, type RoundView } from 'sdk';
import { TxButton, type StepTx } from '@/components/app/tx';
import { chainKey } from '@/lib/chain/hooks';
import { useChain } from '@/lib/chain/provider';
import type { SampleCircleData } from '@/lib/sample-circles';

type Address = `0x${string}`;
const f = (u: bigint) => formatUsdcNumber(u);
const clock = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const mm = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
  const ss = String(t % 60).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

export interface Payer {
  address: Address;
  name: string;
  due: bigint;
}

/** Who pays this round and how much, given the winner and the winning bid (frozen members are not pulled). */
export function payersOf(c: SampleCircleData, winner: string | undefined, bid: bigint): Payer[] {
  const v = c.live?.view;
  if (!v) return [];
  return v.members
    .filter((m) => m.status !== 'frozen' && m.address.toLowerCase() !== winner?.toLowerCase())
    .map((m) => ({
      address: m.address,
      name: c.seats.find((s) => s.address?.toLowerCase() === m.address.toLowerCase())?.name ?? `M${m.joinIndex + 1}`,
      due: m.status === 'live' ? c.terms.c - bid : c.terms.c,
    }));
}

/** Winner when nobody revealed in a bidding circle: the live member with the lowest join index, bid 0 (docs/03 section 6.4). */
export function defaultWinner(c: SampleCircleData): string | undefined {
  return c.live?.view.members.filter((m) => m.status === 'live').sort((a, b) => a.joinIndex - b.joinIndex)[0]?.address;
}

function useReadiness(payers: Payer[], spender: Address | undefined, enabled: boolean) {
  const chain = useChain();
  return useQuery({
    queryKey: chainKey(chain?.chainId ?? 0, 'readiness', spender?.toLowerCase(), payers.map((p) => p.address.toLowerCase()).join(',')),
    enabled: Boolean(chain && spender && enabled && payers.length > 0),
    refetchInterval: chain ? Math.max(chain.pollMs, 8_000) : false,
    placeholderData: (prev) => prev,
    queryFn: async () =>
      Promise.all(
        payers.map(async (p) => {
          const [bal, allow] = await Promise.all([
            chain!.client.readContract({ address: chain!.usdc, abi: erc20Abi, functionName: 'balanceOf', args: [p.address] }),
            chain!.client.readContract({ address: chain!.usdc, abi: erc20Abi, functionName: 'allowance', args: [p.address, spender!] }),
          ]);
          const can = bal < allow ? bal : allow;
          return { ...p, can, short: can < p.due ? p.due - can : 0n };
        }),
      ),
  });
}

export function SettleDesk({
  c,
  k,
  rv,
  chainNowSec,
  t,
  onSettle,
  winner,
  winnerName,
  bid,
  payout,
}: {
  c: SampleCircleData;
  k: number;
  rv: RoundView;
  chainNowSec: number;
  t: StepTx;
  onSettle: (retry: boolean) => void;
  winner: string | undefined;
  winnerName: string;
  bid: bigint;
  /** What the winner receives if nobody is short (from the round quote). */
  payout?: bigint;
}) {
  const live = c.live!;
  const n = Number(c.terms.n);
  const settleOpen = chainNowSec >= rv.deadline;
  // An organizer who also holds a seat gets no settling turn: they could pick the moment a rival is short (audit B28 L-01).
  const orgSeated = live.view.members.some((m) => m.address.toLowerCase() === live.view.organizer.toLowerCase());
  const fallbackAt = rv.deadline + (orgSeated ? 0 : organizerSettleWaitSec(live.view.params.roundDuration));
  const fallbackOpen = chainNowSec >= fallbackAt;
  const organizer = c.viewerIsOrganizer;
  const payers = payersOf(c, winner, bid);
  const ready = useReadiness(payers, live.address as Address, settleOpen && organizer);
  const shortOnes = (ready.data ?? []).filter((p) => p.short > 0n);
  const label = k < n ? `Khui kỳ ${k}, mở kỳ ${k + 1}` : `Khui kỳ cuối (kỳ ${k})`;

  if (!settleOpen) {
    return (
      <>
        <div className="autoSettle" role="status">
          <span>Hết giờ mở thăm sau {clock(rv.deadline - chainNowSec)}; sau đó {organizer ? 'bạn' : 'chủ hụi'} khui kỳ {k}.</span>
        </div>
        {organizer && <TxButton t={t} tone="ink" label={label} retryLabel={`Gửi lại lệnh khui kỳ ${k}`} onRun={onSettle} disabled />}
      </>
    );
  }

  if (organizer) {
    return (
      <div className="settleDesk" data-testid="settle-desk">
        <h4>Bàn khui kỳ {k}</h4>
        <p>
          <b>{winnerName}</b> hốt{c.terms.mode === 'bidding' ? ` với thăm ${f(bid)} USDC` : ''}
          {payout !== undefined && shortOnes.length === 0 ? `, nhận ${f(payout)} USDC` : ''}.
        </p>
        {ready.data ? (
          <ul className="readiness" aria-label="Ai đủ tiền cho kỳ này">
            {ready.data.map((p) => (
              <li key={p.address} className={p.short > 0n ? 'short' : 'ok'}>
                <span>{p.name}</span>
                <span>{p.short > 0n ? `thiếu ${f(p.short)} / ${f(p.due)} USDC` : `đủ ${f(p.due)} USDC`}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Đang kiểm ví từng người…</p>
        )}
        {shortOnes.length > 0 && (
          <p className="deskWarn">
            {shortOnes.map((p) => p.name).join(', ')} chưa đủ tiền. Bạn có thể chờ họ nạp; khui lúc này thì phần thiếu được bù theo thác (tiền giữ lại, ký quỹ, quỹ dự phòng) và họ có ân hạn để trả.
          </p>
        )}
        <TxButton t={t} tone="lime" label={label} retryLabel={`Gửi lại lệnh khui kỳ ${k}`} onRun={onSettle} />
        <p className="muted">
          {fallbackOpen
            ? 'Đã quá lượt của bạn: keeper hoặc thành viên có thể khui thay bất cứ lúc nào.'
            : `Bạn còn ${clock(fallbackAt - chainNowSec)} để khui; sau đó keeper khui thay để dây không bị treo.`}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="autoSettle" role="status">
        <span className="spin" aria-hidden="true" />
        <span>
          Chờ chủ hụi khui kỳ {k}.{' '}
          {fallbackOpen ? 'Chủ hụi chưa khui: keeper sẽ khui thay trong giây lát.' : `Nếu chủ hụi chưa khui, keeper khui thay sau ${clock(fallbackAt - chainNowSec)}.`}
        </span>
      </div>
      {fallbackOpen && c.viewer >= 0 && <TxButton t={t} tone="ink" label="Chủ hụi chưa khui · Khui thay" retryLabel={`Gửi lại lệnh khui kỳ ${k}`} onRun={onSettle} />}
    </>
  );
}
