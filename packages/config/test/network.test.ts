import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NetworkError, resolveBrowserRpc, resolveNetwork } from '../src/network';
import { parseDeployment } from '../src/addresses';

describe('resolveNetwork', () => {
  it('defaults to Fuji with the public RPC', () => {
    const n = resolveNetwork({});
    expect(n.name).toBe('fuji');
    expect(n.chainId).toBe(43113);
    expect(n.rpcUrls).toEqual(['https://api.avax-test.network/ext/bc/C/rpc']);
    expect(n.deploymentFile.endsWith(join('contracts', 'deployments', 'fuji.json'))).toBe(true);
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

describe('resolveBrowserRpc (NEXT_PUBLIC_FUJI_RPC_URL)', () => {
  it('is undefined (library default, Fuji public RPC) when unset or blank, and on anvil', () => {
    expect(resolveBrowserRpc({})).toBeUndefined();
    expect(resolveBrowserRpc({ NEXT_PUBLIC_FUJI_RPC_URL: '   ' })).toBeUndefined();
    expect(
      resolveBrowserRpc({ HUISAFE_NETWORK: 'anvil', NEXT_PUBLIC_FUJI_RPC_URL: 'https://rpc.example/fuji' }),
    ).toBeUndefined();
  });

  it('returns a https URL as given, and the server list is unaffected by it', () => {
    const vars = {
      NEXT_PUBLIC_FUJI_RPC_URL: 'https://rpc.example/fuji',
      FUJI_RPC_URL: 'https://server.example',
      FUJI_RPC_URL_FALLBACK: 'https://fb.example',
    };
    expect(resolveBrowserRpc(vars)).toBe('https://rpc.example/fuji');
    expect(resolveNetwork(vars).rpcUrls).toEqual(['https://server.example', 'https://fb.example']);
    expect(resolveBrowserRpc({ NEXT_PUBLIC_FUJI_RPC_URL: 'http://127.0.0.1:9650/ext/bc/C/rpc' })).toBe(
      'http://127.0.0.1:9650/ext/bc/C/rpc',
    );
  });

  it('rejects a non-URL, plain http to a remote host, credentials in the URL and a mainnet endpoint', () => {
    expect(() => resolveBrowserRpc({ NEXT_PUBLIC_FUJI_RPC_URL: 'not a url' })).toThrow(NetworkError);
    expect(() => resolveBrowserRpc({ NEXT_PUBLIC_FUJI_RPC_URL: 'http://rpc.example/fuji' })).toThrow(NetworkError);
    expect(() => resolveBrowserRpc({ NEXT_PUBLIC_FUJI_RPC_URL: 'https://user:secret@rpc.example/fuji' })).toThrow(
      NetworkError,
    );
    const mainnet = ['https://api.avax', '.network/ext/bc/C/rpc'].join('');
    expect(() => resolveBrowserRpc({ NEXT_PUBLIC_FUJI_RPC_URL: mainnet })).toThrow(NetworkError);
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
    expect(deploymentsDir('/x', { HUISAFE_DEPLOYMENTS_DIR: '/tmp/d' })).toBe(resolve('/tmp/d'));
    expect(deploymentsDir(process.cwd(), {}).endsWith(join('contracts', 'deployments'))).toBe(true);
  });
});
