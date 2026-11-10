/**
 * Writes `contracts/test/vectors/terms.json`: the standard agreement text of the demo circles and their keccak256.
 * `CreateDemoCircle.s.sol` hardcodes `DEMO_TERMS_HASH`, `CreateDemoCircles.s.sol` the three Demo Day hashes; the SDK test and the Foundry test both compare
 * against this file, so changing `buildTermsText` fails them until this is re-run and the constant is updated:
 *
 *   pnpm --filter sdk generate:terms
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEMO_FIXED_TERMS_INPUT, DEMO_PHI_TERMS_INPUT, DEMO_TERMS_INPUT, TERMS_VERSION, buildTermsText, termsHashOf, type TermsInput } from '../src/terms.ts';

const entry = (input: TermsInput) => {
  const text = buildTermsText(input);
  return { text, hash: termsHashOf(text) };
};
const demo = entry(DEMO_TERMS_INPUT);
const demoPhi = entry(DEMO_PHI_TERMS_INPUT);
const demoFixed = entry(DEMO_FIXED_TERMS_INPUT);
const out = fileURLToPath(new URL('../../../contracts/test/vectors/terms.json', import.meta.url));
writeFileSync(out, `${JSON.stringify({ version: TERMS_VERSION, demo, demoPhi, demoFixed }, null, 2)}\n`);
console.log(`wrote ${out}\nDEMO_TERMS_HASH = ${demo.hash}\nDEMO_PHI_TERMS_HASH = ${demoPhi.hash}\nDEMO_FIXED_TERMS_HASH = ${demoFixed.hash}`);
