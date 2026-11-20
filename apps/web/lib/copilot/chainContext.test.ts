import { describe, expect, it } from 'vitest';
import { createChainToolContext, chainToolContextFromEnv } from './chainContext';
import { ToolError, runTool } from './tools';

const CIRCLE = '0x00000000000000000000000000000000000000c1';

describe('copilot tool context: draft_ubnd_notice only for circles of the factory (docs/07 3.3)', () => {
  it('drafts the notice for a circle of the factory', async () => {
    const ctx = createChainToolContext(async () => true);
    const r = (await runTool('draft_ubnd_notice', { circle: CIRCLE }, ctx)) as { markdown: string };
    expect(r.markdown).toContain(CIRCLE);
  });

  it('refuses an address the factory did not create', async () => {
    const ctx = createChainToolContext(async () => false);
    await expect(runTool('draft_ubnd_notice', { circle: CIRCLE }, ctx)).rejects.toBeInstanceOf(ToolError);
  });

  it('an RPC failure is a tool error (unavailable), not a crash of the whole answer, and leaks no URL', async () => {
    const ctx = createChainToolContext(async () => {
      throw new Error('HTTP request failed. URL: https://rpc.example/key-SECRET');
    });
    const err = await runTool('draft_ubnd_notice', { circle: CIRCLE }, ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ToolError);
    expect((err as ToolError).code).toBe('unavailable');
    expect((err as ToolError).message).not.toContain('SECRET');
  });

  it('the production route gets a context with the check whenever a deployment exists', () => {
    const ctx = chainToolContextFromEnv({ HUISAFE_NETWORK: 'fuji' });
    expect(typeof ctx?.isCircle).toBe('function');
  });
});
