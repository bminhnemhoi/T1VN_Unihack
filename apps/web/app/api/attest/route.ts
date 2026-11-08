/**
 * POST /api/attest (docs/05 8.1). Thin wrapper: all logic is in lib/server/attest.ts, all secrets in lib/server/env.ts.
 */
import { buildAttestHandler, lazyHandler } from '../../../lib/server/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = lazyHandler(() => buildAttestHandler(), 'attest');
