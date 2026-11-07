import { describe, expect, it } from 'vitest';
import { NOT_DEPLOYED, loadAddresses, parseDeployment } from '../src/addresses';

const A = (n: number) => `0x${n.toString(16).padStart(40, '0')}`;

describe('addresses', () => {
  it('reports not deployed when the file is missing', () => {
    expect(loadAddresses('/nonexistent/fuji.json')).toBe(NOT_DEPLOYED);
    expect(NOT_DEPLOYED.deployed).toBe(false);
    expect(NOT_DEPLOYED.factory).toBeUndefined();
  });

  it('rejects bad JSON, wrong chain and placeholder addresses', () => {
    expect(parseDeployment('not json')).toBe(NOT_DEPLOYED);
    expect(parseDeployment(JSON.stringify({ chainId: 43114, factory: A(1) }))).toBe(NOT_DEPLOYED);
    const placeholder = { chainId: 43113, usdc: A(1), forwarder: '0x...', reputation: A(3), factory: A(4) };
    expect(parseDeployment(JSON.stringify(placeholder))).toBe(NOT_DEPLOYED);
  });

  it('parses a complete Fuji deployment', () => {
    const file = {
      chainId: 43113,
      usdc: A(1),
      forwarder: A(2),
      reputation: A(3),
      circleImplementation: A(4),
      factory: A(5),
      deployedAt: '2026-11-11T13:00:00Z',
      gitCommit: 'abcdef1',
    };
    const out = parseDeployment(JSON.stringify(file));
    expect(out.deployed).toBe(true);
    expect(out.factory).toBe(A(5));
    expect(out.gitCommit).toBe('abcdef1');
  });
});
