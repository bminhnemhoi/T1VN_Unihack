/**
 * Reads the pre-generated simulation outputs of `sim/outputs/*.json` (docs/05 section 11). Read-only,
 * local files only, no network. A scenario's inputs live in `sim/scenarios/<id>.json`; outputs carry only the id.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { SIM_OUTPUT_DIR_ENV } from './config';

const designResult = z.object({
  design: z.string(),
  lateReceiverExpectedLossPct: z.number().nullable(),
  lateReceiverP95LossPct: z.number().nullable(),
  circleFailureProb: z.number().nullable(),
  uncoveredMeanUsdc: z.number().nullable(),
  bondUsageMeanPct: z.number().nullable(),
  organizerNetReturnPct: z.number().nullable(),
});
const outputFile = z.object({ scenario: z.string(), generatedAt: z.string().optional(), results: z.array(designResult) });
const scenarioFile = z.object({
  id: z.string(),
  seed: z.number(),
  circles: z.number(),
  N: z.number(),
  huisafe: z.object({ alphaBps: z.number(), bondRatio: z.number() }),
  behaviour: z.object({ deadDefaultHazardPerRound: z.object({ early: z.number(), late: z.number() }) }),
});

export type DesignResult = z.infer<typeof designResult>;

export interface SimRun {
  scenario: string;
  seed: number;
  circles: number;
  /** Per-round hazards of an already received member, early and late rounds: the assumption behind the run. */
  deadDefaultHazardPerRound: { early: number; late: number };
  generatedAt?: string;
  results: DesignResult[];
}

export interface SimLookup {
  status: 'ok';
  matched: { N: number; alphaBps: number; bondRatio: number };
  runs: SimRun[];
}
export type SimLookupResult = SimLookup | { status: 'no_results' };

/** `<repo>/sim`: from apps/web (cwd of `next` and vitest) up two levels, or the COPILOT_SIM_DIR override (tests). */
export function simRoot(): string {
  return process.env[SIM_OUTPUT_DIR_ENV] ?? path.resolve(process.cwd(), '..', '..', 'sim');
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** Exact match on N, alphaBps and bondRatio against the scenario inputs; unknown fields are dropped by the schemas. */
export function lookupSimulation(input: { N: number; alphaBps: number; bondRatio: number }): SimLookupResult {
  const root = simRoot();
  let ids: string[];
  try {
    ids = readdirSync(path.join(root, 'scenarios')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
  } catch {
    return { status: 'no_results' };
  }
  const runs: SimRun[] = [];
  for (const id of ids) {
    try {
      const sc = scenarioFile.safeParse(readJson(path.join(root, 'scenarios', `${id}.json`)));
      if (!sc.success) continue;
      const s = sc.data;
      if (s.N !== input.N || s.huisafe.alphaBps !== input.alphaBps || s.huisafe.bondRatio !== input.bondRatio) continue;
      const out = outputFile.safeParse(readJson(path.join(root, 'outputs', `${id}.json`)));
      if (!out.success) continue;
      runs.push({
        scenario: s.id,
        seed: s.seed,
        circles: s.circles,
        deadDefaultHazardPerRound: s.behaviour.deadDefaultHazardPerRound,
        ...(out.data.generatedAt ? { generatedAt: out.data.generatedAt } : {}),
        results: out.data.results,
      });
    } catch {
      // A scenario without a matching output file is simply not a result yet.
    }
  }
  if (runs.length === 0) return { status: 'no_results' };
  return { status: 'ok', matched: { N: input.N, alphaBps: input.alphaBps, bondRatio: input.bondRatio }, runs };
}
