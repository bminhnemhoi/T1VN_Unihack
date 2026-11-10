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

// --- organizer scenarios of v1.2 (docs/08 section 2.7) ---------------------------------------------------------

const economicsCell = z.object({
  schedule: z.string(),
  periodDays: z.number(),
  members: z.number(),
  shareBps: z.number(),
  feeBps: z.number(),
  bondUsdc: z.number(),
  grossFeeUsdc: z.number(),
  expectedLossUsdc: z.number(),
  netAfterRiskUsdc: z.number(),
  annualReturnPctByHazardScale: z.record(z.string(), z.number().nullable()),
  seatNetUsdc: z.array(z.number()),
  firstSeatNetUsdc: z.number(),
  lastSeatNetUsdc: z.number(),
  lastThirdNeverLoses: z.boolean(),
  insideInterestCap: z.boolean(),
});
const sybilCase = z.object({
  label: z.string(),
  wallets: z.number(),
  bondUsdc: z.number(),
  bondBps: z.number(),
  coverageBps: z.number(),
  organizerNetUsdc: z.number(),
  walletsNetUsdc: z.number(),
  uncoveredUsdc: z.number(),
  lastReceiverPayoutUsdc: z.number(),
  lastReceiverNormalUsdc: z.number(),
});
const economicsScenario = z.object({
  id: z.string(),
  kind: z.literal('organizer_economics'),
  seed: z.number(),
  alphaBps: z.number(),
  members: z.array(z.number()),
  assumptions: z.string().optional(),
});
const sybilScenario = z.object({
  id: z.string(),
  kind: z.literal('organizer_sybil'),
  seed: z.number(),
  N: z.number(),
  alphaBps: z.number(),
  assumptions: z.string().optional(),
});
const economicsOutput = z.object({ generatedAt: z.string().optional(), cells: z.array(economicsCell) });
const sybilOutput = z.object({ generatedAt: z.string().optional(), cases: z.array(sybilCase) });

export type EconomicsCell = z.infer<typeof economicsCell>;
export type SybilCase = z.infer<typeof sybilCase>;

export interface OrganizerRun {
  scenario: string;
  kind: 'organizer_economics' | 'organizer_sybil';
  seed: number;
  generatedAt?: string;
  /** What the scenario assumes (hazards, bids): say it when quoting the numbers. */
  assumptions?: string;
  economics?: EconomicsCell[];
  sybil?: SybilCase[];
}

export interface OrganizerLookup {
  status: 'ok';
  matched: { organizer: 'economics' | 'sybil'; N: number; alphaBps: number; bondRatio: number };
  organizerRuns: OrganizerRun[];
}

export interface OrganizerQuery {
  organizer: 'economics' | 'sybil';
  N: number;
  alphaBps: number;
  bondRatio: number;
  periodDays?: number | undefined;
  commissionShareBps?: number | undefined;
  wallets?: number | undefined;
}

/** The bond that gives CI = 100% (ADR-22): (1 - alpha), as the ratio the baseline scenarios use. */
const fullCoverRatio = (alphaBps: number): number => (10_000 - alphaBps) / 10_000;

/**
 * Looks up `organizer_economics` or `organizer_sybil` outputs. Same rules as the baseline lookup: exact match on the
 * inputs (N, alphaBps, bondRatio, plus the optional filters), only whitelisted fields leave, never an invented number.
 */
export function lookupOrganizer(q: OrganizerQuery): OrganizerLookup | { status: 'no_results' } {
  const root = simRoot();
  const kind = q.organizer === 'economics' ? 'organizer_economics' : 'organizer_sybil';
  let ids: string[];
  try {
    ids = readdirSync(path.join(root, 'scenarios')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
  } catch {
    return { status: 'no_results' };
  }
  const runs: OrganizerRun[] = [];
  for (const id of ids) {
    try {
      const raw = readJson(path.join(root, 'scenarios', `${id}.json`));
      const head = { generatedAt: undefined as string | undefined };
      if (q.organizer === 'economics') {
        const sc = economicsScenario.safeParse(raw);
        if (!sc.success || sc.data.kind !== kind || sc.data.alphaBps !== q.alphaBps) continue;
        if (!sc.data.members.includes(q.N) || q.bondRatio !== fullCoverRatio(q.alphaBps)) continue;
        const out = economicsOutput.safeParse(readJson(path.join(root, 'outputs', `${id}.json`)));
        if (!out.success) continue;
        const cells = out.data.cells.filter(
          (c) => c.members === q.N && (q.periodDays === undefined || c.periodDays === q.periodDays) && (q.commissionShareBps === undefined || c.shareBps === q.commissionShareBps),
        );
        if (cells.length === 0) continue;
        head.generatedAt = out.data.generatedAt;
        runs.push({ scenario: sc.data.id, kind: 'organizer_economics', seed: sc.data.seed, ...(head.generatedAt ? { generatedAt: head.generatedAt } : {}), ...(sc.data.assumptions ? { assumptions: sc.data.assumptions } : {}), economics: cells });
      } else {
        const sc = sybilScenario.safeParse(raw);
        if (!sc.success || sc.data.kind !== kind || sc.data.N !== q.N || sc.data.alphaBps !== q.alphaBps) continue;
        const out = sybilOutput.safeParse(readJson(path.join(root, 'outputs', `${id}.json`)));
        if (!out.success) continue;
        const cases = out.data.cases.filter((c) => c.bondBps / 10_000 === q.bondRatio && (q.wallets === undefined || c.wallets === q.wallets));
        if (cases.length === 0) continue;
        runs.push({ scenario: sc.data.id, kind: 'organizer_sybil', seed: sc.data.seed, ...(out.data.generatedAt ? { generatedAt: out.data.generatedAt } : {}), ...(sc.data.assumptions ? { assumptions: sc.data.assumptions } : {}), sybil: cases });
      }
    } catch {
      // A scenario without a matching output file is simply not a result yet.
    }
  }
  if (runs.length === 0) return { status: 'no_results' };
  return { status: 'ok', matched: { organizer: q.organizer, N: q.N, alphaBps: q.alphaBps, bondRatio: q.bondRatio }, organizerRuns: runs };
}
