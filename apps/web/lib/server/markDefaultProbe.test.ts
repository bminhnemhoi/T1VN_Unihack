import { describe, expect, it } from 'vitest';
import { ContractFunctionExecutionError, ContractFunctionRevertedError, HttpRequestError, encodeErrorResult } from 'viem';
import { huiCircleFullAbi } from 'sdk';
import { markDefaultWouldSucceed } from './markDefaultProbe';

const CIRCLE = `0x${'11'.repeat(20)}` as const;
const WALLET = `0x${'22'.repeat(20)}` as const;

function reverting(errorName: string) {
  const data = encodeErrorResult({ abi: huiCircleFullAbi, errorName } as never);
  const cause = new ContractFunctionRevertedError({ abi: huiCircleFullAbi, data, functionName: 'markDefault' });
  return new ContractFunctionExecutionError(cause, { abi: huiCircleFullAbi, functionName: 'markDefault', args: [WALLET] });
}

const client = (f: () => Promise<unknown>) => ({ simulateContract: f as never });

describe('markDefaultWouldSucceed (docs/05 8.1, audit L-02)', () => {
  it('a markDefault that would go through means an overdue, unmarked shortfall', async () => {
    let asked: unknown;
    const c = { simulateContract: (async (a: unknown) => ((asked = a), { result: undefined })) as never };
    expect(await markDefaultWouldSucceed(c, CIRCLE, WALLET)).toBe(true);
    expect(asked).toMatchObject({ address: CIRCLE, functionName: 'markDefault', args: [WALLET] });
  });

  it('the reverts that mean "nothing overdue" answer false', async () => {
    for (const name of ['GraceNotOver', 'NoShortfall', 'AlreadyDefaulted', 'NotMember', 'CircleIsPaused']) {
      expect(await markDefaultWouldSucceed(client(() => Promise.reject(reverting(name))), CIRCLE, WALLET)).toBe(false);
    }
  });

  it('any other revert or a transport failure throws (fail closed)', async () => {
    await expect(markDefaultWouldSucceed(client(() => Promise.reject(reverting('CircleFull'))), CIRCLE, WALLET)).rejects.toThrow();
    await expect(markDefaultWouldSucceed(client(() => Promise.reject(new HttpRequestError({ url: 'http://x' }))), CIRCLE, WALLET)).rejects.toThrow();
    await expect(markDefaultWouldSucceed(client(() => Promise.reject(new Error('boom'))), CIRCLE, WALLET)).rejects.toThrow();
  });
});
