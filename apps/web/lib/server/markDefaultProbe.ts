/**
 * Ask the circle whether `markDefault(wallet)` would succeed right now (docs/05 8.1, audit 21/11 L-02). An eth_call
 * only: nothing is signed or sent. Using the contract's own check keeps the grace rule (including paused time,
 * docs/03 6.8) in one place. A revert that means "nothing overdue" answers false; any other revert, or a transport
 * failure, throws so the attest route fails closed (502).
 */
import type { ContractFunctionRevertedError, PublicClient } from 'viem';
import { huiCircleFullAbi } from 'sdk';

type Address = `0x${string}`;

/** Reverts of `markDefault` that mean the wallet has no shortfall past its grace end in this circle. */
export const NOT_OVERDUE_ERRORS = new Set(['GraceNotOver', 'NoShortfall', 'AlreadyDefaulted', 'NotMember', 'WrongState', 'CircleIsPaused']);

/** Who the eth_call is "from": markDefault is open to anyone, so any address works; the zero address sends nothing. */
const PROBE_FROM: Address = '0x0000000000000000000000000000000000000000';

function findReverted(e: unknown): Pick<ContractFunctionRevertedError, 'data'> | undefined {
  for (let x: unknown = e, depth = 0; x && typeof x === 'object' && depth < 10; x = (x as { cause?: unknown }).cause, depth++) {
    if ((x as { name?: unknown }).name === 'ContractFunctionRevertedError') return x as ContractFunctionRevertedError;
  }
  return undefined;
}

export async function markDefaultWouldSucceed(client: Pick<PublicClient, 'simulateContract'>, circle: Address, wallet: Address): Promise<boolean> {
  try {
    await client.simulateContract({ address: circle, abi: huiCircleFullAbi, functionName: 'markDefault', args: [wallet], account: PROBE_FROM });
    return true;
  } catch (e) {
    // Matched by `name`, not `instanceof`: with two copies of viem loaded (ESM and CJS) the classes differ.
    const reverted = findReverted(e);
    const name = reverted?.data?.errorName;
    if (name && NOT_OVERDUE_ERRORS.has(name)) return false;
    throw e;
  }
}
