/**
 * Writes `contracts/test/vectors/terms.json`: the standard agreement text of the demo circle and its keccak256.
 * `CreateDemoCircle.s.sol` hardcodes the hash as `DEMO_TERMS_HASH`; the SDK test and the Foundry test both compare
 * against this file, so changing `buildTermsText` fails them until this is re-run and the constant is updated:
 *
 *   pnpm --filter sdk generate:terms
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEMO_TERMS_INPUT, TERMS_VERSION, buildTermsText, termsHashOf } from '../src/terms.ts';

const text = buildTermsText(DEMO_TERMS_INPUT);
const out = fileURLToPath(new URL('../../../contracts/test/vectors/terms.json', import.meta.url));
writeFileSync(out, `${JSON.stringify({ version: TERMS_VERSION, demo: { text, hash: termsHashOf(text) } }, null, 2)}\n`);
console.log(`wrote ${out}\nDEMO_TERMS_HASH = ${termsHashOf(text)}`);
