import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const call = (q: string): Response => GET(new Request(`http://localhost/api/sim/results${q}`));

beforeEach(() => {
  const root = mkdtempSync(path.join(tmpdir(), 'huisafe-sim-'));
  mkdirSync(path.join(root, 'outputs'));
  writeFileSync(path.join(root, 'outputs', 'organizer_sybil.json'), JSON.stringify({ scenario: 'organizer_sybil', cases: [{ label: 'x' }] }));
  writeFileSync(path.join(root, 'outputs', 'organizer_sybil.meta.json'), '{"meta":true}');
  writeFileSync(path.join(root, '..secret.json'), '{}');
  vi.stubEnv('COPILOT_SIM_DIR', root);
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /api/sim/results', () => {
  it('returns the finished output file as JSON', async () => {
    const res = call('?scenario=organizer_sybil');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ scenario: 'organizer_sybil', cases: [{ label: 'x' }] });
  });

  it('asks for the parameter when it is missing or malformed, and never reads paths', async () => {
    for (const q of ['', '?scenario=', '?scenario=../x', '?scenario=a/b', '?scenario=Organizer', '?scenario=..%2Fsecret']) {
      expect(call(q).status).toBe(400);
    }
  });

  it('answers 404 for a scenario without output, and does not serve .meta.json as a scenario', async () => {
    expect(call('?scenario=nope').status).toBe(404);
    expect(call('?scenario=organizer_sybil.meta').status).toBe(400);
  });
});

describe('GET /api/sim/results against the real outputs', () => {
  it('serves organizer_economics and organizer_sybil with the numbers of docs/03 section 7.3', async () => {
    vi.unstubAllEnvs();
    const sybil = (await call('?scenario=organizer_sybil').json()) as { cases: { label: string; organizerNetUsdc: number }[] };
    expect(sybil.cases.map((c) => c.organizerNetUsdc)).toEqual([-18.038354, 41.472772, 120.756588]);
    const eco = (await call('?scenario=organizer_economics').json()) as { cells: unknown[] };
    expect(eco.cells.length).toBe(24);
  });
});
