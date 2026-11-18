'use client';

import { Bot, RotateCcw, Send, X } from 'lucide-react';
import Link from 'next/link';
import { Dialog } from 'radix-ui';
import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
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
              <td className="nhan-so py-1 text-right font-semibold">{usd(r.maxBid)}</td>
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
            <dd className="nhan-so font-semibold">{v}</dd>
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
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'ask' | 'calc'>('ask');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const end = useRef<HTMLDivElement>(null);

  const send = async (question: string, retryLast = false) => {
    const q = question.trim();
    if (!q || busy) return;
    if (!retryLast) setText('');
    setBusy(true);
    setStatus('Đang gửi câu hỏi...');
    const history = retryLast ? turns.slice(0, -1) : [...turns, { role: 'user' as const, text: q }];
    setTurns([...history, { role: 'assistant', text: '' }]);
    const patch = (fn: (t: Turn) => Turn) => setTurns((all) => all.map((t, i) => (i === all.length - 1 ? fn(t) : t)));
    const failWith = (message: string) => {
      patch((t) => ({ ...t, text: message, failed: true }));
      setTab('ask');
    };
    const payload = () => {
      const draft = draftFromStorage();
      return JSON.stringify({
        messages: history.slice(-10).map((t) => ({ role: t.role, content: t.text.slice(0, 2000) })),
        ...(draft ? { draft } : {}),
      });
    };
    try {
      const maxAttempts = 3;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (attempt > 0) {
          setStatus('Mạng vừa đổi nhịp, đang kết nối lại...');
          patch((t) => ({ ...t, tools: undefined, failed: undefined, text: '' }));
          await new Promise((r) => setTimeout(r, attempt === 1 ? 400 : 800));
        }
        let terminal = false;
        try {
          const res = await fetch('/api/copilot', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: payload(),
          });
          if (!res.ok || !res.body) {
            let code = '';
            let message = 'Trợ lý tạm nghỉ. Bạn dùng tab Máy tính, tạo dây vẫn chạy bình thường.';
            try {
              const j: unknown = await res.json();
              if (isObj(j) && isObj(j.error)) {
                if (typeof j.error.code === 'string') code = j.error.code;
                if (typeof j.error.message === 'string') message = j.error.message;
              }
            } catch {
              /* keep the default message */
            }
            if ((res.status === 502 || res.status === 504) && code === '' && attempt < maxAttempts - 1) continue;
            failWith(message);
            break;
          }
          await readNdjson(res.body, (e: StreamEvent) => {
            if (e.type === 'status') setStatus(e.text);
            else if (e.type === 'tool') patch((t) => ({ ...t, tools: [...(t.tools ?? []), { name: e.name, result: e.result }] }));
            else if (e.type === 'answer') {
              terminal = true;
              patch((t) => ({
                ...t,
                text: e.answer.answer,
                failed: undefined,
                label: e.label,
                refused: e.answer.refused === true,
                ...(e.answer.formSuggestion ? { suggestion: e.answer.formSuggestion } : {}),
              }));
            } else {
              terminal = true;
              failWith(e.message);
            }
          });
          if (terminal) break;
          if (attempt === maxAttempts - 1) {
            failWith('Không kết nối được trợ lý. Kiểm tra mạng rồi thử lại, hoặc dùng tab Máy tính.');
          }
        } catch {
          if (attempt === maxAttempts - 1) {
            failWith('Không kết nối được trợ lý. Kiểm tra mạng rồi thử lại, hoặc dùng tab Máy tính.');
          }
        }
      }
    } finally {
      setBusy(false);
      setStatus('');
      requestAnimationFrame(() => end.current?.scrollIntoView({ block: 'end' }));
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" aria-label="Trợ lý">
          <Bot aria-hidden /> <span className="lbl">Trợ lý</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-muc-dem/45 data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:duration-240 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:duration-180" />
        <Dialog.Content
          aria-describedby="tro-ly-mo-ta"
          className="tro-ly fixed inset-x-0 bottom-0 z-50 flex h-[88vh] flex-col rounded-t-2xl shadow-2xl outline-none duration-240 ease-[cubic-bezier(0.16,1,0.3,1)] data-[state=open]:animate-in max-md:data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out max-md:data-[state=closed]:slide-out-to-bottom data-[state=closed]:duration-180 data-[state=closed]:ease-[cubic-bezier(0.4,0,1,1)] md:inset-y-0 md:right-0 md:left-auto md:h-auto md:w-[28rem] md:rounded-none md:data-[state=open]:slide-in-from-right md:data-[state=closed]:slide-out-to-right"
        >
          <header className="flex items-start justify-between gap-3 border-b border-border px-6 pt-6 pb-4">
            <div>
              <Dialog.Title className="font-display text-xl leading-tight font-bold">Trợ lý AI cho chủ hụi</Dialog.Title>
              <Dialog.Description id="tro-ly-mo-ta" className="mt-1 text-sm leading-normal text-muted-foreground">
                Chỉ đọc và tính, không ký, không chuyển tiền. Số liệu do hàm tính của HụiSafe tạo; lời giải thích do AI viết.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Đóng trợ lý" className="size-11 shrink-0 rounded-full border border-input hover:bg-card">
                <X aria-hidden className="size-5" />
              </Button>
            </Dialog.Close>
          </header>

          <div className="px-6 py-4">
            <ToggleGroup type="single" spacing={1} value={tab} onValueChange={(v) => v && setTab(v as 'ask' | 'calc')} aria-label="Chế độ trợ lý" className="rounded-full bg-card p-1">
              <ToggleGroupItem value="ask" className={`${TOGGLE_ON} min-h-10 rounded-full px-4 font-semibold text-muted-foreground`}>Hỏi trợ lý</ToggleGroupItem>
              <ToggleGroupItem value="calc" className={`${TOGGLE_ON} min-h-10 rounded-full px-4 font-semibold text-muted-foreground`}>Máy tính</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
            {tab === 'calc' ? (
              <CopilotCalc />
            ) : (
              <>
                {turns.length === 0 && (
                  <div>
                    <p className="text-muted-foreground">Hỏi về ký quỹ, trần thăm, rủi ro hay luật Nghị định 19. Chọn một câu hoặc tự gõ.</p>
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {SUGGESTIONS.map((s) => (
                        <li key={s}>
                          <button type="button" className="chip-hoi" disabled={busy} onClick={() => send(s)}>
                            {s}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <ol className="mt-4 space-y-3 first:mt-0" aria-label="Cuộc trò chuyện">
                  {turns.map((t, i) => (
                    <li key={i} className={t.role === 'user' ? 'ml-10 rounded-2xl rounded-br-sm bg-foreground px-4 py-3 text-background' : 'rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3'}>
                      <p className={`font-mono text-[11px] tracking-[0.08em] uppercase ${t.role === 'user' ? 'text-background/70' : 'text-muted-foreground'}`}>{t.role === 'user' ? 'Bạn' : 'Trợ lý AI'}</p>
                      {t.text === '' && busy && i === turns.length - 1 ? (
                        <p role="status" className="text-muted-foreground">{status || 'Đang trả lời...'}</p>
                      ) : (
                        <p className={t.failed ? 'font-semibold text-destructive' : 'whitespace-pre-line'}>{t.text}</p>
                      )}
                      {t.tools?.map((x, j) => <ToolResult key={j} name={x.name} result={x.result} />)}
                      {t.failed && i === turns.length - 1 && !busy && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {turns[i - 1]?.role === 'user' && (
                            <button type="button" className="nut-thu-lai" onClick={() => void send(turns[i - 1]!.text, true)}>
                              <RotateCcw aria-hidden className="size-4" /> Thử lại
                            </button>
                          )}
                          <button type="button" className="chip-hoi" onClick={() => setTab('calc')}>
                            Mở Máy tính
                          </button>
                        </div>
                      )}
                      {t.label && <p className="mt-2 text-sm text-muted-foreground">{t.label}</p>}
                      {t.role === 'assistant' && t.text && !t.failed && !t.text.includes(DISCLAIMER) && <p className="mt-1 text-sm text-muted-foreground">{DISCLAIMER}</p>}
                    </li>
                  ))}
                </ol>
                <div ref={end} />
              </>
            )}
          </div>

          {tab === 'ask' && (
            <form
              className="border-t border-border px-6 pt-4 pb-6"
              onSubmit={(e) => {
                e.preventDefault();
                void send(text);
              }}
            >
              <label htmlFor="cau-hoi" className="sr-only">
                Câu hỏi cho trợ lý
              </label>
              <div className="flex items-end gap-2">
                <Textarea
                  id="cau-hoi"
                  value={text}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
                  onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void send(text);
                    }
                  }}
                  rows={1}
                  maxLength={2000}
                  placeholder="Gõ câu hỏi của bạn (Enter để gửi)"
                  className="min-h-12 flex-1 rounded-xl bg-card px-4 py-3 text-base"
                />
                <button type="submit" className="gui" disabled={busy || text.trim() === ''} aria-busy={busy} aria-label="Gửi câu hỏi">
                  {busy ? <span className="gui-quay" aria-hidden /> : <Send aria-hidden className="size-5" />}
                </button>
              </div>
              <p className="mt-2 text-xs leading-normal text-muted-foreground">Đừng gõ họ tên, số điện thoại hay địa chỉ ví. {DISCLAIMER}</p>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
