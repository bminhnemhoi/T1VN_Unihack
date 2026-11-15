import { CircleAlert, ShieldCheck } from 'lucide-react';
import type { TermsView } from '@/lib/live/terms';

/**
 * The agreement text (ADR-27) and its hash. For a live circle it says whether the text built from the circle's own
 * parameters hashes to the value the organizer wrote on the chain: a match is the proof that what you read is what
 * you are agreeing to; a mismatch is a red warning, because the text shown would then not be the one that was agreed.
 */
export type TermsSource = 'chain' | 'sample' | 'draft';

export function TermsBox({ view, source, id = 'thoa-thuan-noi-dung' }: { view: TermsView; source: TermsSource; id?: string }) {
  const lines = view.text.split('\n');
  const [title, ...clauses] = lines;
  return (
    <div>
      {view.check === 'match' && (
        <p role="status" className="flex items-center gap-2 font-semibold text-state-ok">
          <ShieldCheck aria-hidden className="size-6 shrink-0" />
          Khớp thỏa thuận: văn bản dưới đây có hash đúng bằng hash chủ hụi đã ghi on-chain.
        </p>
      )}
      {view.check === 'mismatch' && (
        <div role="alert" className="rounded-xl border-2 border-state-bad bg-state-bad/10 p-4">
          <p className="flex items-start gap-2 font-semibold text-state-bad">
            <CircleAlert aria-hidden className="mt-0.5 size-6 shrink-0" />
            Không khớp thỏa thuận. Hash on-chain khác hash của văn bản dựng từ tham số dây này.
          </p>
          <p className="mt-1">Đừng vào dây khi chưa hỏi chủ hụi: văn bản bạn đọc có thể không phải văn bản họ đã đồng ý.</p>
          <p className="so-ke mt-2 break-all text-muted-foreground">Mã trên mạng: {view.onChain}</p>
        </div>
      )}
      {source === 'sample' && <p className="text-muted-foreground">Dữ liệu mẫu: hash dưới đây tính từ văn bản, chưa ghi on-chain.</p>}
      <details className="o-phang mt-3 p-5">
        <summary className="min-h-12 cursor-pointer py-2 font-semibold">Đọc toàn văn thỏa thuận ({clauses.length} điều)</summary>
        <div id={id} className="mt-3">
          <p className="font-semibold">{title}</p>
          <ul className="mt-2 space-y-2">
            {clauses.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      </details>
      <p className="mt-3 text-muted-foreground">{source === 'chain' ? 'Hash của văn bản trên:' : 'Hash của đúng văn bản trên (sẽ được ghi on-chain khi tạo dây thật, để không ai sửa lén được):'}</p>
      <p className="so-ke mt-1 break-all rounded-lg bg-secondary p-3" data-testid="agreement-hash">
        {view.hash}
      </p>
    </div>
  );
}
