/**
 * Reads the pre-generated simulation files in `sim/outputs` for the /lab page (docs/05 section 11, docs/08). Server only,
 * read only, local files only. Anything missing or malformed is skipped, so a half-finished run never breaks the page.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { buildEconomics, buildSybil, type LabEconomics, type LabSybil } from './lab-organizer';

const design = z.object({
  design: z.string(),
  lateReceiverExpectedLossPct: z.number().nullable(),
  lateReceiverP95LossPct: z.number().nullable(),
  circleFailureProb: z.number().nullable(),
  uncoveredMeanUsdc: z.number().nullable(),
  bondUsageMeanPct: z.number().nullable(),
});
const output = z.object({ scenario: z.string(), generatedAt: z.string().optional(), results: z.array(design) });
const scenario = z.object({
  id: z.string(),
  seed: z.number(),
  circles: z.number(),
  N: z.number(),
  C: z.number(),
  periodDays: z.number(),
  huisafe: z.object({ alphaBps: z.number(), bondRatio: z.number() }),
  behaviour: z.object({ deadDefaultHazardPerRound: z.object({ early: z.number(), late: z.number() }), liveDefaultHazardPerRound: z.number() }),
});
const meta = z.object({ assumptions: z.string().optional(), gitCommit: z.string().optional() }).passthrough();
const inv08Row = z.object({
  plan: z.string(),
  q: z.number(),
  design: z.string(),
  bondRatio: z.number(),
  uncoveredShare: z.number(),
  uncoveredEndMeanUsdc: z.number(),
});
const inv08 = z.object({ generatedAt: z.string().optional(), maxExposureUsdc: z.number(), worstCaseSequentialShortfallUsdc: z.number(), rows: z.array(inv08Row) });

export type LabDesign = z.infer<typeof design>;
export interface LabRun {
  id: string;
  generatedAt?: string;
  seed: number;
  circles: number;
  n: number;
  c: number;
  periodDays: number;
  alphaBps: number;
  bondRatio: number;
  hazardEarly: number;
  hazardLate: number;
  hazardLive: number;
  assumptions?: string;
  results: LabDesign[];
}
export type LabInv08 = z.infer<typeof inv08>;
export type { LabEconCell, LabEconomics, LabSybil, LabSybilCase } from './lab-organizer';
export interface LabData {
  runs: LabRun[];
  inv08?: LabInv08;
  /** v1.2: what the organizer earns by commission schedule (docs/08 section 2.7). */
  economics?: LabEconomics;
  /** v1.2: one or two dummy wallets at CI 50% and 100% (docs/03 section 7.3). */
  sybil?: LabSybil;
}

const simRoot = (): string => path.resolve(process.cwd(), '..', '..', 'sim');
const read = (rel: string): unknown => JSON.parse(readFileSync(path.join(simRoot(), rel), 'utf8'));

const SCENARIOS = ['baseline', 'baseline_calibrated'] as const;

export function loadLab(): LabData {
  const runs: LabRun[] = [];
  for (const id of SCENARIOS) {
    try {
      const sc = scenario.parse(read(`scenarios/${id}.json`));
      const out = output.parse(read(`outputs/${id}.json`));
      let assumptions: string | undefined;
      try {
        assumptions = meta.parse(read(`outputs/${id}.meta.json`)).assumptions;
      } catch {
        /* meta is optional */
      }
      runs.push({
        id,
        ...(out.generatedAt ? { generatedAt: out.generatedAt } : {}),
        seed: sc.seed,
        circles: sc.circles,
        n: sc.N,
        c: sc.C,
        periodDays: sc.periodDays,
        alphaBps: sc.huisafe.alphaBps,
        bondRatio: sc.huisafe.bondRatio,
        hazardEarly: sc.behaviour.deadDefaultHazardPerRound.early,
        hazardLate: sc.behaviour.deadDefaultHazardPerRound.late,
        hazardLive: sc.behaviour.liveDefaultHazardPerRound,
        ...(assumptions ? { assumptions } : {}),
        results: out.results,
      });
    } catch {
      /* this scenario has no usable result yet */
    }
  }
  let inv: LabInv08 | undefined;
  try {
    inv = inv08.parse(read('outputs/inv08.json'));
  } catch {
    inv = undefined;
  }
  const tryRead = (rel: string): unknown => {
    try {
      return read(rel);
    } catch {
      return undefined;
    }
  };
  const economics = buildEconomics(tryRead('outputs/organizer_economics.json'));
  const sybil = buildSybil(tryRead('outputs/organizer_sybil.json'));
  return { runs, ...(inv ? { inv08: inv } : {}), ...(economics ? { economics } : {}), ...(sybil ? { sybil } : {}) };
}
