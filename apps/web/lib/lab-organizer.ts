/**
 * Pure part of the v1.2 organizer scenarios of the /lab page (docs/08 section 2.7, docs/03 section 7.3): parsing the
 * two output files into the view the page draws. No file access here, so client components can import it.
 */
import { z } from 'zod';

const econCell = z.object({
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
  firstSeatNetUsdc: z.number(),
  lastSeatNetUsdc: z.number(),
  lastThirdNeverLoses: z.boolean(),
  insideInterestCap: z.boolean(),
});
const econFile = z.object({
  generatedAt: z.string().optional(),
  C: z.number(),
  alphaBps: z.number(),
  bidPctOfCap: z.number(),
  risk: z.object({ early: z.number(), late: z.number(), scales: z.array(z.number()) }),
  cells: z.array(econCell),
});
const sybilCaseSchema = z.object({
  label: z.string(),
  wallets: z.number(),
  bondUsdc: z.number(),
  coverageBps: z.number(),
  organizerNetUsdc: z.number(),
  walletsNetUsdc: z.number(),
  uncoveredUsdc: z.number(),
  lastReceiverPayoutUsdc: z.number(),
  lastReceiverNormalUsdc: z.number(),
});
const sybilFile = z.object({ generatedAt: z.string().optional(), N: z.number(), C: z.number(), alphaBps: z.number(), cases: z.array(sybilCaseSchema) });

export type LabEconCell = z.infer<typeof econCell>;
export type LabSybilCase = z.infer<typeof sybilCaseSchema>;
export interface LabEconomics {
  generatedAt?: string;
  c: number;
  alphaBps: number;
  bidPctOfCap: number;
  hazardEarly: number;
  hazardLate: number;
  /** Hazard scales the yearly return was computed at, for example [1, 0.5]. */
  scales: number[];
  periods: number[];
  members: number[];
  cells: LabEconCell[];
}
export interface LabSybil {
  generatedAt?: string;
  n: number;
  c: number;
  alphaBps: number;
  cases: LabSybilCase[];
}

/** Builds the organizer-earnings view from the raw file. Returns undefined when the file is not usable. */
export function buildEconomics(raw: unknown): LabEconomics | undefined {
  const f = econFile.safeParse(raw);
  if (!f.success || f.data.cells.length === 0) return undefined;
  const uniq = (xs: number[]): number[] => [...new Set(xs)].sort((a, b) => a - b);
  return {
    ...(f.data.generatedAt ? { generatedAt: f.data.generatedAt } : {}),
    c: f.data.C,
    alphaBps: f.data.alphaBps,
    bidPctOfCap: f.data.bidPctOfCap,
    hazardEarly: f.data.risk.early,
    hazardLate: f.data.risk.late,
    scales: f.data.risk.scales,
    periods: uniq(f.data.cells.map((c) => c.periodDays)),
    members: uniq(f.data.cells.map((c) => c.members)),
    cells: f.data.cells,
  };
}

/** The cells of one chart: a chosen period and number of members, in the file order (fixed fee, then phi). */
export function economicsFor(e: LabEconomics, periodDays: number, members: number): LabEconCell[] {
  return e.cells.filter((c) => c.periodDays === periodDays && c.members === members);
}

export function buildSybil(raw: unknown): LabSybil | undefined {
  const f = sybilFile.safeParse(raw);
  if (!f.success || f.data.cases.length === 0) return undefined;
  return { ...(f.data.generatedAt ? { generatedAt: f.data.generatedAt } : {}), n: f.data.N, c: f.data.C, alphaBps: f.data.alphaBps, cases: f.data.cases };
}

