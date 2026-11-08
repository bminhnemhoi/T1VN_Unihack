/**
 * docs/07 3.2 item 5 and CLAUDE.md hard rule 2: the copilot code can reach no wallet key and no relay/attest module,
 * and the Anthropic key is read in exactly two places (the route, and the human-run eval CLI).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOOL_NAMES } from './schemas';

const root = process.cwd();
const dirs = ['lib/copilot', 'app/api/copilot'];

function files(dir: string): string[] {
  const abs = path.join(root, dir);
  return readdirSync(abs).flatMap((name) => {
    const p = path.join(abs, name);
    return statSync(p).isDirectory() ? files(path.relative(root, p)) : [p];
  });
}

const sources = dirs
  .flatMap(files)
  .filter((f) => /\.(ts|tsx|mts)$/.test(f) && !f.endsWith('.test.ts'))
  .map((f) => ({ file: path.relative(root, f), text: readFileSync(f, 'utf8') }));

describe('copilot key isolation', () => {
  it('finds the source files', () => {
    expect(sources.length).toBeGreaterThan(10);
  });

  it('never mentions wallet or service secrets', () => {
    const secrets = ['RELAYER_PRIVATE_KEY', 'ATTESTER_PRIVATE_KEY', 'KEEPER_PRIVATE_KEY', 'DEPLOYER_PRIVATE_KEY', 'PRIVY_APP_SECRET', 'ATTESTATION_ID_SECRET', 'TELEGRAM_BOT_TOKEN'];
    for (const s of sources) for (const k of secrets) expect(s.text, `${s.file} mentions ${k}`).not.toContain(k);
  });

  it('never imports a relay or attest module', () => {
    for (const s of sources) {
      for (const m of s.text.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        expect(m[1], `${s.file} imports ${m[1]}`).not.toMatch(/relay|attest|privy|wagmi|viem\/accounts/i);
      }
    }
  });

  it('has no NEXT_PUBLIC_ variable at all', () => {
    for (const s of sources) expect(s.text, s.file).not.toContain('NEXT_PUBLIC_');
  });

  it('names the key variables only in provider.ts (and the eval CLI message), and touches the environment only in three places', () => {
    const norm = (f: string) => f.replaceAll('\\', '/');
    const named = sources.filter((x) => /COPILOT_API_KEY|ANTHROPIC_API_KEY|COPILOT_BASE_URL/.test(x.text)).map((x) => norm(x.file));
    expect(named.sort()).toEqual(['lib/copilot/evals/run.ts', 'lib/copilot/provider.ts']);
    const envReaders = sources.filter((x) => x.text.includes('process.env')).map((x) => norm(x.file));
    expect(envReaders.sort()).toEqual(['app/api/copilot/route.ts', 'lib/copilot/evals/run.ts', 'lib/copilot/simResults.ts']);
  });

  it('never logs a key, a base URL or a provider error message', () => {
    for (const s of sources) {
      expect(s.text, s.file).not.toMatch(/console\.\w+\([^)]*(apiKey|baseUrl|cfg\b)/i);
    }
  });

  it('has no randomness in product code (Math.random, crypto.random*)', () => {
    for (const s of sources.filter((x) => !x.file.includes('/evals/'))) {
      expect(s.text, s.file).not.toMatch(/Math\.random|getRandomValues|randomBytes|randomInt/);
    }
  });

  it('exposes no write tool: no tool name suggests signing or sending', () => {
    for (const name of TOOL_NAMES) expect(name).not.toMatch(/sign|transfer|send|withdraw|approve|pay|submit|execute|relay/i);
    expect(TOOL_NAMES).toHaveLength(6);
  });
});
