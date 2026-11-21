import { describe, expect, it } from 'vitest';
import { UNRESOLVED_DEFAULT_MESSAGE, hasUnresolvedDefault } from './entryRules';

describe('hasUnresolvedDefault (docs/05 section 8.1; issue #17)', () => {
  it('blocks a wallet with more defaults than repayments', () => {
    expect(hasUnresolvedDefault({ defaults: 1, repaid: 0 })).toBe(true);
  });
  it('lets a wallet in once every default is repaid', () => {
    expect(hasUnresolvedDefault({ defaults: 1, repaid: 1 })).toBe(false);
  });
  it('lets a clean wallet in', () => {
    expect(hasUnresolvedDefault({ defaults: 0, repaid: 0 })).toBe(false);
  });
  it('accepts uint32 values read as bigint', () => {
    expect(hasUnresolvedDefault({ defaults: 2n, repaid: 1n })).toBe(true);
  });
  it('has one message shared by the server and the invite page', () => {
    expect(UNRESOLVED_DEFAULT_MESSAGE).toMatch(/vỡ nợ chưa hoàn trả/);
  });
});
