/**
 * Entry rule shared by `/api/attest` (the gate, fails closed) and the invite page (the early warning, issue #17), so
 * both always check the same condition. docs/05 section 8.1: a wallet with an unresolved default in the
 * ReputationRegistry (`defaults > repaid`) cannot join a new circle. If the team changes this rule, change it here.
 */
export interface ReputationCounts {
  defaults: number | bigint;
  repaid: number | bigint;
}

export function hasUnresolvedDefault(rep: ReputationCounts): boolean {
  return BigInt(rep.defaults) > BigInt(rep.repaid);
}

export const UNRESOLVED_DEFAULT_MESSAGE =
  'Ví này đang có khoản vỡ nợ chưa hoàn trả ở dây trước nên chưa được vào dây mới. Hãy hoàn trả nợ cũ trước.';
