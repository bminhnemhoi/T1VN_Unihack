import { validateForm, type FormState } from '@/lib/circleForm';

/** Events the route streams as NDJSON (see `CopilotEvent` in lib/copilot/engine.ts). Parsed defensively: unknown shapes are dropped. */
export type StreamEvent =
  | { type: 'status'; text: string }
  | { type: 'tool'; name: string; result: unknown; error?: string }
  | { type: 'answer'; answer: { answer: string; refused?: boolean; formSuggestion?: Record<string, string> }; source: string; label: string }
  | { type: 'error'; code: string; message: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function parseLine(line: string): StreamEvent | undefined {
  try {
    const v: unknown = JSON.parse(line);
    if (!isObj(v)) return undefined;
    if (v.type === 'status' && typeof v.text === 'string') return { type: 'status', text: v.text };
    if (v.type === 'tool' && typeof v.name === 'string') return { type: 'tool', name: v.name, result: v.result, ...(typeof v.error === 'string' ? { error: v.error } : {}) };
    if (v.type === 'error') return { type: 'error', code: String(v.code ?? ''), message: typeof v.message === 'string' ? v.message : 'Có lỗi xảy ra. Bạn thử lại sau.' };
    if (v.type === 'answer' && isObj(v.answer) && typeof v.answer.answer === 'string') {
      const fs = isObj(v.answer.formSuggestion)
        ? Object.fromEntries(Object.entries(v.answer.formSuggestion).filter((e): e is [string, string] => typeof e[1] === 'string'))
        : undefined;
      return {
        type: 'answer',
        answer: { answer: v.answer.answer, refused: v.answer.refused === true, ...(fs ? { formSuggestion: fs } : {}) },
        source: String(v.source ?? ''),
        label: String(v.label ?? ''),
      };
    }
  } catch {
    /* a partial or garbled line: ignore */
  }
  return undefined;
}

/** Reads a streamed body and calls `onEvent` once per complete line. */
export async function readNdjson(body: ReadableStream<Uint8Array>, onEvent: (e: StreamEvent) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      const e = line ? parseLine(line) : undefined;
      if (e) onEvent(e);
    }
  }
  const rest = buf.trim();
  const e = rest ? parseLine(rest) : undefined;
  if (e) onEvent(e);
}

/** `CircleDraft` (docs/05 section 12.1) from the saved create-circle form, or undefined when the form is empty or invalid. No personal data in it. */
export function draftFromStorage(): Record<string, unknown> | undefined {
  try {
    const raw = JSON.parse(sessionStorage.getItem('huisafe.wizard.v1') ?? 'null') as { f?: FormState } | null;
    const f = raw?.f;
    if (!f) return undefined;
    const { value } = validateForm(f);
    if (!value) return undefined;
    return {
      mode: f.mode,
      N: Number(value.n),
      C: f.c.trim(),
      periodDays: Number(value.periodDays),
      demoMode: false,
      alphaBps: Number(value.alphaBps),
      bondUsdc: f.bond.trim() || '0',
      commissionMode: f.commission,
      feeBps: Number(value.feeBps),
      reserveBps: Number(value.reserveBps),
      revealBondBps: 100,
      capBps: f.mode === 'fixed' ? 0 : 2000,
    };
  } catch {
    return undefined;
  }
}
