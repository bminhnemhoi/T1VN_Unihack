/** Wires the sổ hụi route to the chain (kept out of the secrets module; this route reads no secret). */
import { huiFactoryAbi } from 'sdk';
import { loadAddresses } from 'config/addresses';
import { resolveNetwork } from 'config/network';
import { buildBook } from './book';
import { BOOK_PER_HOUR_PER_IP, createBookHandler } from './bookRoute';
import { ConfigError, loadDeployment, makePublicClient } from './chain';
import { consoleLogger, makeRequestIdGenerator } from './http';
import { SlidingWindowLimiter } from './ratelimit';

export async function buildBookHandler(vars: Record<string, string | undefined> = process.env) {
  const network = resolveNetwork(vars);
  const deployment = loadDeployment(network);
  const client = makePublicClient(network);
  const actual = await client.getChainId();
  if (actual !== network.chainId) throw new ConfigError(`RPC reports chain ${actual}, expected ${network.chainId}`);
  const fromBlock = BigInt(loadAddresses(network.deploymentFile, [network.chainId]).deployBlock ?? 0);
  return createBookHandler({
    isCircle: (a) => client.readContract({ address: deployment.factory, abi: huiFactoryAbi, functionName: 'isCircle', args: [a] }),
    build: (a) => buildBook(client, a, { factory: deployment.factory, fromBlock, chainId: network.chainId }),
    ipLimiter: new SlidingWindowLimiter(BOOK_PER_HOUR_PER_IP),
    now: Date.now,
    requestId: makeRequestIdGenerator(),
    log: consoleLogger,
  });
}
