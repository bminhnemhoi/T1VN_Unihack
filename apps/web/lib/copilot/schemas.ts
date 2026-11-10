import { z } from 'zod';
import { LIMITS, TESTNET_MAX_C_USDC } from './config';

/** The 10 `explain_rule` topics (docs/05 section 12). */
export const RULE_TOPICS = [
  'nd19_dieu5_6',
  'nd19_dieu12_13',
  'nd19_dieu14',
  'nd19_dieu18_4',
  'nd19_dieu20',
  'nd19_dieu21',
  'nd19_dieu22',
  'nd19_dieu25',
  'crypto_vn',
  'unihack_rules',
] as const;
export type RuleTopic = (typeof RULE_TOPICS)[number];

export const TOOL_NAMES = [
  'compute_exposure',
  'recommend_bond',
  'max_bid_table',
  'simulate_circle',
  'explain_rule',
  'draft_ubnd_notice',
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

const nOfShares = z.number().int().min(3).max(30);
/** Amount in any currency unit (a plain number); at most 6 decimals is checked by the tool. */
const amount = z.number().positive().max(1e12);
const alphaBps = z.number().int().min(0).max(10_000);

// strict(): unknown keys are rejected, so injected fields never reach a tool.
export const toolInputSchemas = {
  compute_exposure: z.object({ N: nOfShares, C: amount }).strict(),
  recommend_bond: z
    .object({ N: nOfShares, C: amount, alphaBps, targetCoverageBps: z.number().int().min(5_000).max(10_000) })
    .strict(),
  max_bid_table: z
    .object({
      N: nOfShares,
      C: amount,
      periodDays: z.number().int().min(1).max(31),
      capBps: z.number().int().min(0).max(2_000).default(2_000),
      /** phi and the per-pot fee ceiling (docs/03 section 2.7): with phi > 0 the table adds the enforced ceiling and the commission of each round. */
      commissionShareBps: z.number().int().min(0).max(5_000).default(0),
      feeBps: z.number().int().min(0).max(300).default(0),
    })
    .strict()
    .superRefine((d, ctx) => {
      if (d.commissionShareBps > 0 && d.feeBps === 0) {
        ctx.addIssue({ code: 'custom', path: ['feeBps'], message: 'InvalidParams(15): commissionShareBps > 0 needs feeBps > 0' });
      }
    }),
  simulate_circle: z
    .object({
      N: nOfShares,
      alphaBps,
      bondRatio: z.number().min(0).max(1),
      /** Ask for one of the two organizer scenarios of v1.2 (docs/08 section 2.7) instead of the three-design baseline. */
      organizer: z.enum(['economics', 'sybil']).optional(),
      /** economics: only this period (7 or 30 days). */
      periodDays: z.number().int().min(1).max(31).optional(),
      /** economics: only this phi (0, 3333 or 5000). */
      commissionShareBps: z.number().int().min(0).max(5_000).optional(),
      /** sybil: only this many fake wallets (1 or 2). */
      wallets: z.number().int().min(1).max(2).optional(),
    })
    .strict(),
  explain_rule: z.object({ topic: z.enum(RULE_TOPICS) }).strict(),
  draft_ubnd_notice: z.object({ circle: z.string().regex(/^0x[0-9a-fA-F]{40}$/) }).strict(),
} as const satisfies Record<ToolName, z.ZodType>;

export type ToolInput<T extends ToolName> = z.infer<(typeof toolInputSchemas)[T]>;

const decimalString = z.string().regex(/^\d{1,12}(?:[.,]\d{1,6})?$/);

/** `CircleDraft` of docs/05 section 12.1, validated with the InvalidParams bounds of 4.3. */
export const circleDraftSchema = z
  .object({
    mode: z.enum(['fixed', 'bidding']),
    N: z.number().int().min(3).max(30),
    C: decimalString,
    periodDays: z.number().int().min(1).max(31),
    demoMode: z.boolean(),
    alphaBps: z.number().int().min(0).max(10_000),
    bondUsdc: decimalString,
    commissionMode: z.boolean(),
    feeBps: z.number().int().min(0).max(300),
    /** phi, 0..5000 (docs/03 section 2.7); 0 or missing = fixed fee. */
    commissionShareBps: z.number().int().min(0).max(5_000).optional(),
    reserveBps: z.number().int().min(0).max(300),
    revealBondBps: z.number().int().min(0).max(500),
    capBps: z.number().int().min(0).max(2_000),
    organizerActiveCircles: z.number().int().min(0).max(1_000).optional(),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (!d.commissionMode && d.feeBps > 0) {
      ctx.addIssue({ code: 'custom', path: ['feeBps'], message: 'InvalidParams(9): feeBps > 0 without commissionMode' });
    }
    const phi = d.commissionShareBps ?? 0;
    if (phi > 0 && (d.mode !== 'bidding' || !d.commissionMode || d.feeBps === 0)) {
      ctx.addIssue({ code: 'custom', path: ['commissionShareBps'], message: 'InvalidParams(15): phi needs a bidding circle with a commission and feeBps > 0' });
    }
    const c = Number(d.C.replace(',', '.'));
    if (!(c >= 1 && c <= TESTNET_MAX_C_USDC)) {
      ctx.addIssue({ code: 'custom', path: ['C'], message: 'InvalidParams(2): C must be 1..10000 USDC' });
    }
  });
export type CircleDraft = z.infer<typeof circleDraftSchema>;

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

export const requestSchema = z
  .object({
    messages: z
      .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(LIMITS.maxMessageChars) }).strict())
      .min(1)
      .max(LIMITS.maxMessages),
    draft: circleDraftSchema.optional(),
    /** The circle being viewed; the only wallet address the model may see (docs/07 3.8). */
    circle: address.optional(),
  })
  .strict()
  .refine((b) => b.messages.at(-1)?.role === 'user', { message: 'last message must be from the user' });
export type CopilotRequest = z.infer<typeof requestSchema>;

/** Final answer schema of docs/07 3.4 (keys in English, ADR-15). */
export const answerSchema = z
  .object({
    answer: z.string().min(1).max(4_000),
    figures: z.array(z.object({ value: z.string().max(40), source: z.string().max(60) }).strict()).max(40).default([]),
    citations: z.array(z.object({ topic: z.enum(RULE_TOPICS) }).strict()).max(10).default([]),
    refused: z.boolean().default(false),
    formSuggestion: z.record(z.string().max(30), z.string().max(40)).optional(),
  })
  .strict();
export type CopilotAnswer = z.infer<typeof answerSchema>;
