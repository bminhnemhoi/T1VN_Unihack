/**
 * GET /api/sim/results?scenario=<id> (docs/05 section 8.5): the simulation output already generated in `sim/outputs/<id>.json`.
 * Read only, local files only. The id must be the name of an existing output file (no paths), so nothing else can be read.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { simRoot } from '@/lib/copilot/simResults';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID = /^[a-z0-9_]{1,64}$/;
const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

/** Ids of the finished outputs: `baseline`, `baseline_calibrated`, `inv08`, `organizer_economics`, `organizer_sybil`. `.meta.json` files are not scenarios. */
function availableScenarios(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.json') && !f.endsWith('.meta.json'))
      .map((f) => f.slice(0, -'.json'.length))
      .filter((id) => ID.test(id))
      .sort();
  } catch {
    return [];
  }
}

export function GET(req: Request): Response {
  const id = new URL(req.url).searchParams.get('scenario');
  if (!id || !ID.test(id)) return json(400, { error: { code: 'BadRequest', message: 'Thiếu hoặc sai tham số scenario (chỉ chữ thường, số và gạch dưới).' } });
  const dir = path.join(simRoot(), 'outputs');
  if (!availableScenarios(dir).includes(id)) return json(404, { error: { code: 'NoResults', message: 'Chưa có kết quả mô phỏng cho kịch bản này.' } });
  try {
    return json(200, JSON.parse(readFileSync(path.join(dir, `${id}.json`), 'utf8')));
  } catch {
    return json(500, { error: { code: 'Unreadable', message: 'Không đọc được file kết quả.' } });
  }
}
