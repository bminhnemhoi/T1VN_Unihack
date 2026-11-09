'use client';

import { Bot, Send, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dialog } from 'radix-ui';
import { useRef, useState, type ChangeEvent } from 'react';
import { CopilotCalc } from '@/components/copilot/CopilotCalc';
import { draftFromStorage, readNdjson, type StreamEvent } from '@/components/copilot/stream';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TOGGLE_ON } from '@/lib/utils';

const DISCLAIMER = 'Đây là thông tin tham khảo, không phải tư vấn tài chính hay pháp lý.';
const SUGGESTIONS = [
  'Ký quỹ bao nhiêu để bảo chứng 100%?',
  'Trần tiền thăm từng kỳ là bao nhiêu?',
  'Khi nào tôi phải thông báo cho UBND?',
  'Dây 10 người giữ lại 20% thì rủi ro ra sao?',
];

interface Turn {
  role: 'user' | 'assistant';
  text: string;
  tools?: { name: string; result: unknown }[];
  label?: string;
  refused?: boolean;
  suggestion?: Record<string, string>;
  failed?: boolean;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const usd = (v: unknown): string => (typeof v === 'string' || typeof v === 'number' ? `${String(v).replace('.', ',')} USDC` : '-');

/** Shows what a deterministic tool returned, so the numbers are visible next to the AI's words. */
function ToolResult({ name, result }: { name: string; result: unknown }) {
  if (!isObj(result)) return null;
  if (name === 'max_bid_table' && Array.isArray(result.rows)) {
    return (
      <table className="so-ke mt-2 w-full text-base">
        <caption className="sr-only">Trần thăm từng kỳ</caption>
        <tbody>
          {result.rows.filter(isObj).map((r, i) => (
            <tr key={i} className="dong-ke last:border-b-0">
              <th scope="row" className="py-1 text-left font-normal">Kỳ {String(r.k)}</th>
              <td className="py-1 text-right font-semibold">{usd(r.maxBid)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (name === 'recommend_bond') {
    return (
      <dl className="so-ke mt-2 text-base">
        {[
          ['Rủi ro đỉnh', usd(result.maxExposure)],
          ['Ký quỹ cần', usd(result.bond)],
          ['Bảo chứng', `${String(result.guaranteedCoveragePercent ?? '-')}%`],
        ].map(([k, v]) => (
          <div key={k} className="dong-ke flex justify-between py-1 last:border-b-0">
            <dt>{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
    );
  }
  if (name === 'compute_exposure' && Array.isArray(result.exposure)) {
    return <p className="so-ke mt-2 text-base">Rủi ro đỉnh {usd(result.maxExposure)} ở kỳ {String(result.peakRound)}.</p>;
  }
  if (name === 'explain_rule' && typeof result.citation === 'string') {
    return <p className="mt-2 text-base text-muted-foreground">Nguồn: {result.citation}</p>;
  }
  if (name === 'draft_ubnd_notice') {
    return (
      <p className="mt-2 text-base">
        <Link href="/thong-bao-ubnd" className="font-semibold text-primary underline underline-offset-4">
          Mở bản nháp thông báo UBND để tự điền
        </Link>
      </p>
    );
  }
  return null;
}

/** S13: the organizer assistant. A side drawer on desktop, a bottom sheet on phones. It only reads and computes; it never signs or moves money. */
export function CopilotDrawer() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'ask' | 'calc'>('ask');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const onForm = pathname.startsWith('/circles/new');

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setText('');
    setBusy(true);
    setStatus('Đang gửi câu hỏi...');
    const history = [...turns, { role: 'user' as const, text: q }];
    setTurns([...history, { role: 'assistant', text: '' }]);
    const patch = (fn: (t: Turn) => Turn) => setTurns((all) => all.map((t, i) => (i === all.length - 1 ? fn(t) : t)));
    const failWith = (message: string) => {
      patch((t) => ({ ...t, text: message, failed: true }));
      setTab('ask');
    };
    try {
      const draft = draftFromStorage();
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: history.slice(-10).map((t) => ({ role: t.role, content: t.text.slice(0, 2000) })),
          ...(draft ? { draft } : {}),
        }),
      });
      if (!res.ok || !res.body) {
        let message = 'Trợ lý tạm nghỉ. Bạn dùng tab Máy tính, tạo dây vẫn chạy bình thường.';
        try {
          const j: unknown = await res.json();
          if (isObj(j) && isObj(j.error) && typeof j.error.message === 'string') message = j.error.message;
        } catch {
          /* keep the default message */
        }
        failWith(message);
        return;
      }
      await readNdjson(res.body, (e: StreamEvent) => {
        if (e.type === 'status') setStatus(e.text);
        else if (e.type === 'tool') patch((t) => ({ ...t, tools: [...(t.tools ?? []), { name: e.name, result: e.result }] }));
        else if (e.type === 'answer')
          patch((t) => ({ ...t, text: e.answer.answer, label: e.label, refused: e.answer.refused === true, ...(e.answer.formSuggestion ? { suggestion: e.answer.formSuggestion } : {}) }));
        else failWith(e.message);
      });
    } catch {
      failWith('Không kết nối được trợ lý. Kiểm tra mạng rồi thử lại, hoặc dùng tab Máy tính.');
    } finally {
      setBusy(false);
      setStatus('');
      requestAnimationFrame(() => end.current?.scrollIntoView({ block: 'end' }));
    }
  };

  const fill = (t: Turn) => {
    const bond = t.tools?.flatMap((x) => (x.name === 'recommend_bond' && isObj(x.result) && typeof x.result.bond === 'string' ? [x.result.bond] : []))[0];
    const detail = { ...(bond ? { bondUsdc: bond } : {}), ...(t.suggestion ?? {}) };
    window.dispatchEvent(new CustomEvent('huisafe:fill-form', { detail }));
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button type="button" variant="outline" className="min-h-12">
          <Bot aria-hidden className="size-5" /> Trợ lý
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-muc-dem/50 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          aria-describedby="tro-ly-mo-ta"
          className="fixed inset-x-0 bottom-0 z-50 flex h-[88vh] flex-col rounded-t-2xl bg-card shadow-2xl outline-none md:inset-y-0 md:right-0 md:left-auto md:h-auto md:w-[30rem] md:rounded-none"
        >
          <header className="flex items-start justify-between gap-3 border-b border-border p-4">
            <div>
              <Dialog.Title className="font-display text-h3 font-bold">Trợ lý AI cho chủ hụi</Dialog.Title>
              <Dialog.Description id="tro-ly-mo-ta" className="text-base text-muted-foreground">
                Chỉ đọc và tính, không ký, không chuyển tiền. Số liệu do hàm tính của HụiSafe tạo; lời giải thích do AI viết.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Đóng trợ lý">
                <X aria-hidden className="size-5" />
              </Button>
            </Dialog.Close>
          </header>

          <div className="border-b border-border px-4 py-2">
            <ToggleGroup type="single" variant="outline" value={tab} onValueChange={(v) => v && setTab(v as 'ask' | 'calc')} aria-label="Chế độ trợ lý">
              <ToggleGroupItem value="ask" className={TOGGLE_ON}>Hỏi trợ lý</ToggleGroupItem>
              <ToggleGroupItem value="calc" className={TOGGLE_ON}>Máy tính</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === 'calc' ? (
              <CopilotCalc />
            ) : (
              <>
                {turns.length === 0 && (
                  <div>
                    <p className="text-lead">Hỏi về ký quỹ, trần thăm, rủi ro hay luật Nghị định 19. Chọn một câu hoặc tự gõ.</p>
                    <ul className="mt-3 flex flex-col gap-2">
                      {SUGGESTIONS.map((s) => (
                        <li key={s}>
                          <Button type="button" variant="outline" className="h-auto min-h-12 w-full justify-start px-4 py-2 text-left" onClick={() => send(s)}>
                            {s}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <ol className="space-y-4" aria-label="Cuộc trò chuyện">
                  {turns.map((t, i) => (
                    <li key={i} className={t.role === 'user' ? 'ml-8 rounded-xl bg-secondary p-3' : 'rounded-xl border border-border p-3'}>
                      <p className="text-sm font-semibold text-muted-foreground">{t.role === 'user' ? 'Bạn' : 'Trợ lý AI'}</p>
                      {t.text === '' && busy && i === turns.length - 1 ? (
                        <p role="status" className="text-muted-foreground">{status || 'Đang trả lời...'}</p>
                      ) : (
                        <p className={t.failed ? 'font-semibold text-destructive' : 'whitespace-pre-line'}>{t.text}</p>
                      )}
                      {t.tools?.map((x, j) => <ToolResult key={j} name={x.name} result={x.result} />)}
                      {t.label && <p className="mt-2 text-sm text-muted-foreground">{t.label}</p>}
                      {t.role === 'assistant' && t.text && !t.failed && !t.text.includes(DISCLAIMER) && <p className="mt-1 text-sm text-muted-foreground">{DISCLAIMER}</p>}
                      {t.tools?.some((x) => x.name === 'recommend_bond') || t.suggestion ? (
                        onForm ? (
                          <Button type="button" size="sm" className="mt-2" onClick={() => fill(t)}>
                            Điền vào form
                          </Button>
                        ) : (
                          <Button asChild size="sm" variant="outline" className="mt-2">
                            <Link href="/circles/new?buoc=2" onClick={() => setOpen(false)}>Mở form tạo dây để điền</Link>
                          </Button>
                        )
                      ) : null}
                    </li>
                  ))}
                </ol>
                <div ref={end} />
              </>
            )}
          </div>

          {tab === 'ask' && (
            <form
              className="border-t border-border p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void send(text);
              }}
            >
              <label htmlFor="cau-hoi" className="sr-only">
                Câu hỏi cho trợ lý
              </label>
              <div className="flex items-end gap-2">
                <Textarea id="cau-hoi" value={text} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)} rows={2} maxLength={2000} placeholder="Gõ câu hỏi của bạn" className="min-h-14 flex-1 text-lg" />
                <Button type="submit" size="icon-lg" disabled={busy || text.trim() === ''} aria-label="Gửi câu hỏi">
                  <Send aria-hidden className="size-5" />
                </Button>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Đừng gõ họ tên, số điện thoại hay địa chỉ ví. {DISCLAIMER}</p>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
