/**
 * The copilot's only chain access: `factory.isCircle` for `draft_ubnd_notice` (docs/07 3.3, docs/05 section 12).
 * Read-only, no key: the public client of the server routes. Without a deployment (sample data, a network not
 * deployed yet) there is no context and the tool keeps working without the check, as before.
 */
import { huiFactoryAbi } from 'sdk';
import { resolveNetwork } from 'config/network';
import { loadDeployment, makePublicClient } from '../server/chain';
import { ToolError, type ToolContext } from './tools';

/** Wraps a raw `isCircle` read: an RPC failure becomes a tool error (no URL or key in the message). */
export function createChainToolContext(readIsCircle: (address: `0x${string}`) => Promise<boolean>): ToolContext {
  return {
    async isCircle(address) {
      try {
        return await readIsCircle(address as `0x${string}`);
      } catch {
        throw new ToolError('unavailable', 'Chưa đọc được dữ liệu từ mạng để xác nhận địa chỉ dây. Bạn thử lại sau.');
      }
    },
  };
}

/** The context for the route, or undefined when the network has no deployment. The client is created lazily. */
export function chainToolContextFromEnv(env: Record<string, string | undefined>): ToolContext | undefined {
  let factory: `0x${string}`;
  let network: ReturnType<typeof resolveNetwork>;
  try {
    network = resolveNetwork(env);
    factory = loadDeployment(network).factory;
  } catch {
    return undefined;
  }
  let client: ReturnType<typeof makePublicClient> | undefined;
  return createChainToolContext((address) => {
    client ??= makePublicClient(network);
    return client.readContract({ address: factory, abi: huiFactoryAbi, functionName: 'isCircle', args: [address] });
  });
}
