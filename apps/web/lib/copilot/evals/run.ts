/**
 * Eval harness for the organizer copilot (docs/07 section 6).
 *
 *   pnpm --filter web eval:copilot -- --mode mock            # CI: scripted model, no key, no network
 *   pnpm --filter web eval:copilot -- --mode live --runs 3   # needs the human to export ANTHROPIC_API_KEY
 *
 * Mock mode checks the deterministic pipeline (tools, guard, scoring); it says nothing about Claude's quality.
 * Live mode without a key prints UNAVAILABLE and exits with code 2. Nothing here reads a secret file.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createAnthropicModelClient } from '../anthropicClient';
import { COPILOT_EFFORT, COPILOT_MODEL } from '../config';
import { runCopilot, type CopilotEvent, type ModelClient } from '../engine';
import { requestSchema } from '../schemas';
import { createScriptedModel, loadCases, type EvalCase } from './mock';
import { scoreCase, summarize, type CaseOutcome } from './score';

const { values } = parseArgs({
  options: {
    mode: { type: 'string', default: 'mock' },
    cases: { type: 'string', default: path.resolve(process.cwd(), 'lib/copilot/evals/cases.vi.jsonl') },
    runs: { type: 'string', default: '1' },
    out: { type: 'string', default: path.resolve(process.cwd(), 'lib/copilot/evals/reports') },
    only: { type: 'string', default: '' },
  },
  allowPositionals: true,
  strict: false,
});

const mode = String(values.mode);
const runs = Math.max(1, Number(values.runs) || 1);

function pickModel(): ModelClient | null {
  if (mode === 'mock') return createScriptedModel(loadCases(String(values.cases)));
  if (mode === 'live') {
    const key = process.env.ANTHROPIC_API_KEY;
    return key ? createAnthropicModelClient(key) : null;
  }
  throw new Error(`Unknown --mode ${mode} (use mock or live)`);
}

async function main(): Promise<number> {
  const model = pickModel();
  if (!model) {
    console.log('Live eval: UNAVAILABLE. ANTHROPIC_API_KEY is not exported in this shell (the agent does not read env files).');
    console.log('Export it yourself, then rerun with --mode live --runs 3.');
    return 2;
  }

  const only = String(values.only).split(',').filter(Boolean);
  const cases: EvalCase[] = loadCases(String(values.cases)).filter((c) => only.length === 0 || only.includes(c.id));
  const outcomes = new Map<string, CaseOutcome[]>();
  let tokensIn = 0;
  let tokensOut = 0;

  for (const c of cases) {
    const request = requestSchema.parse({
      messages: [{ role: 'user', content: c.input }],
      ...(c.draft ? { draft: c.draft } : {}),
      ...(c.circle ? { circle: c.circle } : {}),
    });
    for (let r = 0; r < runs; r++) {
      const events: CopilotEvent[] = [];
      const t0 = Date.now();
      for await (const e of runCopilot({
        request,
        model,
        requestId: `eval-${c.id}-${r}`,
        log: (entry) => {
          if (entry.event === 'done') {
            tokensIn += Number(entry.tokensIn) || 0;
            tokensOut += Number(entry.tokensOut) || 0;
          }
        },
      })) {
        events.push(e);
      }
      const outcome = scoreCase(c, events, Date.now() - t0);
      outcomes.set(c.id, [...(outcomes.get(c.id) ?? []), outcome]);
    }
  }

  const { rows, allPass } = summarize(cases, outcomes);
  const latencies = [...outcomes.values()].flat().map((o) => o.ms).sort((a, b) => a - b);
  const pctl = (p: number) => latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))] ?? 0;
  const failed = [...outcomes.entries()].flatMap(([id, os]) => os.filter((o) => !o.pass).map((o) => ({ id, failures: o.failures })));

  const lines: string[] = [];
  lines.push(`# Copilot eval (${mode})`);
  lines.push('');
  lines.push(
    mode === 'mock'
      ? '> MOCK: câu trả lời do kịch bản viết tay, không phải đo mô hình. Chỉ kiểm tool, bộ kiểm đầu ra và cách chấm.'
      : `> LIVE: model ${COPILOT_MODEL}, effort ${COPILOT_EFFORT}, không đặt temperature/top_p/top_k (mô hình chỉ nhận mặc định).`,
  );
  lines.push('');
  lines.push(`Ca: ${cases.length}, số lần chạy mỗi ca: ${runs}, token vào/ra: ${tokensIn}/${tokensOut}, độ trễ trung vị/p95: ${pctl(0.5)}/${pctl(0.95)} ms`);
  lines.push('');
  lines.push('| Chỉ số | Ngưỡng | Kết quả | Đạt |');
  lines.push('|---|---|---|---|');
  for (const r of rows) lines.push(`| ${r.name} | ${r.threshold} | ${r.value} | ${r.pass === null ? 'chưa đo' : r.pass ? 'đạt' : 'TRƯỢT'} |`);
  lines.push('');
  lines.push('| Ca | Nhóm | Tool đã gọi | Nguồn | Đạt |');
  lines.push('|---|---|---|---|---|');
  for (const c of cases) {
    const os = outcomes.get(c.id) ?? [];
    const ok = os.filter((o) => o.pass).length;
    lines.push(`| ${c.id} | ${c.category} | ${os[0]?.tools.join(', ') || '-'} | ${os[0]?.source ?? '-'} | ${ok}/${os.length} |`);
  }
  if (failed.length > 0) {
    lines.push('');
    lines.push('Ca trượt:');
    for (const f of failed) lines.push(`- ${f.id}: ${f.failures.join('; ')}`);
  }
  const md = lines.join('\n');
  console.log(md);

  mkdirSync(String(values.out), { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  writeFileSync(path.join(String(values.out), `${stamp}-${mode}.md`), `${md}\n`);
  writeFileSync(
    path.join(String(values.out), `${stamp}-${mode}.json`),
    `${JSON.stringify({ mode, model: mode === 'live' ? COPILOT_MODEL : 'scripted-mock', runs, rows, outcomes: Object.fromEntries(outcomes) }, null, 2)}\n`,
  );
  return allPass ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : 'eval failed');
    process.exit(1);
  },
);
