/**
 * The only place the attest and relay routes read secrets from the environment (docs/04 section 7.4). Secrets
 * (`ATTESTER_PRIVATE_KEY`, `ATTESTATION_ID_SECRET`, `PRIVY_APP_SECRET`, `RELAYER_PRIVATE_KEY`) are read on the server
 * only and never carry a `NEXT_PUBLIC_` prefix. Handlers are built lazily on first request, so `next build` and
 * unit tests never need the variables; a missing variable becomes a 503 that names the variable in the log only.
 */
import { createWalletClient, http, fallback, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { NetworkError, resolveNetwork } from 'config/network';
import { huiFactoryAbi, erc2771ForwarderAbi } from 'sdk';
import { createAttestHandler, ATTEST_PER_HOUR, type AttestDeps } from './attest';
import { chainFor, ConfigError, loadDeployment, makePublicClient } from './chain';
import { consoleLogger, errorResponse, makeRequestIdGenerator } from './http';
import { createPrivyVerifier } from './privy';
import { SlidingWindowLimiter } from './ratelimit';
import { createRelayHandler, RELAY_PER_HOUR } from './relay';

type Env = Record<string, string | undefined>;
type Handler = (req: Request) => Promise<Response>;

function requireVar(env: Env, name: string): string {
  const v = env[name];
  if (!v) throw new ConfigError(`missing environment variable ${name}`);
  return v;
}

function requireKey(env: Env, name: string): Hex {
  const v = requireVar(env, name);
  if (!/^0x[0-9a-fA-F]{64}$/.test(v)) throw new ConfigError(`${name} is not a 32-byte hex key`);
  return v as Hex;
}

export async function buildAttestHandler(env: Env = process.env): Promise<Handler> {
  const network = resolveNetwork(env);
  const deployment = loadDeployment(network);
  const account = privateKeyToAccount(requireKey(env, 'ATTESTER_PRIVATE_KEY'));
  const idSecret = requireVar(env, 'ATTESTATION_ID_SECRET');
  const verifier = createPrivyVerifier(requireVar(env, 'NEXT_PUBLIC_PRIVY_APP_ID'), requireVar(env, 'PRIVY_APP_SECRET'));
  const publicClient = makePublicClient(network);

  // The circle only accepts signatures from the attester recorded in the factory config.
  const config = await publicClient.readContract({ address: deployment.factory, abi: huiFactoryAbi, functionName: 'config' });
  if (config.attester.toLowerCase() !== account.address.toLowerCase()) {
    throw new ConfigError('ATTESTER_PRIVATE_KEY does not match the attester of the deployed factory');
  }

  const deps: AttestDeps = {
    verifier,
    attester: { address: account.address, signTypedData: (args) => account.signTypedData(args) },
    idSecret,
    chainId: network.chainId,
    isCircle: (circle) =>
      publicClient.readContract({ address: deployment.factory, abi: huiFactoryAbi, functionName: 'isCircle', args: [circle] }),
    userLimiter: new SlidingWindowLimiter(ATTEST_PER_HOUR),
    ipLimiter: new SlidingWindowLimiter(120),
    now: Date.now,
    requestId: makeRequestIdGenerator(),
    log: consoleLogger,
  };
  return createAttestHandler(deps);
}

export async function buildRelayHandler(env: Env = process.env): Promise<Handler> {
  const network = resolveNetwork(env);
  const deployment = loadDeployment(network);
  const account = privateKeyToAccount(requireKey(env, 'RELAYER_PRIVATE_KEY'));
  const publicClient = makePublicClient(network);
  const transports = network.rpcUrls.map((u) => http(u));
  const wallet = createWalletClient({
    account,
    chain: chainFor(network),
    transport: transports.length > 1 ? fallback(transports) : transports[0]!,
  });
  const config = await publicClient.readContract({ address: deployment.factory, abi: huiFactoryAbi, functionName: 'config' });
  if (config.forwarder.toLowerCase() !== deployment.forwarder.toLowerCase()) {
    throw new ConfigError('forwarder in the deployment file differs from the factory config');
  }

  return createRelayHandler({
    publicClient,
    factory: deployment.factory,
    forwarder: deployment.forwarder,
    sender: {
      address: account.address,
      execute: ({ forwarder, request, gas }) =>
        wallet.writeContract({ address: forwarder, abi: erc2771ForwarderAbi, functionName: 'execute', args: [request], gas }),
    },
    limiter: new SlidingWindowLimiter(RELAY_PER_HOUR),
    now: Date.now,
    requestId: makeRequestIdGenerator(),
    log: consoleLogger,
  });
}

/** Builds the handler once; configuration problems answer 503 and are retried on the next request. */
export function lazyHandler(build: () => Promise<Handler>, name: string): Handler {
  let cached: Promise<Handler> | undefined;
  return async (req) => {
    try {
      cached ??= build();
      return await (await cached)(req);
    } catch (e) {
      cached = undefined;
      if (e instanceof ConfigError || e instanceof NetworkError) {
        consoleLogger('error', `${name} not configured`, { reason: e.message });
        return errorResponse(503, 'NotConfigured', 'Dịch vụ chưa được cấu hình. Hãy thử lại sau.');
      }
      consoleLogger('error', `${name} failed`, { reason: e instanceof Error ? e.name : 'unknown' });
      return errorResponse(500, 'Internal', 'Có lỗi hệ thống. Hãy thử lại sau.');
    }
  };
}
