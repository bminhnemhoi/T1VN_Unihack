import { describe, expect, it } from 'vitest';
import { NetworkError, resolveNetwork } from '../src/network';
import { parseDeployment } from '../src/addresses';

describe('resolveNetwork', () => {
  it('defaults to Fuji with the public RPC', () => {
    const n = resolveNetwork({});
    expect(n.name).toBe('fuji');
    expect(n.chainId).toBe(43113);
    expect(n.rpcUrls).toEqual(['https://api.avax-test.network/ext/bc/C/rpc']);
    expect(n.deploymentFile.endsWith('contracts/deployments/fuji.json')).toBe(true);
  });

  it('adds the fallback RPC and refuses a mainnet URL', () => {
    expect(
      resolveNetwork({ FUJI_RPC_URL: 'https://a.example', FUJI_RPC_URL_FALLBACK: 'https://b.example' }).rpcUrls,
    ).toEqual(['https://a.example', 'https://b.example']);
    const mainnet = ['https://api.avax', '.network/ext/bc/C/rpc'].join('');
    expect(() => resolveNetwork({ FUJI_RPC_URL: mainnet })).toThrow(NetworkError);
  });

  it('allows anvil only on a local address and rejects other names', () => {
    expect(resolveNetwork({ HUISAFE_NETWORK: 'anvil' }).chainId).toBe(31337);
    expect(() => resolveNetwork({ HUISAFE_NETWORK: 'anvil', ANVIL_RPC_URL: 'https://rpc.example' })).toThrow(
      NetworkError,
    );
    expect(() => resolveNetwork({ HUISAFE_NETWORK: 'mainnet' })).toThrow(NetworkError);
  });
});

describe('parseDeployment with allowed chains', () => {
  const A = (n: number) => `0x${n.toString(16).padStart(40, '0')}`;
  const file = JSON.stringify({
    chainId: 31337,
    usdc: A(1),
    forwarder: A(2),
    reputation: A(3),
    circleLens: A(6),
    factory: A(5),
  });
  it('accepts anvil only when the caller allows it', () => {
    expect(parseDeployment(file).deployed).toBe(false);
    const out = parseDeployment(file, [31337]);
    expect(out.deployed).toBe(true);
    expect(out.chainId).toBe(31337);
    expect(out.circleLens).toBe(A(6));
  });
});

describe('deploymentsDir', () => {
  it('honours HUISAFE_DEPLOYMENTS_DIR and otherwise finds contracts/deployments upwards', async () => {
    const { deploymentsDir } = await import('../src/paths');
    expect(deploymentsDir('/x', { HUISAFE_DEPLOYMENTS_DIR: '/tmp/d' })).toBe('/tmp/d');
    expect(deploymentsDir(process.cwd(), {}).endsWith('contracts/deployments')).toBe(true);
  });
});
