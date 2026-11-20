'use client';
/**
 * "Kỳ này của bạn" (B28): what the current round will pull from the viewer's wallet, what the wallet holds and how much
 * the circle may still pull. Shown to a member while a round is open, so nobody learns they were short only when the
 * round is settled. Read only: it sends nothing.
 */
import { useQuery } from '@tanstack/react-query';
import { erc20Abi } from 'viem';
import { formatUsdcNumber } from 'sdk';
import { chainKey } from '@/lib/chain/hooks';
import { useChain } from '@/lib/chain/provider';
import { useWalletBalance } from '@/lib/live/useWalletBalance';
import type { SampleCircleData } from '@/lib/sample-circles';

type Address = `0x${string}`;
const f = (u: bigint) => formatUsdcNumber(u);

function useAllowance(owner: Address | undefined, spender: Address | undefined) {
  const chain = useChain();
  return useQuery({
    queryKey: chainKey(chain?.chainId ?? 0, 'allowance', owner?.toLowerCase(), spender?.toLowerCase()),
    enabled: Boolean(chain && owner && spender),
    refetchInterval: chain?.pollMs,
    placeholderData: (prev) => prev,
    queryFn: () => chain!.client.readContract({ address: chain!.usdc, abi: erc20Abi, functionName: 'allowance', args: [owner!, spender!] }),
  });
}

/** Most the round can pull from this member: 0 for the round's taker in a fixed circle, C for one who already received, else at most C. */
export function roundDue(c: SampleCircleData, k: number): { due: bigint; upTo: boolean; taker: boolean } | undefined {
  const me = c.live?.view.members.find((m) => m.address.toLowerCase() === c.live?.viewerAddress?.toLowerCase());
  if (!me || me.status === 'frozen' || me.status === 'defaultedDead') return undefined;
  const C = c.terms.c;
  if (me.status === 'dead') return { due: C, upTo: false, taker: false };
  if (c.terms.mode === 'fixed' && (c.winnerByRound[k - 1] ?? k - 1) === c.viewer) return { due: 0n, upTo: false, taker: true };
  return { due: C, upTo: c.terms.mode === 'bidding', taker: false };
}

export function MyRoundCard({ c, k }: { c: SampleCircleData; k: number }) {
  const live = c.live;
  const owner = live?.viewerAddress as Address | undefined;
  const bal = useWalletBalance(owner);
  const allow = useAllowance(owner, live?.address as Address | undefined);
  const d = live && c.viewer >= 0 ? roundDue(c, k) : undefined;
  if (!d || bal.data === undefined || allow.data === undefined) return null;
  if (d.taker) {
    return (
      <div className="roleBox myRound" data-testid="my-round" role="status">
        <h3>Kỳ {k} của bạn: bạn hốt</h3>
        <p>Kỳ này bạn không phải góp. Hợp đồng chi hũ vào ví bạn khi chủ hụi khui kỳ.</p>
      </div>
    );
  }
  const shortWallet = bal.data.usdc < d.due;
  const shortAllow = allow.data < d.due;
  return (
    <div className={`roleBox myRound${shortWallet || shortAllow ? ' warn' : ''}`} data-testid="my-round" role="status">
      <h3>
        Kỳ {k} của bạn: {d.upTo ? 'tối đa ' : ''}
        {f(d.due)} USDC
      </h3>
      <p>
        Ví đang có <b>{f(bal.data.usdc)} USDC</b> · hợp đồng còn được trích <b>{f(allow.data)} USDC</b>
        {d.upTo ? '. Thắng thăm thì kỳ này bạn không phải góp; không thắng thì góp mức góp trừ tiền thăm của người thắng.' : '.'}
      </p>
      {shortWallet && (
        <p className="myRoundWarn">
          Ví còn thiếu {f(d.due - bal.data.usdc)} USDC. Nạp thêm trước khi chủ hụi khui kỳ để khỏi bị ghi thiếu; nhận USDC thử nghiệm tại faucet.circle.com.
        </p>
      )}
      {!shortWallet && shortAllow && (
        <p className="myRoundWarn">Quyền trích không đủ cho kỳ này (có thể bạn đã thu hồi). Khi khui kỳ, phần thiếu sẽ được bù và bạn trả lại trong ân hạn.</p>
      )}
    </div>
  );
}
